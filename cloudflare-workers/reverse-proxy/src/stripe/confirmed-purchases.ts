import type {
	ConfirmedProduct,
	ConfirmedPurchase,
	PurchaseAttemptInput,
	PurchaseEnv,
	StripeAccount,
} from './types';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';
const STRIPE_API_VERSION = '2024-06-20';
const STRIPE_TIMEOUT_MS = 8000;
const MAX_CHARGE_PAGES = 3;
const CHARGE_PAGE_SIZE = 100;
const MATCH_CLOCK_SKEW_MS = 30_000;

const NON_ORDER_PRODUCT_IDS = new Set(['prod_RtWNqT9xux5CI7']);
const NON_ORDER_PRICE_IDS = new Set(['price_1QzjKMBf6i84vTZE2WPd5Rh7']);

type StripeObject = Record<string, unknown>;

type StripeLine = {
	amountCents: number | null;
	description: string;
	planId: string;
	priceId: string;
	productId: string;
	productName: string;
	quantity: number;
};

type EnrichedCharge = {
	billingReason: string;
	charge: StripeObject;
	lines: StripeLine[];
	subscriptionId: string;
};

function getString(value: unknown): string {
	if (typeof value !== 'string') return '';
	return value.trim();
}

function getNumber(value: unknown): number | null {
	if (typeof value !== 'number') return null;
	if (!Number.isFinite(value)) return null;
	return value;
}

function getObject(value: unknown): StripeObject | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	return value as StripeObject;
}

function getObjectId(value: unknown): string {
	return getString(value) || getString(getObject(value)?.id);
}

function getMetadata(object: StripeObject): StripeObject {
	return getObject(object.metadata) ?? {};
}

function normalizeEmail(value: unknown): string {
	return getString(value).toLowerCase();
}

function getChargeEmail(charge: StripeObject): string {
	const billingDetails = getObject(charge.billing_details);
	const customer = getObject(charge.customer);
	const paymentIntent = getObject(charge.payment_intent);

	return normalizeEmail(billingDetails?.email) ||
		normalizeEmail(charge.receipt_email) ||
		normalizeEmail(customer?.email) ||
		normalizeEmail(paymentIntent?.receipt_email);
}

function getChargePaymentMethodId(charge: StripeObject): string {
	return getObjectId(charge.payment_method);
}

function getChargeCreatedAt(charge: StripeObject): number {
	const created = getNumber(charge.created);
	return created == null ? 0 : created * 1000;
}

function getSecret(env: PurchaseEnv, account: StripeAccount): string {
	const secret = account === 'kajabi'
		? getString(env.STRIPE_KAJABI_SECRET_KEY)
		: getString(env.STRIPE_SECRET_KEY);

	if (!secret) {
		throw new Error(`Stripe secret is not configured for ${account}`);
	}

	return secret;
}

async function fetchStripeObject(
	env: PurchaseEnv,
	account: StripeAccount,
	path: string,
	params?: URLSearchParams,
): Promise<StripeObject> {
	const url = new URL(`${STRIPE_API_BASE}${path}`);
	if (params) {
		url.search = params.toString();
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), STRIPE_TIMEOUT_MS);

	try {
		const response = await fetch(url, {
			headers: {
				Authorization: `Basic ${btoa(`${getSecret(env, account)}:`)}`,
				'Stripe-Version': STRIPE_API_VERSION,
			},
			signal: controller.signal,
		});
		const body = await response.json() as unknown;
		const object = getObject(body);

		if (!response.ok) {
			throw new Error(`Stripe request failed with status ${response.status}`);
		}
		if (!object) {
			throw new Error('Stripe returned an invalid response');
		}

		return object;
	} finally {
		clearTimeout(timeoutId);
	}
}

async function listRecentCharges(
	env: PurchaseEnv,
	account: StripeAccount,
	startedAt: number,
	now: number,
): Promise<StripeObject[]> {
	const charges: StripeObject[] = [];
	let startingAfter = '';

	for (let page = 0; page < MAX_CHARGE_PAGES; page += 1) {
		const params = new URLSearchParams({
			'created[gte]': String(Math.floor((startedAt - MATCH_CLOCK_SKEW_MS) / 1000)),
			'created[lte]': String(Math.floor((now + MATCH_CLOCK_SKEW_MS) / 1000)),
			'expand[]': 'data.customer',
			limit: String(CHARGE_PAGE_SIZE),
		});
		params.append('expand[]', 'data.payment_intent');
		if (startingAfter) {
			params.set('starting_after', startingAfter);
		}

		const result = await fetchStripeObject(env, account, '/charges', params);
		const pageCharges = Array.isArray(result.data)
			? result.data.map(getObject).filter((charge): charge is StripeObject => Boolean(charge))
			: [];

		charges.push(...pageCharges);

		if (result.has_more !== true || pageCharges.length === 0) {
			break;
		}

		startingAfter = getString(pageCharges[pageCharges.length - 1]?.id);
		if (!startingAfter) {
			break;
		}
	}

	return charges;
}

function isSuccessfulCharge(charge: StripeObject): boolean {
	return charge.paid === true && getString(charge.status) === 'succeeded';
}

function chargeMatchesAttempt(charge: StripeObject, attempt: PurchaseAttemptInput): boolean {
	if (!isSuccessfulCharge(charge)) return false;
	if (getChargePaymentMethodId(charge) !== attempt.paymentMethodId) return false;
	if (getChargeEmail(charge) !== attempt.email) return false;

	return getChargeCreatedAt(charge) >= attempt.submittedAt - MATCH_CLOCK_SKEW_MS;
}

function getLine(value: unknown): StripeLine | null {
	const line = getObject(value);
	if (!line) return null;

	const price = getObject(line.price);
	const plan = getObject(line.plan);
	const product = getObject(price?.product);

	return {
		amountCents: getNumber(line.amount),
		description: getString(line.description),
		planId: getObjectId(line.plan) || getString(plan?.id),
		priceId: getObjectId(line.price),
		productId: getObjectId(price?.product),
		productName: getString(product?.name),
		quantity: getNumber(line.quantity) ?? 1,
	};
}

function getLines(container: StripeObject | null): StripeLine[] {
	const data = container && Array.isArray(container.data) ? container.data : [];
	return data.map(getLine).filter((line): line is StripeLine => Boolean(line));
}

async function getInvoiceDetails(
	env: PurchaseEnv,
	account: StripeAccount,
	invoiceId: string,
): Promise<{ billingReason: string; lines: StripeLine[]; subscriptionId: string }> {
	if (!invoiceId) {
		return { billingReason: '', lines: [], subscriptionId: '' };
	}

	const invoice = await fetchStripeObject(
		env,
		account,
		`/invoices/${encodeURIComponent(invoiceId)}`,
		new URLSearchParams({ 'expand[]': 'lines.data.price.product' }),
	);

	return {
		billingReason: getString(invoice.billing_reason),
		lines: getLines(getObject(invoice.lines)),
		subscriptionId: getObjectId(invoice.subscription),
	};
}

async function getCheckoutLines(
	env: PurchaseEnv,
	account: StripeAccount,
	paymentIntentId: string,
): Promise<StripeLine[]> {
	if (!paymentIntentId) return [];

	const sessions = await fetchStripeObject(
		env,
		account,
		'/checkout/sessions',
		new URLSearchParams({
			limit: '1',
			payment_intent: paymentIntentId,
		}),
	);
	const firstSession = Array.isArray(sessions.data) ? getObject(sessions.data[0]) : null;
	const sessionId = getString(firstSession?.id);
	if (!sessionId) return [];

	const lineItems = await fetchStripeObject(
		env,
		account,
		`/checkout/sessions/${encodeURIComponent(sessionId)}/line_items`,
		new URLSearchParams({
			limit: '100',
			'expand[]': 'data.price.product',
		}),
	);

	return getLines(lineItems);
}

async function enrichCharge(
	env: PurchaseEnv,
	account: StripeAccount,
	charge: StripeObject,
): Promise<EnrichedCharge> {
	const invoice = await getInvoiceDetails(env, account, getObjectId(charge.invoice));
	const checkoutLines = invoice.lines.length > 0
		? []
		: await getCheckoutLines(env, account, getObjectId(charge.payment_intent));

	return {
		billingReason: invoice.billingReason,
		charge,
		lines: invoice.lines.length > 0 ? invoice.lines : checkoutLines,
		subscriptionId: invoice.subscriptionId,
	};
}

function decodeHtml(value: string): string {
	return value
		.replaceAll('&amp;', '&')
		.replaceAll('&quot;', '"')
		.replaceAll('&#39;', "'")
		.replaceAll('&apos;', "'")
		.replaceAll('&nbsp;', ' ')
		.replaceAll('&#44;', ',');
}

function extractMarkedProductText(value: string): string {
	const marker = value.match(/(?:^|\|\s*)products?:\s*/i);
	if (marker?.index == null) return '';

	return value.slice(marker.index + marker[0].length).trim();
}

function extractMentorshipProductFromLine(value: string): string {
	const match = value.match(
		/(?:^|\|\s*)product:\s*(booming bookkeeping mentorship program.*)$/i,
	);

	return match?.[1]?.trim() || value;
}

function cleanProductName(value: string): string {
	return decodeHtml(value)
		.trim()
		.replace(/^trial period for\s+/i, '')
		.replace(/^\s*\d+\s*[×x]\s*/i, '')
		.replace(/\s*\(at\s+\$[^)]*\)\s*$/i, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function normalizeContentId(value: string): string {
	return cleanProductName(value).toLowerCase();
}

function isThousandsSeparator(value: string, commaIndex: number): boolean {
	const before = value[commaIndex - 1] ?? '';
	const after = value.slice(commaIndex + 1, commaIndex + 4);
	const following = value[commaIndex + 4] ?? '';

	return /\d/.test(before) && /^\d{3}$/.test(after) && !/\d/.test(following);
}

function splitProductList(value: string): string[] {
	const products: string[] = [];
	let current = '';

	for (let index = 0; index < value.length; index += 1) {
		const character = value[index];

		if (character !== ',' || isThousandsSeparator(value, index)) {
			current += character;
			continue;
		}

		products.push(current);
		current = '';
	}

	products.push(current);
	return products.map(cleanProductName).filter(Boolean);
}

function toConfirmedProduct(name: string, line?: StripeLine): ConfirmedProduct | null {
	const cleanedName = cleanProductName(name);
	const contentId = normalizeContentId(cleanedName);
	if (!contentId) return null;

	const product: ConfirmedProduct = {
		contentId,
		name: cleanedName,
		quantity: line?.quantity ?? 1,
	};

	if (line?.amountCents != null) {
		product.price = line.amountCents / 100;
	}
	if (line?.planId) {
		product.stripePlanId = line.planId;
	}
	if (line?.priceId) {
		product.stripePriceId = line.priceId;
	}
	if (line?.productId) {
		product.stripeProductId = line.productId;
	}

	return product;
}

function dedupeProducts(products: ConfirmedProduct[]): ConfirmedProduct[] {
	const output: ConfirmedProduct[] = [];
	const seen = new Set<string>();

	for (const product of products) {
		if (seen.has(product.contentId)) continue;

		seen.add(product.contentId);
		output.push(product);
	}

	return output;
}

function resolveLineProducts(lines: StripeLine[]): ConfirmedProduct[] {
	const namedLines = lines.filter((line) => line.productName || line.description);
	const positiveLines = namedLines.filter((line) => (line.amountCents ?? 0) > 0);
	const selectedLines = positiveLines.length > 0 ? positiveLines : namedLines;
	const products = selectedLines
		.map((line) => {
			const productName = line.productName ||
				extractMentorshipProductFromLine(line.description);
			return toConfirmedProduct(productName, line);
		})
		.filter((product): product is ConfirmedProduct => Boolean(product));

	return dedupeProducts(products);
}

function resolveMetadataProducts(charge: StripeObject): ConfirmedProduct[] {
	const metadataProducts = getString(getMetadata(charge).products);
	const description = getString(charge.description);
	const productText = metadataProducts || extractMarkedProductText(description);
	const products = splitProductList(productText)
		.map((name) => toConfirmedProduct(name))
		.filter((product): product is ConfirmedProduct => Boolean(product));

	return dedupeProducts(products);
}

function resolveProducts(enriched: EnrichedCharge): ConfirmedProduct[] {
	const lineProducts = resolveLineProducts(enriched.lines);
	if (lineProducts.length > 0) return lineProducts;

	return resolveMetadataProducts(enriched.charge);
}

function isRepeatOrNonOrder(enriched: EnrichedCharge): boolean {
	if (
		enriched.lines.some((line) =>
			NON_ORDER_PRODUCT_IDS.has(line.productId) ||
			NON_ORDER_PRICE_IDS.has(line.priceId)
		)
	) {
		return true;
	}

	if (!enriched.subscriptionId) return false;
	return enriched.billingReason !== 'subscription_create';
}

function getCustomerName(charge: StripeObject): string {
	return getString(getObject(charge.billing_details)?.name);
}

function getCustomerPhone(charge: StripeObject): string {
	return getString(getObject(charge.billing_details)?.phone);
}

function toConfirmedPurchase(
	account: StripeAccount,
	enriched: EnrichedCharge,
): ConfirmedPurchase | null {
	const chargeId = getString(enriched.charge.id);
	const amount = getNumber(enriched.charge.amount);
	const currency = getString(enriched.charge.currency).toUpperCase();

	if (!chargeId || amount == null || !currency) return null;
	if (isRepeatOrNonOrder(enriched)) return null;

	const value = amount / 100;
	const products = resolveProducts(enriched);
	if (products.length === 0) return null;

	if (products.length === 1 && products[0].price == null) {
		products[0].price = value;
	}

	return {
		chargeId,
		contentIds: products.map((product) => product.contentId),
		currency,
		email: getChargeEmail(enriched.charge),
		name: getCustomerName(enriched.charge),
		phone: getCustomerPhone(enriched.charge),
		productId: products[0].contentId,
		productName: products.map((product) => product.name).join(', '),
		products,
		stripeAccount: account,
		value,
	};
}

export async function findConfirmedPurchases(
	env: PurchaseEnv,
	account: StripeAccount,
	attempts: PurchaseAttemptInput[],
	now: number,
	deliveredChargeIds = new Set<string>(),
): Promise<ConfirmedPurchase[]> {
	if (attempts.length === 0) return [];

	const startedAt = Math.min(...attempts.map((attempt) => attempt.submittedAt));
	const charges = await listRecentCharges(env, account, startedAt, now);
	const matchingCharges = charges.filter((charge) =>
		!deliveredChargeIds.has(getString(charge.id)) &&
		attempts.some((attempt) => chargeMatchesAttempt(charge, attempt))
	);
	const purchases: ConfirmedPurchase[] = [];

	for (const charge of matchingCharges) {
		const enriched = await enrichCharge(env, account, charge);
		const purchase = toConfirmedPurchase(account, enriched);

		if (purchase) {
			purchases.push(purchase);
		}
	}

	return purchases.sort((left, right) => left.chargeId.localeCompare(right.chargeId));
}
