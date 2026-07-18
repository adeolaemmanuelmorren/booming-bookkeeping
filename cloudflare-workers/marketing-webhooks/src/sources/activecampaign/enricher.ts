/**
 * Fetches the authoritative contact record from ActiveCampaign API v3.
 */

import { env } from "cloudflare:workers";
import { createActiveCampaignClient } from "../../clients";
import type { MarketingWebhookEnv } from "../../types";
import type { EnrichmentResult, SourceEnricher } from "../base";
import type {
	ActiveCampaignApiContact,
	ActiveCampaignContactTagAddedPayload,
} from "./types";

export interface ActiveCampaignEnrichmentResult extends EnrichmentResult {
	data: {
		contact: ActiveCampaignApiContact | null;
	};
	failed: {
		contact: boolean;
	};
}

function getActiveCampaignCredentials(): {
	apiUrl: string | undefined;
	apiToken: string | undefined;
} {
	const envRecord = env as unknown as MarketingWebhookEnv;

	return {
		apiUrl: envRecord.ACTIVE_CAMPAIGN_API_URL,
		apiToken: envRecord.ACTIVE_CAMPAIGN_API_TOKEN,
	};
}

export const activeCampaignEnricher: SourceEnricher<
	ActiveCampaignContactTagAddedPayload,
	ActiveCampaignEnrichmentResult
> = {
	async enrich(
		payload: ActiveCampaignContactTagAddedPayload
	): Promise<ActiveCampaignEnrichmentResult> {
		const credentials = getActiveCampaignCredentials();
		if (!credentials.apiUrl || !credentials.apiToken) {
			console.error("[ActiveCampaign Enricher] Missing API configuration");
			return {
				data: { contact: null },
				failed: { contact: true },
			};
		}

		const client = createActiveCampaignClient({
			apiUrl: credentials.apiUrl,
			apiToken: credentials.apiToken,
		});
		const contact = await client.getContact(payload.contact.id);

		return {
			data: { contact },
			failed: { contact: !contact },
		};
	},
};
