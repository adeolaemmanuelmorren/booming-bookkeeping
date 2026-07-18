/**
 * Handler for Shopify customers/create webhook
 * Transforms to Segment identify event
 */

import type { TopicHandler, ValidationResult } from "../../base";
import type { SegmentEvent } from "../../../types";
import type { ShopifyCustomerPayload } from "../types";
import type { ShopifyEnrichmentResult } from "../enricher";
import { extractUserTraits, extractAddress } from "../extractors";
import { generateUUID, isNonEmptyString } from "../../../utils";
import { LIBRARY_INFO, DEFAULT_INTEGRATIONS } from "../../../types";

/**
 * Validate customer payload
 */
function validateCustomer(payload: unknown): ValidationResult<ShopifyCustomerPayload> {
	if (!payload || typeof payload !== "object") {
		return { valid: false, error: "Payload must be an object" };
	}

	const p = payload as Record<string, unknown>;

	// Required fields
	if (!p.id) {
		return { valid: false, error: "Missing required field: id" };
	}

	// Must have either email or phone
	if (!isNonEmptyString(p.email) && !isNonEmptyString(p.phone)) {
		return { valid: false, error: "Customer must have email or phone" };
	}

	return { valid: true, data: payload as ShopifyCustomerPayload };
}

/**
 * Transform customer to Segment events
 */
function transformCustomer(
	payload: ShopifyCustomerPayload,
	enrichment?: ShopifyEnrichmentResult
): SegmentEvent[] {
	const events: SegmentEvent[] = [];

	// Only send identify if we have an email
	if (!payload.email) {
		return events;
	}

	const timestamp = payload.created_at || new Date().toISOString();

	// Build traits from customer data
	const traits: Record<string, unknown> = extractUserTraits(payload);

	// Additional customer-specific traits
	if (payload.verified_email !== undefined) {
		traits.emailVerified = payload.verified_email;
	}
	if (payload.tax_exempt !== undefined) {
		traits.taxExempt = payload.tax_exempt;
	}
	if (payload.tags) {
		traits.tags = payload.tags.split(",").map((t) => t.trim());
	}
	if (payload.note) {
		traits.note = payload.note;
	}

	// Total spent and orders count
	if (payload.total_spent) {
		traits.totalSpent = parseFloat(payload.total_spent);
	}
	if (payload.orders_count !== undefined) {
		traits.orderCount = payload.orders_count;
	}

	// All addresses
	if (payload.addresses && payload.addresses.length > 0) {
		traits.addresses = payload.addresses.map(extractAddress);
	}

	// Context
	const context: Record<string, unknown> = {
		library: LIBRARY_INFO,
		integration: {
			name: "Shopify",
			version: "2026-04",
		},
	};

	// Add enrichment data if available
	if (enrichment) {
		traits.isNewCustomer = enrichment.data.isNewCustomer;
		context.enrichment = {
			isNewCustomer: enrichment.data.isNewCustomer,
			customerOrderCount: enrichment.data.customerOrderCount,
		};
	}

	// Identify event
	events.push({
		type: "identify",
		userId: payload.email,
		traits,
		context,
		timestamp,
		messageId: generateUUID(),
		integrations: DEFAULT_INTEGRATIONS,
	});

	return events;
}

/**
 * Customer Created handler export
 */
export const customerCreatedHandler: TopicHandler<ShopifyCustomerPayload, ShopifyEnrichmentResult> = {
	validate: validateCustomer,
	transform: transformCustomer,
};
