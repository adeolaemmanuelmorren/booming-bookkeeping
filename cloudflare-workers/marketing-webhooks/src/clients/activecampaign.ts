/**
 * ActiveCampaign API v3 client.
 */

import { createHttpClient } from "./http";
import type { ActiveCampaignApiContact } from "../sources/activecampaign/types";

export interface ActiveCampaignClientConfig {
	apiUrl: string;
	apiToken: string;
}

interface ActiveCampaignContactResponse {
	contact: ActiveCampaignApiContact;
}

function getApiBaseUrl(apiUrl: string): string {
	const baseUrl = apiUrl.replace(/\/+$/, "");
	if (baseUrl.endsWith("/api/3")) return baseUrl;

	return `${baseUrl}/api/3`;
}

export function createActiveCampaignClient(config: ActiveCampaignClientConfig) {
	const client = createHttpClient(getApiBaseUrl(config.apiUrl), {
		maxRetries: 3,
		baseDelayMs: 1000,
		headers: {
			Accept: "application/json",
			"Api-Token": config.apiToken,
		},
	});

	return {
		async getContact(contactId: string): Promise<ActiveCampaignApiContact | null> {
			const result = await client.get<ActiveCampaignContactResponse>(
				`/contacts/${encodeURIComponent(contactId)}`
			);

			if (result.error || !result.data?.contact) {
				console.error("[ActiveCampaign Client] Failed to fetch contact", {
					contactId,
					status: result.status,
					error: result.error,
				});
				return null;
			}

			return result.data.contact;
		},
	};
}

export type ActiveCampaignClient = ReturnType<typeof createActiveCampaignClient>;
