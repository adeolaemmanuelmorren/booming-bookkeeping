import {
	HttpError,
	appendSetCookieHeaders,
	getString,
	normalizeAnonymousId,
	readJsonObject,
	readObject,
	resolveAnonymousIdentity,
	tryParseUrl,
	type Env,
	type TenantConfig,
} from '../jitsu-proxy';
import type { ConfirmedProduct, PurchaseAttemptInput, StripeAccount } from './types';

export const PURCHASE_ATTEMPT_PATH = '/v1/purchase-attempts';
export const PURCHASE_POLL_PATH = '/v1/purchase-confirmations';

export function isStripePurchasePath(path: string): boolean {
	return path === PURCHASE_ATTEMPT_PATH || path === PURCHASE_POLL_PATH;
}

function normalizeEmail(value: unknown): string {
	const email = getString(value)?.toLowerCase() ?? '';
	if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
		throw new HttpError(400, 'A valid email is required');
	}

	return email;
}

function getPaymentMethodId(value: unknown): string {
	const paymentMethodId = getString(value) ?? '';
	if (!/^pm_[A-Za-z0-9]+$/.test(paymentMethodId)) {
		throw new HttpError(400, 'A valid Stripe payment method ID is required');
	}

	return paymentMethodId;
}

function getSubmittedAt(value: unknown): number {
	const submittedAt = Date.parse(getString(value) ?? '');
	const now = Date.now();

	if (!Number.isFinite(submittedAt)) {
		throw new HttpError(400, 'A valid submission time is required');
	}
	if (submittedAt < now - 15 * 60 * 1000 || submittedAt > now + 60 * 1000) {
		throw new HttpError(400, 'Submission time is outside the allowed window');
	}

	return submittedAt;
}

function getStripeAccount(request: Request): StripeAccount {
	const origin = tryParseUrl(request.headers.get('Origin'));
	if (!origin) {
		throw new HttpError(400, 'Origin is required');
	}

	return origin.hostname.toLowerCase() === 'learn.boomingbookkeeping.com'
		? 'kajabi'
		: 'main';
}

function toBrowserProduct(product: ConfirmedProduct, currency: string) {
	return {
		currency,
		price: product.price,
		product_id: product.contentId,
		product_name: product.name,
		quantity: product.quantity,
		stripe_plan_id: product.stripePlanId,
		stripe_price_id: product.stripePriceId,
		stripe_product_id: product.stripeProductId,
	};
}

export async function handlePurchaseAttemptRequest(
	request: Request,
	env: Env,
	tenant: TenantConfig,
): Promise<Response> {
	const body = await readJsonObject(request);
	const attemptBody = readObject(body.attempt) ?? body;
	const identity = resolveAnonymousIdentity(
		request,
		tenant,
		normalizeAnonymousId(body.anonymous_id) ?? normalizeAnonymousId(body.anonymousId),
	);
	const attempt: PurchaseAttemptInput = {
		email: normalizeEmail(attemptBody.email),
		paymentMethodId: getPaymentMethodId(attemptBody.payment_method_id),
		stripeAccount: getStripeAccount(request),
		submittedAt: getSubmittedAt(attemptBody.submitted_at),
	};
	const state = env.PURCHASE_STATE.getByName(identity.anonymousId);

	await state.registerAttempt(attempt);

	const response = new Response(JSON.stringify({ ok: true }), {
		status: 202,
		headers: {
			'Cache-Control': 'no-store',
			'Content-Type': 'application/json',
		},
	});

	return appendSetCookieHeaders(response, identity.cookieHeaders);
}

export async function handlePurchasePollRequest(
	request: Request,
	env: Env,
	tenant: TenantConfig,
): Promise<Response> {
	const body = await readJsonObject(request);
	const identity = resolveAnonymousIdentity(
		request,
		tenant,
		normalizeAnonymousId(body.anonymous_id) ?? normalizeAnonymousId(body.anonymousId),
	);
	const account = getStripeAccount(request);
	const state = env.PURCHASE_STATE.getByName(identity.anonymousId);
	const result = await state.poll(account);
	const response = new Response(JSON.stringify({
		charges: result.charges.map((charge) => ({
			charge_id: charge.chargeId,
			content_ids: charge.contentIds,
			currency: charge.currency,
			email: charge.email,
			name: charge.name,
			phone: charge.phone,
			product_id: charge.productId,
			product_name: charge.productName,
			products: charge.products.map((product) => toBrowserProduct(product, charge.currency)),
			value: charge.value,
		})),
		has_pending_attempts: result.hasPendingAttempts,
		retry_after_ms: result.retryAfterMs,
	}), {
		status: 200,
		headers: {
			'Cache-Control': 'no-store',
			'Content-Type': 'application/json',
		},
	});

	return appendSetCookieHeaders(response, identity.cookieHeaders);
}
