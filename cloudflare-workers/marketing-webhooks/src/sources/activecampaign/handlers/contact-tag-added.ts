/**
 * ActiveCampaign contact_tag_added webhook handler.
 */

import type { SegmentEvent } from "../../../types";
import { DEFAULT_INTEGRATIONS, LIBRARY_INFO } from "../../../types";
import { generateEventId, isNonEmptyString } from "../../../utils";
import type { TopicHandler, ValidationResult } from "../../base";
import type { ActiveCampaignEnrichmentResult } from "../enricher";
import {
	extractActiveCampaignAnonymousId,
	extractActiveCampaignIdentity,
	extractActiveCampaignTags,
} from "../extractors";
import type { ActiveCampaignContactTagAddedPayload } from "../types";

function validateContactTagAdded(
	payload: unknown
): ValidationResult<ActiveCampaignContactTagAddedPayload> {
	if (!payload || typeof payload !== "object") {
		return { valid: false, error: "Payload must be an object" };
	}

	const body = payload as Record<string, unknown>;
	if (body.type !== "contact_tag_added") {
		return { valid: false, error: "Expected type contact_tag_added" };
	}

	if (!isNonEmptyString(body.date_time)) {
		return { valid: false, error: "Missing required field: date_time" };
	}

	if (!isNonEmptyString(body.tag)) {
		return { valid: false, error: "Missing required field: tag" };
	}

	if (!body.contact || typeof body.contact !== "object") {
		return { valid: false, error: "Missing contact object" };
	}

	const contact = body.contact as Record<string, unknown>;
	if (!isNonEmptyString(contact.id)) {
		return { valid: false, error: "Missing required field: contact.id" };
	}

	return {
		valid: true,
		data: payload as ActiveCampaignContactTagAddedPayload,
	};
}

function buildTraits(
	payload: ActiveCampaignContactTagAddedPayload,
	enrichment?: ActiveCampaignEnrichmentResult
): Record<string, unknown> {
	const identity = extractActiveCampaignIdentity(payload, enrichment);
	const apiContact = enrichment?.data.contact;
	const traits: Record<string, unknown> = {
		activecampaign_contact_id: payload.contact.id,
		activecampaign_custom_fields: payload.contact.fields,
		tags: extractActiveCampaignTags(payload),
	};

	if (identity.email) traits.email = identity.email;
	if (identity.phone) traits.phone = identity.phone;
	if (identity.firstName) traits.first_name = identity.firstName;
	if (identity.lastName) traits.last_name = identity.lastName;
	if (identity.name) traits.name = identity.name;
	if (apiContact?.orgname || payload.contact.orgname) {
		traits.organization = apiContact?.orgname || payload.contact.orgname;
	}
	if (apiContact?.cdate) traits.activecampaign_created_at = apiContact.cdate;
	if (apiContact?.udate) traits.activecampaign_updated_at = apiContact.udate;

	return traits;
}

function buildContext(): Record<string, unknown> {
	return {
		library: LIBRARY_INFO,
		integration: {
			name: "ActiveCampaign",
			version: "v3",
		},
	};
}

function buildTrackContext(
	context: Record<string, unknown>,
	traits: Record<string, unknown>
): Record<string, unknown> {
	return { ...context, traits };
}

function getStableEventKey(payload: ActiveCampaignContactTagAddedPayload): string {
	return `${payload.contact.id}:${payload.date_time}:${payload.tag}`;
}

function transformContactTagAdded(
	payload: ActiveCampaignContactTagAddedPayload,
	enrichment?: ActiveCampaignEnrichmentResult
): SegmentEvent[] {
	const events: SegmentEvent[] = [];
	const identity = extractActiveCampaignIdentity(payload, enrichment);
	const anonymousId = extractActiveCampaignAnonymousId(payload) ?? undefined;
	const traits = buildTraits(payload, enrichment);
	const context = buildContext();
	const eventKey = getStableEventKey(payload);
	const tags = extractActiveCampaignTags(payload);
	const properties: Record<string, unknown> = {
		activecampaign_contact_id: payload.contact.id,
		tag: payload.tag,
		tags,
		initiated_from: payload.initiated_from,
		initiated_by: payload.initiated_by,
		list_id: payload.list,
		occurred_at: payload.date_time,
	};

	if (identity.email) properties.email = identity.email;
	if (identity.phone) properties.phone = identity.phone;
	if (identity.firstName) properties.first_name = identity.firstName;
	if (identity.lastName) properties.last_name = identity.lastName;
	if (identity.name) properties.name = identity.name;

	if (identity.email) {
		events.push({
			type: "identify",
			userId: identity.email,
			anonymousId,
			traits,
			context,
			timestamp: payload.date_time,
			messageId: generateEventId(eventKey, "activecampaign_identify") ?? undefined,
			integrations: DEFAULT_INTEGRATIONS,
		});
	}

	events.push({
		type: "track",
		event: "Contact Tag Added",
		userId: identity.email ?? undefined,
		anonymousId,
		properties,
		context: buildTrackContext(context, traits),
		timestamp: payload.date_time,
		messageId: generateEventId(eventKey, "activecampaign_contact_tag_added") ?? undefined,
		integrations: DEFAULT_INTEGRATIONS,
	});

	return events;
}

export const contactTagAddedHandler: TopicHandler<
	ActiveCampaignContactTagAddedPayload,
	ActiveCampaignEnrichmentResult
> = {
	validate: validateContactTagAdded,
	transform: transformContactTagAdded,
};
