/**
 * Extraction helpers for Webflow form submissions.
 */

import type { WebflowFormSubmissionPayload } from "./types";

const LEGACY_ATTRIBUTION_FIELD_NAMES = [
	"attribution_first",
	"attribution_last",
	"attribution_current",
] as const;

const TRACKING_FIELD_TO_ATTRIBUTION_NAME: Record<string, string> = {
	utm_source: "utm_source",
	utm_medium: "utm_medium",
	utm_campaign: "utm_campaign",
	utm_term: "utm_term",
	utm_content: "utm_content",
	utm_id: "utm_id",
	gclid: "gclid",
	fbclid: "fbclid",
	gbraid: "gbraid",
	wbraid: "wbraid",
	twclid: "twclid",
	ttclid: "ttclid",
	rdt_cid: "rdt_cid",
	li_fat_id: "li_fat_id",
	msclkid: "msclkid",
	_fbc: "fbc",
	_fbp: "fbp",
	_uetvid: "uetvid",
	_uetsid: "uetsid",
	_ttp: "ttp",
	_ttclid: "ttclid",
	_rdt_uuid: "rdt_uuid",
};

const TRACKING_FIELD_NAMES = new Set([
	...Object.keys(TRACKING_FIELD_TO_ATTRIBUTION_NAME),
	"ajs_anonymous_id",
	"ct_form_submission_id",
	...LEGACY_ATTRIBUTION_FIELD_NAMES,
]);

const EMAIL_FIELD_NAMES = ["email", "Email", "e-mail", "E-mail"];
const PHONE_FIELD_NAMES = ["phone", "Phone", "mobile", "Mobile", "phone_number", "Phone Number"];
const FIRST_NAME_FIELD_NAMES = ["first_name", "firstname", "firstName", "FirstName", "First Name"];
const LAST_NAME_FIELD_NAMES = ["last_name", "lastname", "lastName", "LastName", "Last Name"];
const NAME_FIELD_NAMES = ["name", "Name", "full_name", "Full Name", "fullName"];
const EMAIL_FIELD_KEYS = normalizedFieldSet(EMAIL_FIELD_NAMES);
const PHONE_FIELD_KEYS = normalizedFieldSet(PHONE_FIELD_NAMES);
const FIRST_NAME_FIELD_KEYS = normalizedFieldSet(FIRST_NAME_FIELD_NAMES);
const LAST_NAME_FIELD_KEYS = normalizedFieldSet(LAST_NAME_FIELD_NAMES);
const NAME_FIELD_KEYS = normalizedFieldSet(NAME_FIELD_NAMES);

const TOP_LEVEL_FORM_FIELD_NAMES = new Set([
	...EMAIL_FIELD_KEYS,
	...PHONE_FIELD_KEYS,
	...FIRST_NAME_FIELD_KEYS,
	...LAST_NAME_FIELD_KEYS,
	...NAME_FIELD_KEYS,
]);

function normalizeFormFieldName(name: string): string {
	return name
		.trim()
		.replace(/([a-z0-9])([A-Z])/g, "$1_$2")
		.replace(/[^A-Za-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.toLowerCase();
}

function normalizedFieldSet(names: string[]): Set<string> {
	return new Set(names.map(normalizeFormFieldName).filter(Boolean));
}

function getString(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;

	const trimmed = value.trim();
	if (!trimmed) return undefined;

	return trimmed;
}

function firstSubmittedString(data: Record<string, unknown>, fieldNames: Set<string>): string | undefined {
	for (const [name, submittedValue] of Object.entries(data)) {
		const normalizedName = normalizeFormFieldName(name);
		if (!fieldNames.has(normalizedName)) continue;

		const value = getString(submittedValue);
		if (value) return value;
	}

	return undefined;
}

function extractCurrentAttributionFromFields(data: Record<string, unknown>): Record<string, unknown> {
	const attribution: Record<string, unknown> = {};

	for (const [fieldName, attributionName] of Object.entries(TRACKING_FIELD_TO_ATTRIBUTION_NAME)) {
		const value = getString(data[fieldName]);
		if (!value) continue;

		attribution[attributionName] = value;
	}

	return attribution;
}

export function extractEmail(payload: WebflowFormSubmissionPayload): string | undefined {
	return firstSubmittedString(payload.payload.data, EMAIL_FIELD_KEYS);
}

export function extractPhone(payload: WebflowFormSubmissionPayload): string | undefined {
	return firstSubmittedString(payload.payload.data, PHONE_FIELD_KEYS);
}

export function extractFirstName(payload: WebflowFormSubmissionPayload): string | undefined {
	return firstSubmittedString(payload.payload.data, FIRST_NAME_FIELD_KEYS);
}

export function extractLastName(payload: WebflowFormSubmissionPayload): string | undefined {
	return firstSubmittedString(payload.payload.data, LAST_NAME_FIELD_KEYS);
}

export function extractName(payload: WebflowFormSubmissionPayload): string | undefined {
	return firstSubmittedString(payload.payload.data, NAME_FIELD_KEYS);
}

export function extractAnonymousId(payload: WebflowFormSubmissionPayload): string | undefined {
	return getString(payload.payload.data.ajs_anonymous_id);
}

export function extractFormSubmissionEventId(payload: WebflowFormSubmissionPayload): string | undefined {
	const formSubmissionId = getString(payload.payload.data.ct_form_submission_id);
	if (!formSubmissionId) return undefined;

	return createEventId("Form Submitted", formSubmissionId);
}

export function extractExtraSubmittedFields(payload: WebflowFormSubmissionPayload): Record<string, unknown> {
	const fields: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(payload.payload.data)) {
		const normalizedKey = normalizeFormFieldName(key);
		if (!normalizedKey) continue;
		if (TRACKING_FIELD_NAMES.has(key) || TRACKING_FIELD_NAMES.has(normalizedKey)) continue;
		if (TOP_LEVEL_FORM_FIELD_NAMES.has(normalizedKey)) continue;
		if (value === "") continue;
		if (value == null) continue;

		if (fields[normalizedKey] === undefined) {
			fields[normalizedKey] = value;
			continue;
		}

		if (!Array.isArray(fields[normalizedKey])) {
			fields[normalizedKey] = [fields[normalizedKey]];
		}

		(fields[normalizedKey] as unknown[]).push(value);
	}

	return fields;
}

export function extractAttribution(payload: WebflowFormSubmissionPayload): Record<string, unknown> {
	return extractCurrentAttributionFromFields(payload.payload.data);
}

export function extractPageContext(payload: WebflowFormSubmissionPayload): Record<string, unknown> | undefined {
	const pageUrl = getString(payload.payload.pageUrl);
	if (!pageUrl) return undefined;

	try {
		const url = new URL(pageUrl);
		return {
			url: pageUrl,
			path: url.pathname,
			search: url.search,
		};
	} catch {
		return { url: pageUrl };
	}
}

function createEventId(eventName: string, stableKey: string): string | undefined {
	const safeEventName = eventName.replace(/[^A-Za-z0-9]+/g, "").toLowerCase();
	const safeStableKey = stableKey.replace(/[^A-Za-z0-9]+/g, "").slice(-120);

	if (!safeEventName || !safeStableKey) return undefined;

	return ["ajs", safeEventName, safeStableKey].join("_");
}
