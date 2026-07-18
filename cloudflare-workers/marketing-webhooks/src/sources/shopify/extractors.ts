/**
 * Data extraction helpers for Shopify payloads
 *
 * These functions extract and normalize data from Shopify webhook payloads
 * into Segment-compatible formats.
 */

import type {
	ShopifyAddress,
	ShopifyCheckoutPayload,
	ShopifyCustomer,
	ShopifyDiscountCode,
	ShopifyLineItem,
	ShopifyOrderPayload,
} from "./types";
import type { ShopifyEnrichmentResult } from "./enricher";
import { addGoogleApiCompliantAttribution, parsePrice, isNonEmptyString } from "../../utils";

const ATTRIBUTION_NAME_BY_ATTRIBUTE_NAME: Record<string, string> = {
	utm_source: "utm_source",
	utm_medium: "utm_medium",
	utm_campaign: "utm_campaign",
	utm_term: "utm_term",
	utm_content: "utm_content",
	utm_id: "utm_id",
	gclid: "gclid",
	fbclid: "fbclid",
	gbraid: "gbraid",
	wbraid: "wbraid",
	twclid: "twclid",
	ttclid: "ttclid",
	rdt_cid: "rdt_cid",
	li_fat_id: "li_fat_id",
	msclkid: "msclkid",
	_fbc: "fbc",
	fbc: "fbc",
	_fbp: "fbp",
	fbp: "fbp",
	_uetvid: "uetvid",
	uetvid: "uetvid",
	_uetsid: "uetsid",
	uetsid: "uetsid",
	_ttp: "ttp",
	ttp: "ttp",
	_ttclid: "ttclid",
	_rdt_uuid: "rdt_uuid",
	rdt_uuid: "rdt_uuid",
};

const ANONYMOUS_ID_ATTRIBUTE_NAMES = new Set([
	"anonymousId",
	"anonymous_id",
	"segmentAnonymousId",
	"ajs_anonymous_id",
	"rudderAnonymousId",
]);

/**
 * Segment product structure
 */
export interface SegmentProduct {
	product_id: string;
	variant_id?: string;
	sku?: string;
	name: string;
	variant?: string;
	price: number;
	quantity: number;
	image_url?: string;
	/** All collection titles (comma-separated, if any) */
	collections?: string;
	url?: string;
	brand?: string;
}

/**
 * Segment address structure
 */
export interface SegmentAddress {
	address_line_1?: string;
	address_line_2?: string;
	city?: string;
	state?: string;
	zip?: string;
	country?: string;
}

function getAttributeValue(value: unknown): string | undefined {
	if (value === null || value === undefined) return undefined;

	const stringValue = String(value).trim();
	if (!stringValue) return undefined;

	return stringValue;
}

function firstFilledValue(...values: Array<string | undefined>): string | undefined {
	return values.find((value) => isNonEmptyString(value));
}

function mergeAddresses(...addresses: SegmentAddress[]): SegmentAddress {
	const output: SegmentAddress = {};

	for (const address of addresses) {
		if (!address || Object.keys(address).length === 0) continue;
		Object.assign(output, address);
	}

	return output;
}

function addAttributionFromAttributes(
	attribution: Record<string, unknown>,
	attributes?: Array<{ name?: string; key?: string; value?: unknown }>
): void {
	if (!attributes || !Array.isArray(attributes)) return;

	for (const attribute of attributes) {
		const rawName = attribute.name || attribute.key;
		if (!rawName) continue;
		if (ANONYMOUS_ID_ATTRIBUTE_NAMES.has(rawName)) continue;

		const value = getAttributeValue(attribute.value);
		if (!value) continue;

		const attributionName = ATTRIBUTION_NAME_BY_ATTRIBUTE_NAME[rawName] || rawName;
		if (attribution[attributionName] !== undefined) continue;

		attribution[attributionName] = value;
	}
}

/**
 * Extract user traits from customer data
 */
export function extractUserTraits(customer?: ShopifyCustomer): Record<string, unknown> {
	if (!customer) return {};

	const traits: Record<string, unknown> = {};

	if (customer.email) traits.email = customer.email;
	if (customer.phone) traits.phone = customer.phone;
	if (customer.first_name) traits.first_name = customer.first_name;
	if (customer.last_name) traits.last_name = customer.last_name;
	if (customer.id) traits.shopify_customer_id = String(customer.id);
	if (customer.created_at) traits.createdAt = customer.created_at;

	// Full name
	const nameParts = [customer.first_name, customer.last_name].filter(Boolean);
	if (nameParts.length > 0) {
		traits.name = nameParts.join(" ");
	}

	// Marketing preferences
	if (typeof customer.accepts_marketing === "boolean") {
		traits.acceptsMarketing = customer.accepts_marketing;
	}

	// Address from default_address
	if (customer.default_address) {
		const addr = extractAddress(customer.default_address);
		if (Object.keys(addr).length > 0) {
			traits.address = addr;
		}
	}

	return traits;
}

/**
 * Extract address in Segment format
 */
export function extractAddress(address?: ShopifyAddress): SegmentAddress {
	if (!address) return {};

	const result: SegmentAddress = {};

	if (address.address1) result.address_line_1 = address.address1;
	if (address.address2) result.address_line_2 = address.address2;
	if (address.city) result.city = address.city;
	if (address.province_code || address.province) {
		result.state = address.province_code || address.province;
	}
	if (address.zip) result.zip = address.zip;
	if (address.country_code || address.country) {
		result.country = address.country_code || address.country;
	}

	return result;
}

/**
 * Transform line items to Segment products
 */
export function extractProducts(
	lineItems: ShopifyLineItem[],
	currency: string,
	enrichment?: ShopifyEnrichmentResult
): SegmentProduct[] {
	return lineItems.map((item) => {
		const product: SegmentProduct = {
			product_id: String(item.product_id),
			name: item.title,
			price: parsePrice(item.price),
			quantity: item.quantity,
		};

		if (item.variant_id) {
			product.variant_id = String(item.variant_id);
		}
		if (item.sku) {
			product.sku = item.sku;
		}
		if (item.variant_title) {
			product.variant = item.variant_title;
		}
		if (item.vendor) {
			product.brand = item.vendor;
		}

		// Add enriched product image if available
		if (enrichment?.data.productImages[item.product_id]) {
			product.image_url = enrichment.data.productImages[item.product_id];
		}

		// Add enriched product collections if available
		const collections = enrichment?.data.productCollections?.[item.product_id];
		if (collections && collections.length > 0) {
			product.collections = collections.join(", ");
		}

		return product;
	});
}

/**
 * Extract attribution saved into Shopify cart/order attributes.
 *
 * Shopyflow can send attribution through cart attributes, which Shopify can
 * surface as either order note_attributes or line item properties depending on
 * the checkout path.
 */
export function extractAttribution(
	payload: ShopifyCheckoutPayload | ShopifyOrderPayload
): Record<string, unknown> {
	const attribution: Record<string, unknown> = {};

	addAttributionFromAttributes(attribution, payload.note_attributes);

	for (const lineItem of payload.line_items || []) {
		addAttributionFromAttributes(attribution, lineItem.properties);
	}

	return attribution;
}

/**
 * Extract coupon code from discount codes
 */
export function extractCoupon(discountCodes?: ShopifyDiscountCode[]): string | undefined {
	if (!discountCodes || discountCodes.length === 0) return undefined;
	return discountCodes.map((dc) => dc.code).join(", ");
}

/**
 * Determine user ID from payload
 * user_id is ALWAYS the email when available
 */
export function extractUserId(
	payload: ShopifyCheckoutPayload | ShopifyOrderPayload
): string | undefined {
	// user_id is always email
	if (payload.email) {
		return payload.email;
	}
	// Check customer email as fallback
	if (payload.customer?.email) {
		return payload.customer.email;
	}
	return undefined;
}

/**
 * Extract the frontend anonymous ID from note_attributes.
 */
function extractAnonymousIdFromAttributes(
	attributes?: Array<{ name?: string; key?: string; value?: unknown }>
): string | undefined {
	if (!attributes || !Array.isArray(attributes)) return undefined;
	const supportedNames = [
		"anonymousId",
		"anonymous_id",
		"segmentAnonymousId",
		"ajs_anonymous_id",
		"rudderAnonymousId",
	];

	for (const attribute of attributes) {
		const name = attribute.name || attribute.key;
		if (!name || !supportedNames.includes(name)) continue;

		const value = getAttributeValue(attribute.value);
		if (value) return value;
	}

	return undefined;
}

/**
 * Determine anonymous ID from payload
 * Priority: frontend anonymous ID from note_attributes, line item properties,
 * then checkout ID.
 */
export function extractAnonymousId(
	payload: ShopifyCheckoutPayload | ShopifyOrderPayload
): string {
	const noteAnonymousId = extractAnonymousIdFromAttributes(payload.note_attributes);
	if (noteAnonymousId) {
		return noteAnonymousId;
	}

	for (const lineItem of payload.line_items || []) {
		const lineAnonymousId = extractAnonymousIdFromAttributes(lineItem.properties);
		if (lineAnonymousId) return lineAnonymousId;
	}

	return String(payload.id);
}

/**
 * Calculate total value from payload
 */
export function extractValue(payload: ShopifyCheckoutPayload | ShopifyOrderPayload): number {
	return parsePrice(payload.total_price);
}

/**
 * Extract common context properties
 */
export function extractContext(
	payload: ShopifyCheckoutPayload | ShopifyOrderPayload,
	enrichment?: ShopifyEnrichmentResult
): Record<string, unknown> {
	const context: Record<string, unknown> = {
		integration: {
			name: "Shopify",
			version: "2026-04",
		},
	};
	const attribution = extractAttribution(payload);

	if (Object.keys(attribution).length > 0) {
		context.attribution = attribution;
	}

	// Page/campaign context from landing site
	if (payload.landing_site) {
		try {
			const url = new URL(payload.landing_site, "https://example.com");
			const campaign: Record<string, string> = {};

			const utmSource = url.searchParams.get("utm_source");
			const utmMedium = url.searchParams.get("utm_medium");
			const utmCampaign = url.searchParams.get("utm_campaign");
			const utmContent = url.searchParams.get("utm_content");
			const utmTerm = url.searchParams.get("utm_term");

			if (utmSource) campaign.source = utmSource;
			if (utmMedium) campaign.medium = utmMedium;
			if (utmCampaign) campaign.name = utmCampaign;
			if (utmContent) campaign.content = utmContent;
			if (utmTerm) campaign.term = utmTerm;

			if (Object.keys(campaign).length > 0) {
				context.campaign = campaign;
			}

			context.page = {
				url: payload.landing_site,
				path: url.pathname,
			};
		} catch {
			// Invalid URL, skip
		}
	}

	// Referrer
	if (payload.referring_site) {
		if (!context.page) context.page = {};
		(context.page as Record<string, string>).referrer = payload.referring_site;
	}

	// Enrichment metadata
	if (enrichment) {
		context.enrichment = {
			isNewCustomer: enrichment.data.isNewCustomer,
			customerOrderCount: enrichment.data.customerOrderCount,
			productImagesEnriched: Object.keys(enrichment.data.productImages).length,
			productCollectionsEnriched: Object.keys(enrichment.data.productCollections ?? {}).length,
			// Failure flags for debugging/alerting (enrichment is best-effort; events still send)
			failed: enrichment.failed,
		};
	}

	return context;
}

/**
 * Build traits for identify call
 */
export function buildIdentifyTraits(
	payload: ShopifyCheckoutPayload | ShopifyOrderPayload,
	enrichment?: ShopifyEnrichmentResult
): Record<string, unknown> {
	const traits = extractUserTraits(payload.customer);

	if (!traits.email && payload.email) {
		traits.email = payload.email;
	}
	if (!traits.phone && payload.phone) {
		traits.phone = payload.phone;
	}
	if (!traits.phone) {
		const phone = firstFilledValue(payload.billing_address?.phone, payload.shipping_address?.phone);
		if (phone) traits.phone = phone;
	}
	if (!traits.first_name) {
		const firstName = firstFilledValue(
			payload.billing_address?.first_name,
			payload.shipping_address?.first_name
		);
		if (firstName) traits.first_name = firstName;
	}
	if (!traits.last_name) {
		const lastName = firstFilledValue(
			payload.billing_address?.last_name,
			payload.shipping_address?.last_name
		);
		if (lastName) traits.last_name = lastName;
	}

	if (enrichment) {
		traits.isNewCustomer = enrichment.data.isNewCustomer;
		traits.orderCount = enrichment.data.customerOrderCount;
	}

	const address = mergeAddresses(
		extractAddress(payload.customer?.default_address),
		extractAddress(payload.shipping_address),
		extractAddress(payload.billing_address)
	);

	if (Object.keys(address).length > 0) {
		traits.address = address;
	}

	return traits;
}

export function buildContextWithTraits(
	context: Record<string, unknown>,
	traits: Record<string, unknown>
): Record<string, unknown> {
	const contextTraits: Record<string, unknown> = {};

	if (traits.email) contextTraits.email = traits.email;
	if (traits.phone) contextTraits.phone = traits.phone;
	if (traits.first_name) contextTraits.first_name = traits.first_name;
	if (traits.last_name) contextTraits.last_name = traits.last_name;
	if (traits.shopify_customer_id) contextTraits.shopify_customer_id = traits.shopify_customer_id;
	if (traits.address && typeof traits.address === "object") {
		contextTraits.address = traits.address;
	}

	const attribution = addGoogleApiCompliantAttribution(
		getRecord(context.attribution),
		contextTraits
	);

	return {
		...context,
		attribution,
		traits: contextTraits,
	};
}

function getRecord(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	return value as Record<string, unknown>;
}
