/**
 * Marketing source registry
 *
 * Central registry for all marketing sources.
 * To add a new source, import it and add to the registry.
 */

import type { MarketingSource, EnrichmentResult } from "./base";
import { activeCampaignSource } from "./activecampaign";
import { shopifySource } from "./shopify";
import { webflowSource } from "./webflow";

/**
 * Registry of all marketing sources
 */
const sourceRegistry = new Map<string, MarketingSource<EnrichmentResult>>();

// Register Shopify source
sourceRegistry.set(shopifySource.name, shopifySource);
sourceRegistry.set(webflowSource.name, webflowSource);
sourceRegistry.set(activeCampaignSource.name, activeCampaignSource);

// Future sources can be added here:
// import { klaviyoSource } from './klaviyo';
// sourceRegistry.set(klaviyoSource.name, klaviyoSource);

/**
 * Get a source by name
 */
export function getSource(name: string): MarketingSource<EnrichmentResult> | undefined {
	return sourceRegistry.get(name);
}

/**
 * Check if a source exists
 */
export function hasSource(name: string): boolean {
	return sourceRegistry.has(name);
}

/**
 * Get all registered source names
 */
export function getSourceNames(): string[] {
	return Array.from(sourceRegistry.keys());
}

/**
 * Register a new source (for dynamic registration)
 */
export function registerSource(source: MarketingSource<EnrichmentResult>): void {
	sourceRegistry.set(source.name, source);
}

export { sourceRegistry };
