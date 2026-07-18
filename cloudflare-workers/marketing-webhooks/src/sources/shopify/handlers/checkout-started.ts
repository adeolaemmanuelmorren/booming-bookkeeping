/**
 * Handler for Shopify checkouts/create webhook
 * Transforms to Segment "Checkout Started" event
 */

import type { TopicHandler, ValidationResult } from "../../base";
import type { SegmentEvent } from "../../../types";
import type { ShopifyCheckoutPayload } from "../types";
import type { ShopifyEnrichmentResult } from "../enricher";
import {
	extractUserId,
	extractAnonymousId,
	extractProducts,
	extractCoupon,
	extractValue,
	extractContext,
	buildIdentifyTraits,
	buildContextWithTraits,
} from "../extractors";
import { generateEventId, isNonEmptyString } from "../../../utils";
import { LIBRARY_INFO, DEFAULT_INTEGRATIONS } from "../../../types";

/**
 * Validate checkout payload
 */
function validateCheckout(payload: unknown): ValidationResult<ShopifyCheckoutPayload> {
	if (!payload || typeof payload !== "object") {
		return { valid: false, error: "Payload must be an object" };
	}

	const p = payload as Record<string, unknown>;

	// Required fields
	if (!p.id) {
		return { valid: false, error: "Missing required field: id" };
	}
	if (!p.token) {
		return { valid: false, error: "Missing required field: token" };
	}
	if (!Array.isArray(p.line_items)) {
		return { valid: false, error: "Missing or invalid line_items array" };
	}
	if (!isNonEmptyString(p.total_price)) {
		return { valid: false, error: "Missing required field: total_price" };
	}
	if (!isNonEmptyString(p.currency)) {
		return { valid: false, error: "Missing required field: currency" };
	}

	return { valid: true, data: payload as ShopifyCheckoutPayload };
}

/**
 * Transform checkout to Segment events
 */
function transformCheckout(
	payload: ShopifyCheckoutPayload,
	enrichment?: ShopifyEnrichmentResult
): SegmentEvent[] {
	const events: SegmentEvent[] = [];
	const timestamp = payload.created_at || new Date().toISOString();
	const userId = extractUserId(payload);
	const anonymousId = extractAnonymousId(payload);
	const context = extractContext(payload, enrichment);
	const baseId = String(payload.id);
	const identifyMessageId = generateEventId(baseId, "checkout_started_identify");
	const checkoutStartedMessageId = generateEventId(baseId, "checkout_started");
	const identifyTraits = buildIdentifyTraits(payload, enrichment);
	const identifyUserId = typeof identifyTraits.email === "string" ? identifyTraits.email : userId;

	// Add library info to context
	context.library = LIBRARY_INFO;

	// 1. Identify event (only if we have a user ID)
	if (identifyUserId) {
		events.push({
			type: "identify",
			userId: identifyUserId,
			anonymousId,
			traits: identifyTraits,
			context,
			timestamp,
			messageId: identifyMessageId ?? undefined,
			integrations: DEFAULT_INTEGRATIONS,
		});
	}

	// 2. Checkout Started track event
	const products = extractProducts(payload.line_items, payload.currency, enrichment);
	const coupon = extractCoupon(payload.discount_codes);
	const value = extractValue(payload);

	const trackProperties: Record<string, unknown> = {
		checkout_id: String(payload.id),
		order_id: payload.token, // Token serves as order reference until actual order
		value,
		revenue: value,
		currency: payload.currency,
		products,
	};

	// Optional properties
	if (coupon) trackProperties.coupon = coupon;
	if (payload.total_discounts) {
		trackProperties.discount = parseFloat(payload.total_discounts);
	}
	if (payload.total_tax) {
		trackProperties.tax = parseFloat(payload.total_tax);
	}
	if (payload.subtotal_price) {
		trackProperties.subtotal = parseFloat(payload.subtotal_price);
	}

	// Add abandoned checkout URL if available
	if (payload.abandoned_checkout_url) {
		trackProperties.abandoned_checkout_url = payload.abandoned_checkout_url;
	}

	// Add enrichment flags
	if (enrichment) {
		trackProperties.is_new_customer = enrichment.data.isNewCustomer;
		trackProperties.customer_order_count = enrichment.data.customerOrderCount;
	}

	events.push({
		type: "track",
		event: "Checkout Started",
		userId,
		anonymousId,
		properties: trackProperties,
		context: buildContextWithTraits(context, identifyTraits),
		timestamp,
		messageId: checkoutStartedMessageId ?? undefined,
		integrations: DEFAULT_INTEGRATIONS,
	});

	return events;
}

/**
 * Checkout Started handler export
 */
export const checkoutStartedHandler: TopicHandler<ShopifyCheckoutPayload, ShopifyEnrichmentResult> = {
	validate: validateCheckout,
	transform: transformCheckout,
};
