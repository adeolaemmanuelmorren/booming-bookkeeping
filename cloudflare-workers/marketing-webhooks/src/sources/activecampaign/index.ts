/**
 * ActiveCampaign marketing source.
 */

import type { MarketingSource, TopicHandler } from "../base";
import { verifyActiveCampaignWebhookRequest } from "./auth";
import type { ActiveCampaignEnrichmentResult } from "./enricher";
import { activeCampaignEnricher } from "./enricher";
import { contactTagAddedHandler } from "./handlers";
import { parseActiveCampaignWebhookRequest } from "./parser";

export * from "./types";
export * from "./auth";
export * from "./parser";
export * from "./extractors";
export * from "./enricher";

const handlers = new Map<
	string,
	TopicHandler<unknown, ActiveCampaignEnrichmentResult>
>([["contact_tag_added", contactTagAddedHandler]]);

export const activeCampaignSource: MarketingSource<ActiveCampaignEnrichmentResult> = {
	name: "activecampaign",
	verifyRequest: verifyActiveCampaignWebhookRequest,
	parsePayload: parseActiveCampaignWebhookRequest,
	handlers,
	enricher: activeCampaignEnricher,
	rateLimits: {
		requestsPerSecond: 4,
		retryDelayMs: 1000,
		maxRetries: 3,
	},
	extractTopic(_headers: Record<string, string>, payload?: unknown): string | null {
		if (!payload || typeof payload !== "object") return null;

		const type = (payload as Record<string, unknown>).type;
		return typeof type === "string" && type.length > 0 ? type : null;
	},
};
