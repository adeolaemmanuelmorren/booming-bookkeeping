/**
 * Handler for Shopify orders/fulfilled webhook
 * Transforms to Segment "Order Fulfilled" event
 */

import type { TopicHandler, ValidationResult } from "../../base";
import type { SegmentEvent } from "../../../types";
import type { ShopifyOrderPayload } from "../types";
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
import { generateEventId, isNonEmptyString, parsePrice } from "../../../utils";
import { LIBRARY_INFO, DEFAULT_INTEGRATIONS } from "../../../types";

/**
 * Validate order payload
 */
function validateOrder(payload: unknown): ValidationResult<ShopifyOrderPayload> {
	if (!payload || typeof payload !== "object") {
		return { valid: false, error: "Payload must be an object" };
	}

	const p = payload as Record<string, unknown>;

	// Required fields
	if (!p.id) {
		return { valid: false, error: "Missing required field: id" };
	}
	if (!p.order_number) {
		return { valid: false, error: "Missing required field: order_number" };
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

	return { valid: true, data: payload as ShopifyOrderPayload };
}

/**
 * Extract payment method from transactions
 */
function extractPaymentMethod(payload: ShopifyOrderPayload): string | undefined {
	if (!payload.transactions || payload.transactions.length === 0) {
		return undefined;
	}

	// Find the successful charge transaction
	const chargeTransaction = payload.transactions.find(
		(t) => t.kind === "sale" || t.kind === "capture"
	);

	if (chargeTransaction) {
		return chargeTransaction.gateway;
	}

	// Fall back to first transaction's gateway
	return payload.transactions[0].gateway;
}

/**
 * Extract shipping cost from payload
 */
function extractShipping(payload: ShopifyOrderPayload): number {
	if (payload.total_shipping_price_set?.shop_money) {
		return parsePrice(payload.total_shipping_price_set.shop_money.amount);
	}
	if (payload.shipping_lines && payload.shipping_lines.length > 0) {
		return payload.shipping_lines.reduce((sum, line) => sum + parsePrice(line.price), 0);
	}
	return 0;
}

/**
 * Transform fulfilled order to Segment events
 */
function transformOrder(
	payload: ShopifyOrderPayload,
	enrichment?: ShopifyEnrichmentResult
): SegmentEvent[] {
	const events: SegmentEvent[] = [];
	// Fulfillment happens after creation; updated_at is usually closest if present
	const timestamp = payload.updated_at || payload.processed_at || payload.created_at || new Date().toISOString();
	const userId = extractUserId(payload);
	const anonymousId = extractAnonymousId(payload);
	const context = extractContext(payload, enrichment);
	const baseId = String(payload.id);
	const identifyMessageId = generateEventId(baseId, "order_fulfilled_identify");
	const orderFulfilledMessageId = generateEventId(baseId, "order_fulfilled");
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

	// 2. Order Fulfilled track event
	const products = extractProducts(payload.line_items, payload.currency, enrichment);
	const coupon = extractCoupon(payload.discount_codes);
	const value = extractValue(payload);
	const shipping = extractShipping(payload);
	const tax = payload.total_tax ? parsePrice(payload.total_tax) : 0;
	const discount = payload.total_discounts ? parsePrice(payload.total_discounts) : 0;
	const subtotal = payload.subtotal_price ? parsePrice(payload.subtotal_price) : value - tax - shipping;
	const paymentMethod = extractPaymentMethod(payload);

	const trackProperties: Record<string, unknown> = {
		order_id: String(payload.order_number),
		checkout_id: payload.checkout_token || payload.id,
		total: value,
		revenue: value - tax - shipping, // Revenue excludes tax and shipping
		value,
		currency: payload.currency,
		products,
		subtotal,
		tax,
		shipping,
		discount,
	};

	// Optional properties
	if (coupon) trackProperties.coupon = coupon;
	if (paymentMethod) trackProperties.payment_method = paymentMethod;
	if (payload.name) trackProperties.order_name = payload.name;
	if (payload.fulfillment_status) trackProperties.fulfillment_status = payload.fulfillment_status;
	if (payload.financial_status) trackProperties.financial_status = payload.financial_status;

	// Add enrichment flags
	if (enrichment) {
		trackProperties.is_new_customer = enrichment.data.isNewCustomer;
		trackProperties.customer_order_count = enrichment.data.customerOrderCount;
	}

	events.push({
		type: "track",
		event: "Order Fulfilled",
		userId,
		anonymousId,
		properties: trackProperties,
		context: buildContextWithTraits(context, identifyTraits),
		timestamp,
		messageId: orderFulfilledMessageId ?? undefined,
		integrations: DEFAULT_INTEGRATIONS,
	});

	return events;
}

/**
 * Order Fulfilled handler export
 */
export const orderFulfilledHandler: TopicHandler<ShopifyOrderPayload, ShopifyEnrichmentResult> = {
	validate: validateOrder,
	transform: transformOrder,
};
