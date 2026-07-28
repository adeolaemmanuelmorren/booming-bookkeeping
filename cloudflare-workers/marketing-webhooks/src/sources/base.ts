/**
 * Base interfaces for marketing source plugins
 *
 * This defines the contract that all marketing sources must implement.
 * Adding a new source (e.g., Klaviyo, Facebook) means implementing these interfaces.
 */

import { env } from "cloudflare:workers";
import type { SegmentEvent } from "../types";

/**
 * Result of validating a webhook payload
 */
export interface ValidationResult<T = unknown> {
	valid: boolean;
	data?: T;
	error?: string;
}

/**
 * Result of enriching a payload with external API data
 */
export interface EnrichmentResult {
	/** Enrichment data (source-specific structure) */
	data: Record<string, unknown>;

	/** Whether any enrichment request failed */
	failed: {
		[key: string]: boolean;
	};
}

/**
 * Handler for a specific webhook topic/event type
 *
 * Each topic (e.g., 'orders/paid', 'checkouts/create') has its own handler
 * that knows how to validate and transform that specific payload.
 */
export interface TopicHandler<TPayload = unknown, TEnrichment = EnrichmentResult> {
	/**
	 * Validate the incoming webhook payload
	 * Called before queuing to reject invalid payloads early
	 */
	validate(payload: unknown): ValidationResult<TPayload>;

	/**
	 * Transform the validated payload to Segment events
	 * Called by the queue consumer after enrichment
	 */
	transform(payload: TPayload, enrichment?: TEnrichment): SegmentEvent[];
}

/**
 * Enricher for fetching additional data from source's API
 *
 * For example, Shopify enricher fetches product images and customer order count.
 * Not all sources need enrichment.
 */
export interface SourceEnricher<TPayload = unknown, TEnrichment = EnrichmentResult> {
	/**
	 * Fetch additional data from the source's API
	 * Should be fail-safe - return partial data on failure
	 * Uses env from "cloudflare:workers" import
	 */
	enrich(payload: TPayload): Promise<TEnrichment>;
}

/**
 * Rate limit configuration for source APIs
 */
export interface RateLimitConfig {
	/** Maximum requests per second */
	requestsPerSecond: number;

	/** Base delay for retry backoff (ms) */
	retryDelayMs: number;

	/** Maximum retry attempts */
	maxRetries: number;
}

/**
 * Marketing source definition
 *
 * This is the main plugin interface. Each marketing source (Shopify, Klaviyo, etc.)
 * must export an object implementing this interface.
 */
export interface MarketingSource<TEnrichment = EnrichmentResult> {
	/** Source identifier (e.g., 'shopify', 'klaviyo') */
	name: string;

	/**
	 * Optional provider-specific request parser.
	 * JSON sources use the ingestion handler's default parser.
	 */
	parsePayload?(request: Request): Promise<unknown>;

	/**
	 * Map of topic → handler
	 * Topic is the webhook event type (e.g., 'checkouts/create', 'orders/paid')
	 */
	handlers: Map<string, TopicHandler<unknown, TEnrichment>>;

	/**
	 * Optional enricher for fetching additional data from source API
	 */
	enricher?: SourceEnricher<unknown, TEnrichment>;

	/**
	 * Rate limit configuration for the source's API
	 */
	rateLimits?: RateLimitConfig;

	/**
	 * Extract topic from request headers or payload (source-specific).
	 * Default implementation looks for standard header patterns.
	 */
	extractTopic?(headers: Record<string, string>, payload?: unknown): string | null;
}

/**
 * Default topic extraction from common header patterns
 */
export function defaultExtractTopic(headers: Record<string, string>): string | null {
	// Shopify: x-shopify-topic
	const shopifyTopic = headers["x-shopify-topic"] || headers["X-Shopify-Topic"];
	if (shopifyTopic) return shopifyTopic;

	// Generic: x-webhook-topic
	const genericTopic = headers["x-webhook-topic"] || headers["X-Webhook-Topic"];
	if (genericTopic) return genericTopic;

	return null;
}
