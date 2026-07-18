/**
 * Parser for ActiveCampaign's application/x-www-form-urlencoded webhooks.
 */

import type { ActiveCampaignContactTagAddedPayload } from "./types";

const CONTACT_FIELD_PATTERN = /^contact\[fields\]\[([^\]]+)\]$/;

function getContactFields(params: URLSearchParams): Record<string, string> {
	const fields: Record<string, string> = {};

	for (const [key, value] of params.entries()) {
		const match = key.match(CONTACT_FIELD_PATTERN);
		if (!match) continue;

		fields[match[1]] = value;
	}

	return fields;
}

export function parseActiveCampaignWebhookBody(
	body: string
): ActiveCampaignContactTagAddedPayload {
	return parseActiveCampaignWebhookParams(new URLSearchParams(body));
}

function parseActiveCampaignWebhookParams(
	params: URLSearchParams
): ActiveCampaignContactTagAddedPayload {
	return {
		type: params.get("type") as "contact_tag_added",
		date_time: params.get("date_time") ?? "",
		initiated_from: params.get("initiated_from") ?? "",
		initiated_by: params.get("initiated_by") ?? "",
		list: params.get("list") ?? "",
		tag: params.get("tag") ?? "",
		contact: {
			id: params.get("contact[id]") ?? "",
			email: params.get("contact[email]") ?? "",
			first_name: params.get("contact[first_name]") ?? "",
			last_name: params.get("contact[last_name]") ?? "",
			phone: params.get("contact[phone]") ?? "",
			ip: params.get("contact[ip]") ?? "",
			tags: params.get("contact[tags]") ?? "",
			orgname: params.get("contact[orgname]") ?? "",
			fields: getContactFields(params),
		},
	};
}

export async function parseActiveCampaignWebhookRequest(
	request: Request
): Promise<ActiveCampaignContactTagAddedPayload> {
	const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
	if (!contentType.includes("application/x-www-form-urlencoded")) {
		throw new Error("Expected application/x-www-form-urlencoded content type");
	}

	const formData = await request.formData();
	const params = new URLSearchParams();

	for (const [key, value] of formData.entries()) {
		if (typeof value !== "string") continue;
		params.append(key, value);
	}

	return parseActiveCampaignWebhookParams(params);
}
