/**
 * Shopify Admin API enrichment
 *
 * Fetches additional data from Shopify Admin API:
 * - Product images + collections (single GraphQL batch request)
 * - Customer order count (to determine new vs returning)
 */

import { env } from "cloudflare:workers";
import type { MarketingWebhookEnv } from "../../types";
import type { EnrichmentResult, SourceEnricher } from "../base";
import { createHttpClient, httpRequest } from "../../clients";
import type {
	ShopifyAdminCustomer,
	ShopifyPayload,
	ShopifyLineItem,
} from "./types";

const SHOPIFY_ADMIN_API_VERSION = "2026-04";
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

let cachedAccessToken: string | null = null;
let cachedAccessTokenExpiresAt = 0;
let pendingAccessTokenRequest: Promise<string | null> | null = null;

/**
 * Shopify-specific enrichment result
 */
export interface ShopifyEnrichmentResult extends EnrichmentResult {
	data: {
		/** Map of product_id → image URL */
		productImages: Record<number, string>;

		/** Map of product_id → collection titles (0..N) */
		productCollections: Record<number, string[]>;

		/** Customer order count (0 if not found or error) */
		customerOrderCount: number;

		/** Whether this is a new customer (first order) */
		isNewCustomer: boolean;
	};
}

/**
 * Extract product IDs from line items
 */
function extractProductIds(payload: ShopifyPayload): number[] {
	if ("line_items" in payload && Array.isArray(payload.line_items)) {
		return [...new Set(payload.line_items.map((item: ShopifyLineItem) => item.product_id))];
	}
	return [];
}

/**
 * Extract customer ID from payload
 */
function extractCustomerId(payload: ShopifyPayload): number | null {
	if ("customer" in payload && payload.customer?.id) {
		return payload.customer.id;
	}
	// Customer payload has id directly
	if ("id" in payload && "orders_count" in payload) {
		return payload.id;
	}
	return null;
}

/**
 * Shopify Admin GraphQL API helpers
 */
type ShopifyGraphQLError = { message: string };
type ShopifyGraphQLResponse<TData> = {
	data?: TData;
	errors?: ShopifyGraphQLError[];
};

type ShopifyProductCatalogQueryData = {
	nodes: Array<
		| null
		| {
				id: string;
				featuredImage?: {
					url: string;
				} | null;
				images?: {
					nodes: Array<{
						url: string;
					}>;
				} | null;
				collections: {
					nodes: Array<{
						title: string;
					}>;
				};
		  }
	>;
};

function shopifyProductGid(productId: number): string {
	return `gid://shopify/Product/${productId}`;
}

function parseNumericIdFromGid(gid: string): number | null {
	// Example: gid://shopify/Product/123456789
	const last = gid.split("/").pop();
	if (!last) return null;
	const parsed = Number.parseInt(last, 10);
	return Number.isFinite(parsed) ? parsed : null;
}

function getShopifyCredentials(): {
	storeDomain: string | undefined;
	clientId: string | undefined;
	clientSecret: string | undefined;
} {
	const envRecord = env as unknown as MarketingWebhookEnv;

	return {
		storeDomain: envRecord.SHOPIFY_STORE_DOMAIN,
		clientId: envRecord.SHOPIFY_CLIENT_ID,
		clientSecret: envRecord.SHOPIFY_CLIENT_SECRET,
	};
}

type ShopifyAccessTokenResponse = {
	access_token: string;
	scope?: string;
	expires_in?: number;
};

function isCachedAccessTokenUsable(): boolean {
	if (!cachedAccessToken) return false;
	return Date.now() + TOKEN_REFRESH_BUFFER_MS < cachedAccessTokenExpiresAt;
}

async function requestAccessToken(credentials: {
	storeDomain: string;
	clientId: string;
	clientSecret: string;
}): Promise<string | null> {
	const body = new URLSearchParams({
		grant_type: "client_credentials",
		client_id: credentials.clientId,
		client_secret: credentials.clientSecret,
	});

	const result = await httpRequest<ShopifyAccessTokenResponse>(
		`https://${credentials.storeDomain}/admin/oauth/access_token`,
		{
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body,
			config: {
				maxRetries: 3,
				baseDelayMs: 500,
			},
		}
	);

	if (result.error || !result.data?.access_token) {
		console.error("[Shopify Enricher] Failed to fetch access token:", result.error);
		return null;
	}

	const expiresInSeconds = result.data.expires_in ?? 24 * 60 * 60;
	cachedAccessToken = result.data.access_token;
	cachedAccessTokenExpiresAt = Date.now() + expiresInSeconds * 1000;

	return cachedAccessToken;
}

async function getShopifyAccessToken(): Promise<string | null> {
	const credentials = getShopifyCredentials();
	if (!credentials.storeDomain || !credentials.clientId || !credentials.clientSecret) {
		return null;
	}

	if (isCachedAccessTokenUsable()) {
		return cachedAccessToken;
	}

	if (!pendingAccessTokenRequest) {
		pendingAccessTokenRequest = requestAccessToken({
			storeDomain: credentials.storeDomain,
			clientId: credentials.clientId,
			clientSecret: credentials.clientSecret,
		}).finally(() => {
			pendingAccessTokenRequest = null;
		});
	}

	return pendingAccessTokenRequest;
}

/**
 * Fetch product images and collections (titles) from Shopify Admin GraphQL API
 * Uses a single query with nodes(ids: [...]) for batch efficiency.
 */
async function fetchProductCatalog(
	productIds: number[]
): Promise<{
	images: Record<number, string>;
	collections: Record<number, string[]>;
	failed: boolean;
}> {
	const credentials = getShopifyCredentials();
	if (productIds.length === 0 || !credentials.storeDomain) {
		return { images: {}, collections: {}, failed: false };
	}

	const accessToken = await getShopifyAccessToken();
	if (!accessToken) {
		return { images: {}, collections: {}, failed: true };
	}

	const client = createHttpClient(`https://${credentials.storeDomain}`, {
		maxRetries: 3,
		baseDelayMs: 500,
		headers: {
			"X-Shopify-Access-Token": accessToken,
			"Content-Type": "application/json",
		},
	});

	const query = `
		query ProductCatalog($ids: [ID!]!) {
			nodes(ids: $ids) {
				... on Product {
					id
					featuredImage {
						url
					}
					images(first: 1) {
						nodes {
							url
						}
					}
					collections(first: 10) {
						nodes {
							title
						}
					}
				}
			}
		}
	`;

	const variables = {
		ids: productIds.map(shopifyProductGid),
	};

	const result = await client.post<ShopifyGraphQLResponse<ShopifyProductCatalogQueryData>>(
		`/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`,
		{ query, variables }
	);

	if (result.error || !result.data) {
		console.error("[Shopify Enricher] Failed to fetch product catalog:", result.error);
		return { images: {}, collections: {}, failed: true };
	}

	if (result.data.errors && result.data.errors.length > 0) {
		console.error("[Shopify Enricher] GraphQL errors fetching product catalog:", result.data.errors);
		return { images: {}, collections: {}, failed: true };
	}

	const images: Record<number, string> = {};
	const collections: Record<number, string[]> = {};
	const nodes = result.data.data?.nodes ?? [];
	for (const node of nodes) {
		if (!node) continue;
		const numericId = parseNumericIdFromGid(node.id);
		if (!numericId) continue;

		const imageUrl =
			node.featuredImage?.url ||
			(node.images?.nodes && node.images.nodes.length > 0 ? node.images.nodes[0].url : null);
		if (imageUrl) {
			images[numericId] = imageUrl;
		}

		const titles =
			node.collections?.nodes
				?.map((c) => c.title)
				.filter((t): t is string => typeof t === "string" && t.length > 0) ?? [];

		if (titles.length > 0) {
			collections[numericId] = titles;
		}
	}

	return { images, collections, failed: false };
}

/**
 * Fetch customer order count from Shopify Admin API
 * GET /admin/api/{version}/customers/{id}.json?fields=id,orders_count,total_spent
 */
async function fetchCustomerOrderCount(
	customerId: number
): Promise<{ orderCount: number; failed: boolean }> {
	const credentials = getShopifyCredentials();
	if (!credentials.storeDomain) {
		return { orderCount: 0, failed: false };
	}

	const accessToken = await getShopifyAccessToken();
	if (!accessToken) {
		return { orderCount: 0, failed: true };
	}

	const client = createHttpClient(`https://${credentials.storeDomain}`, {
		maxRetries: 3,
		baseDelayMs: 500,
		headers: {
			"X-Shopify-Access-Token": accessToken,
			"Content-Type": "application/json",
		},
	});

	const result = await client.get<{ customer: ShopifyAdminCustomer }>(
		`/admin/api/${SHOPIFY_ADMIN_API_VERSION}/customers/${customerId}.json?fields=id,orders_count,total_spent`
	);

	if (result.error || !result.data) {
		console.error("[Shopify Enricher] Failed to fetch customer:", result.error);
		return { orderCount: 0, failed: true };
	}

	return {
		orderCount: result.data.customer.orders_count,
		failed: false,
	};
}

/**
 * Shopify enricher implementation
 */
export const shopifyEnricher: SourceEnricher<ShopifyPayload, ShopifyEnrichmentResult> = {
	async enrich(payload: ShopifyPayload): Promise<ShopifyEnrichmentResult> {
		// Run enrichment requests in parallel
		const productIds = extractProductIds(payload);
		const customerId = extractCustomerId(payload);

		const [catalogResult, customerResult] = await Promise.all([
			fetchProductCatalog(productIds),
			customerId
				? fetchCustomerOrderCount(customerId)
				: Promise.resolve({ orderCount: 0, failed: false }),
		]);

		// For order payloads, the order_count in the API response is BEFORE this order
		// So if orders_count is 0, this is their first order (new customer)
		// But if we're processing orders/paid, the count already includes this order
		// We need to check if this is a checkout vs order payload
		const isOrderPayload = "order_number" in payload;
		const orderCount = customerResult.orderCount;

		// For orders/paid: if orderCount === 1, this was their first order
		// For checkouts: if orderCount === 0, this will be their first order
		const isNewCustomer = isOrderPayload ? orderCount <= 1 : orderCount === 0;

		return {
			data: {
				productImages: catalogResult.images,
				productCollections: catalogResult.collections,
				customerOrderCount: orderCount,
				isNewCustomer,
			},
			failed: {
				productImages: catalogResult.failed,
				productCollections: catalogResult.failed,
				customerOrderCount: customerResult.failed,
			},
		};
	},
};
