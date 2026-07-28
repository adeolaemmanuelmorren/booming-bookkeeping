/**
 * Worker runtime values that are not emitted by Wrangler type generation.
 * Cloudflare bindings and committed vars remain on the generated global Env.
 */

export interface MarketingWebhookRuntimeConfig {
	ACTIVE_CAMPAIGN_API_URL?: string;
	ACTIVE_CAMPAIGN_API_TOKEN?: string;
	ACTIVE_CAMPAIGN_SEGMENT_ANONYMOUS_ID_FIELD_IDS?: string;
	ENABLE_TEST_ENDPOINTS?: string;
	SEGMENT_WRITE_KEY?: string;
	SHOPIFY_STORE_DOMAIN?: string;
	SHOPIFY_CLIENT_ID?: string;
	SHOPIFY_CLIENT_SECRET?: string;
	TEST_ENDPOINT_TOKEN?: string;
}

export type MarketingWebhookEnv = Env & MarketingWebhookRuntimeConfig;
