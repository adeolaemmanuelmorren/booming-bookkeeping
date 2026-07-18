/**
 * Shopify marketing source
 *
 * Handles Shopify webhooks and transforms them to Segment events.
 */

import type { MarketingSource, TopicHandler } from "../base";
import type { ShopifyEnrichmentResult } from "./enricher";
import { shopifyEnricher } from "./enricher";
import {
	checkoutStartedHandler,
	orderPaidHandler,
	orderFulfilledHandler,
	customerCreatedHandler,
} from "./handlers";

// Re-export types and utilities
export * from "./types";
export * from "./enricher";
export * from "./extractors";

/**
 * Topic to handler mapping
 *
 * Topics use Shopify's format: "resource/action"
 * e.g., "checkouts/create", "orders/paid"
 */
const handlers = new Map<string, TopicHandler<unknown, ShopifyEnrichmentResult>>([
	["checkouts/create", checkoutStartedHandler],
	["orders/paid", orderPaidHandler],
	["orders/fulfilled", orderFulfilledHandler],
	["customers/create", customerCreatedHandler],
	["customers/update", customerCreatedHandler], // Same handler for updates
]);

/**
 * Shopify marketing source definition
 */
export const shopifySource: MarketingSource<ShopifyEnrichmentResult> = {
	name: "shopify",

	handlers,

	enricher: shopifyEnricher,

	// Shopify Admin API rate limits: 40 requests per app per store per minute
	// We're conservative here
	rateLimits: {
		requestsPerSecond: 2,
		retryDelayMs: 1000,
		maxRetries: 3,
	},

	/**
	 * Extract topic from Shopify webhook headers
	 */
	extractTopic(headers: Record<string, string>): string | null {
		// Shopify sends topic in X-Shopify-Topic header
		const topic =
			headers["x-shopify-topic"] ||
			headers["X-Shopify-Topic"] ||
			headers["X-SHOPIFY-TOPIC"];

		return topic || null;
	},
};
