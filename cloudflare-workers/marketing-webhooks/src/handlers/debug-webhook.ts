import type { MarketingWebhookEnv } from "../types";

const DEBUG_ENDPOINTS = new Set([
	"purchases-all",
	"purchases-book",
	"purchases-vip",
	"purchases-mentorship",
	"purchases-kajabi",
	"formsubmissions-krc",
	"formsubmissions-webinar",
]);

type JsonRecord = Record<string, unknown>;

interface StoredDebugEvent {
	id: number;
	endpoint: string;
	receivedAt: string;
	propertiesJson: string;
}

function jsonResponse(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function isJsonRecord(value: unknown): value is JsonRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getProperties(payload: unknown): unknown {
	if (!isJsonRecord(payload)) return payload;
	if (!Object.hasOwn(payload, "body")) return payload;

	return payload.body;
}

/**
 * Logs Reverse ETL payloads without queueing or transforming them.
 *
 * Route:
 * - POST /webhook/debug/:endpoint
 */
export async function handleDebugWebhook(
	request: Request,
	runtimeEnv: MarketingWebhookEnv
): Promise<Response> {
	if (request.method !== "POST") {
		return jsonResponse({ error: "Method not allowed" }, 405);
	}

	const url = new URL(request.url);
	const match = url.pathname.match(/^\/webhook\/debug\/([a-z0-9-]+)$/);
	const endpoint = match?.[1];

	if (!endpoint || !DEBUG_ENDPOINTS.has(endpoint)) {
		return jsonResponse({ error: "Unknown debug endpoint" }, 404);
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return jsonResponse({ error: "Invalid JSON body" }, 400);
	}

	const receivedAt = new Date().toISOString();
	const properties = getProperties(payload);

	console.log({
		event: "reverse_etl_debug_webhook",
		endpoint,
		receivedAt,
		properties,
	});

	const shardName = `${endpoint}:${receivedAt.slice(0, 10)}`;
	const store = runtimeEnv.REVERSE_ETL_DEBUG_STORE.getByName(shardName);
	const propertiesJson = JSON.stringify(properties) ?? "null";

	let recordId: number;
	try {
		recordId = await store.storeEvent(endpoint, receivedAt, propertiesJson);
	} catch (error) {
		console.error({
			event: "reverse_etl_debug_store_failed",
			endpoint,
			receivedAt,
			error: error instanceof Error ? error.message : String(error),
		});

		return jsonResponse({ error: "Failed to store debug event" }, 503);
	}

	return jsonResponse({
		ok: true,
		endpoint,
		receivedAt,
		stored: true,
		recordId,
	});
}

/**
 * Reads one endpoint/date shard for authenticated audit jobs.
 *
 * Route:
 * - GET /admin/debug-events?endpoint=:endpoint&date=YYYY-MM-DD
 */
export async function handleDebugEventQuery(
	request: Request,
	runtimeEnv: MarketingWebhookEnv
): Promise<Response> {
	if (request.method !== "GET") {
		return jsonResponse({ error: "Method not allowed" }, 405);
	}

	const expectedToken = runtimeEnv.DEBUG_QUERY_TOKEN;
	const authorization = request.headers.get("Authorization");

	if (!expectedToken || authorization !== `Bearer ${expectedToken}`) {
		return jsonResponse({ error: "Unauthorized" }, 401);
	}

	const url = new URL(request.url);
	const endpoint = url.searchParams.get("endpoint");
	const date = url.searchParams.get("date");

	if (!endpoint || !DEBUG_ENDPOINTS.has(endpoint)) {
		return jsonResponse({ error: "Unknown debug endpoint" }, 400);
	}

	if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		return jsonResponse({ error: "Date must use YYYY-MM-DD" }, 400);
	}

	const limit = parsePositiveInteger(url.searchParams.get("limit"), 100);
	const beforeId = parsePositiveInteger(
		url.searchParams.get("before_id"),
		undefined
	);
	const store = runtimeEnv.REVERSE_ETL_DEBUG_STORE.getByName(
		`${endpoint}:${date}`
	);
	const storedEvents = await store.listEvents(limit, beforeId);
	const events = storedEvents.map(parseStoredEvent);

	return jsonResponse({
		ok: true,
		endpoint,
		date,
		count: events.length,
		events,
		nextBeforeId: events.at(-1)?.id ?? null,
	});
}

function parsePositiveInteger(
	value: string | null,
	fallback: number | undefined
): number | undefined {
	if (!value) return fallback;

	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed < 1) return fallback;

	return parsed;
}

function parseStoredEvent(event: StoredDebugEvent): Record<string, unknown> {
	return {
		id: event.id,
		endpoint: event.endpoint,
		receivedAt: event.receivedAt,
		properties: JSON.parse(event.propertiesJson),
	};
}
