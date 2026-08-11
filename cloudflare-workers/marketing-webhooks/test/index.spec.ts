import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { afterEach, describe, it, expect, vi } from "vitest";
import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

afterEach(() => {
	vi.restoreAllMocks();
});

describe("Health endpoint", () => {
	it("returns enabled sources (unit style)", async () => {
		const request = new IncomingRequest("http://example.com/health");
		const ctx = createExecutionContext();

		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(true);
		expect(body.sources).toEqual(["shopify", "webflow", "activecampaign"]);
		expect(typeof body.timestamp).toBe("string");
	});

	it("returns enabled sources (integration style)", async () => {
		const response = await SELF.fetch("https://example.com/health");

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(true);
		expect(body.sources).toEqual(["shopify", "webflow", "activecampaign"]);
		expect(typeof body.timestamp).toBe("string");
	});
});

describe("Reverse ETL debug endpoints", () => {
	const endpoints = [
		"purchases-all",
		"purchases-book",
		"purchases-vip",
		"purchases-mentorship",
		"purchases-kajabi",
		"formsubmissions-krc",
		"formsubmissions-webinar",
	];

	for (const endpoint of endpoints) {
		it(`accepts ${endpoint}`, async () => {
			const response = await SELF.fetch(
				`https://example.com/webhook/debug/${endpoint}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						body: {
							event_id: `test_${endpoint}`,
							event_name: "Test Event",
						},
					}),
				}
			);

			expect(response.status).toBe(200);
			expect(await response.json()).toMatchObject({
				ok: true,
				endpoint,
			});
		});
	}

	it("logs the endpoint and the properties inside the body wrapper", async () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
		const request = new IncomingRequest(
			"https://example.com/webhook/debug/purchases-vip",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					body: {
						event_id: "purchase_ch_test",
						product_case: "vip",
					},
					headers: {
						"User-Agent": "REDACTED",
					},
				}),
			}
		);
		const context = createExecutionContext();

		const response = await worker.fetch(request, env, context);
		await waitOnExecutionContext(context);

		expect(response.status).toBe(200);
		const responseBody = await response.json();
		expect(responseBody).toMatchObject({
			ok: true,
			endpoint: "purchases-vip",
			stored: true,
		});
		expect(typeof responseBody.recordId).toBe("number");
		expect(log).toHaveBeenCalledWith(
			expect.objectContaining({
				event: "reverse_etl_debug_webhook",
				endpoint: "purchases-vip",
				properties: {
					event_id: "purchase_ch_test",
					product_case: "vip",
				},
			})
		);

		const date = responseBody.receivedAt.slice(0, 10);
		const store = env.REVERSE_ETL_DEBUG_STORE.getByName(
			`purchases-vip:${date}`
		);
		const storedEvents = await store.listEvents();

		expect(storedEvents).toEqual([
			expect.objectContaining({
				id: responseBody.recordId,
				endpoint: "purchases-vip",
				receivedAt: responseBody.receivedAt,
				propertiesJson: JSON.stringify({
					event_id: "purchase_ch_test",
					product_case: "vip",
				}),
			}),
		]);

		const runtimeConfig = env as typeof env & {
			DEBUG_QUERY_TOKEN?: string;
		};
		const queryToken = runtimeConfig.DEBUG_QUERY_TOKEN;
		expect(queryToken).toBeTruthy();

		const queryResponse = await SELF.fetch(
			`https://example.com/admin/debug-events?endpoint=purchases-vip&date=${date}`,
			{
				headers: {
					Authorization: `Bearer ${queryToken}`,
				},
			}
		);
		const queryBody = await queryResponse.json();

		expect(queryResponse.status).toBe(200);
		expect(queryBody).toMatchObject({
			ok: true,
			endpoint: "purchases-vip",
			date,
			count: 1,
			events: [
				expect.objectContaining({
					id: responseBody.recordId,
					properties: {
						event_id: "purchase_ch_test",
						product_case: "vip",
					},
				}),
			],
		});
	});

	it("protects stored debug events from unauthenticated reads", async () => {
		const response = await SELF.fetch(
			"https://example.com/admin/debug-events?endpoint=purchases-all&date=2026-07-28"
		);

		expect(response.status).toBe(401);
	});

	it("rejects unknown debug endpoints", async () => {
		const response = await SELF.fetch(
			"https://example.com/webhook/debug/not-configured",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "{}",
			}
		);

		expect(response.status).toBe(404);
	});

	it("rejects invalid JSON", async () => {
		const response = await SELF.fetch(
			"https://example.com/webhook/debug/purchases-all",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "{",
			}
		);

		expect(response.status).toBe(400);
	});

	it("rejects non-POST requests", async () => {
		const response = await SELF.fetch(
			"https://example.com/webhook/debug/purchases-all"
		);

		expect(response.status).toBe(405);
	});
});
