/**
 * Identity extraction for ActiveCampaign webhook events.
 */

import { env } from "cloudflare:workers";
import type { MarketingWebhookEnv } from "../../types";
import { firstOf } from "../../utils";
import type { ActiveCampaignEnrichmentResult } from "./enricher";
import type { ActiveCampaignContactTagAddedPayload } from "./types";

const DEFAULT_ANONYMOUS_ID_FIELD_IDS = ["39"];

function getAnonymousIdFieldIds(): string[] {
	const envRecord = env as unknown as MarketingWebhookEnv;
	const configuredIds = envRecord.ACTIVE_CAMPAIGN_SEGMENT_ANONYMOUS_ID_FIELD_IDS;
	if (!configuredIds) return DEFAULT_ANONYMOUS_ID_FIELD_IDS;

	const ids = configuredIds
		.split(",")
		.map((id) => id.trim())
		.filter(Boolean);

	return ids.length > 0 ? ids : DEFAULT_ANONYMOUS_ID_FIELD_IDS;
}

export function extractActiveCampaignIdentity(
	payload: ActiveCampaignContactTagAddedPayload,
	enrichment?: ActiveCampaignEnrichmentResult
): {
	email: string | null;
	phone: string | null;
	firstName: string | null;
	lastName: string | null;
	name: string | null;
} {
	const apiContact = enrichment?.data.contact;
	const email = firstOf(apiContact?.email, payload.contact.email);
	const phone = firstOf(apiContact?.phone, payload.contact.phone);
	const firstName = firstOf(apiContact?.firstName, payload.contact.first_name);
	const lastName = firstOf(apiContact?.lastName, payload.contact.last_name);
	const name = [firstName, lastName].filter(Boolean).join(" ") || null;

	return { email, phone, firstName, lastName, name };
}

export function extractActiveCampaignAnonymousId(
	payload: ActiveCampaignContactTagAddedPayload
): string | null {
	for (const fieldId of getAnonymousIdFieldIds()) {
		const value = payload.contact.fields[fieldId];
		if (value?.trim()) return value.trim();
	}

	return null;
}

export function extractActiveCampaignTags(
	payload: ActiveCampaignContactTagAddedPayload
): string[] {
	if (!payload.contact.tags) return [];

	return payload.contact.tags
		.split(",")
		.map((tag) => tag.trim())
		.filter(Boolean);
}
