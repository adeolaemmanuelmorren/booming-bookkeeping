/**
 * Handler for Webflow form_submission webhook.
 */

import type { TopicHandler, ValidationResult } from "../../base";
import type { SegmentEvent } from "../../../types";
import { DEFAULT_INTEGRATIONS, LIBRARY_INFO } from "../../../types";
import { addGoogleApiCompliantAttribution, generateEventId, isNonEmptyString } from "../../../utils";
import type { WebflowFormSubmissionPayload } from "../types";
import {
	extractAnonymousId,
	extractAttribution,
	extractEmail,
	extractExtraSubmittedFields,
	extractFormSubmissionEventId,
	extractFirstName,
	extractLastName,
	extractName,
	extractPageContext,
	extractPhone,
} from "../extractors";

function validateFormSubmission(payload: unknown): ValidationResult<WebflowFormSubmissionPayload> {
	if (!payload || typeof payload !== "object") {
		return { valid: false, error: "Payload must be an object" };
	}

	const body = payload as Record<string, unknown>;
	if (body.triggerType !== "form_submission") {
		return { valid: false, error: "Expected triggerType form_submission" };
	}

	if (!body.payload || typeof body.payload !== "object") {
		return { valid: false, error: "Missing payload object" };
	}

	const formPayload = body.payload as Record<string, unknown>;
	if (!isNonEmptyString(formPayload.id)) {
		return { valid: false, error: "Missing required field: payload.id" };
	}

	if (!isNonEmptyString(formPayload.name)) {
		return { valid: false, error: "Missing required field: payload.name" };
	}

	if (!isNonEmptyString(formPayload.submittedAt)) {
		return { valid: false, error: "Missing required field: payload.submittedAt" };
	}

	if (!formPayload.data || typeof formPayload.data !== "object" || Array.isArray(formPayload.data)) {
		return { valid: false, error: "Missing required field: payload.data" };
	}

	return { valid: true, data: payload as WebflowFormSubmissionPayload };
}

function buildContext(
	payload: WebflowFormSubmissionPayload,
	traits: Record<string, unknown>
): Record<string, unknown> {
	const context: Record<string, unknown> = {
		library: LIBRARY_INFO,
		integration: {
			name: "Webflow",
			version: "v2",
		},
	};
	const page = extractPageContext(payload);
	const attribution = extractAttribution(payload);

	if (page) {
		context.page = page;
	}

	context.attribution = addGoogleApiCompliantAttribution(attribution, traits);

	return context;
}

function buildIdentifyTraits(payload: WebflowFormSubmissionPayload): Record<string, unknown> {
	const traits: Record<string, unknown> = {};
	const email = extractEmail(payload);
	const phone = extractPhone(payload);
	const firstName = extractFirstName(payload);
	const lastName = extractLastName(payload);
	const name = extractName(payload);

	if (email) traits.email = email;
	if (phone) traits.phone = phone;
	if (firstName) traits.first_name = firstName;
	if (lastName) traits.last_name = lastName;
	if (name) traits.name = name;

	return traits;
}

function buildTrackContext(
	context: Record<string, unknown>,
	traits: Record<string, unknown>
): Record<string, unknown> {
	if (Object.keys(traits).length === 0) return context;

	return {
		...context,
		traits,
	};
}

function transformFormSubmission(payload: WebflowFormSubmissionPayload): SegmentEvent[] {
	const events: SegmentEvent[] = [];
	const email = extractEmail(payload);
	const phone = extractPhone(payload);
	const firstName = extractFirstName(payload);
	const lastName = extractLastName(payload);
	const name = extractName(payload);
	const anonymousId = extractAnonymousId(payload);
	const timestamp = payload.payload.submittedAt;
	const traits = buildIdentifyTraits(payload);
	const context = buildContext(payload, traits);
	const formSubmissionId = payload.payload.id;
	const eventId = extractFormSubmissionEventId(payload);
	const properties: Record<string, unknown> = {
		form_submission_id: formSubmissionId,
		form_name: payload.payload.name,
		form_id: payload.payload.formId,
		form_element_id: payload.payload.formElementId,
		site_id: payload.payload.siteId,
		page_id: payload.payload.pageId,
		published_path: payload.payload.publishedPath,
		page_url: payload.payload.pageUrl,
		submitted_at: timestamp,
		extra_submitted_fields: extractExtraSubmittedFields(payload),
	};

	if (eventId) properties.event_id = eventId;
	if (email) properties.email = email;
	if (phone) properties.phone = phone;
	if (firstName) properties.first_name = firstName;
	if (lastName) properties.last_name = lastName;
	if (name) properties.name = name;

	if (email) {
		events.push({
			type: "identify",
			userId: email,
			anonymousId,
			traits,
			context,
			timestamp,
			messageId: generateEventId(formSubmissionId, "webflow_form_submission_identify") ?? undefined,
			integrations: DEFAULT_INTEGRATIONS,
		});
	}

	events.push({
		type: "track",
		event: "Form Submitted",
		userId: email,
		anonymousId,
		properties,
		context: buildTrackContext(context, traits),
		timestamp,
		messageId: generateEventId(formSubmissionId, "webflow_form_submission") ?? undefined,
		integrations: DEFAULT_INTEGRATIONS,
	});

	return events;
}

export const formSubmissionHandler: TopicHandler<WebflowFormSubmissionPayload> = {
	validate: validateFormSubmission,
	transform: transformFormSubmission,
};
