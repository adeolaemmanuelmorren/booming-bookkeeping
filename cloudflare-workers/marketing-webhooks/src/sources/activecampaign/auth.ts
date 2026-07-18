/**
 * Shared-secret authentication for ActiveCampaign provider webhooks.
 */

import { env } from "cloudflare:workers";
import type { MarketingWebhookEnv } from "../../types";

export const ACTIVE_CAMPAIGN_WEBHOOK_SECRET_HEADER =
	"X-ActiveCampaign-Webhook-Secret";

function isLocalRequest(request: Request): boolean {
	const hostname = new URL(request.url).hostname;
	return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function hasActiveCampaignWebhookSecret(
	request: Request,
	expectedSecret: string
): boolean {
	const receivedSecret = request.headers.get(
		ACTIVE_CAMPAIGN_WEBHOOK_SECRET_HEADER
	);

	return Boolean(receivedSecret) && receivedSecret === expectedSecret;
}

export function verifyActiveCampaignWebhookRequest(request: Request): boolean {
	if (isLocalRequest(request)) return true;

	const runtimeEnv = env as unknown as MarketingWebhookEnv;
	const expectedSecret = runtimeEnv.ACTIVE_CAMPAIGN_WEBHOOK_SECRET;
	if (!expectedSecret) {
		console.error("[ActiveCampaign Auth] Missing webhook secret configuration");
		return false;
	}

	return hasActiveCampaignWebhookSecret(request, expectedSecret);
}
