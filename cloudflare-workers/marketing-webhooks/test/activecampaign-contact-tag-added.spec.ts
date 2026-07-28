import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createActiveCampaignClient } from "../src/clients";
import worker from "../src/index";
import { activeCampaignSource } from "../src/sources/activecampaign";
import { contactTagAddedHandler } from "../src/sources/activecampaign/handlers";
import { parseActiveCampaignWebhookBody } from "../src/sources/activecampaign/parser";

const rawPayload =
	"type=contact_tag_added" +
	"&date_time=2026-07-17T22%3A01%3A25-05%3A00" +
	"&initiated_from=admin" +
	"&initiated_by=admin" +
	"&list=0" +
	"&contact%5Bid%5D=123456" +
	"&contact%5Bemail%5D=robert%40example.com" +
	"&contact%5Bfirst_name%5D=Robert" +
	"&contact%5Blast_name%5D=" +
	"&contact%5Bphone%5D=%2B1+555-010-1234" +
	"&contact%5Bip%5D=127.0.0.1" +
	"&contact%5Btags%5D=%5BKRC%5D+Registered+for+Challenge%2C+%5BKRC%5D+Registered+-+07%2F20%2F26%2C+%5BKRC%5D+RFC+START+-+07%2F20%2F26" +
	"&contact%5Bfields%5D%5B39%5D=11111111-2222-4333-8444-555555555555" +
	"&tag=%5BKRC%5D+Registered+for+Challenge";

describe("ActiveCampaign contact_tag_added source", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("parses the captured form-encoded payload", () => {
		const payload = parseActiveCampaignWebhookBody(rawPayload);

		expect(payload.type).toBe("contact_tag_added");
		expect(payload.date_time).toBe("2026-07-17T22:01:25-05:00");
		expect(payload.contact.id).toBe("123456");
		expect(payload.contact.phone).toBe("+1 555-010-1234");
		expect(payload.contact.fields["39"]).toBe(
			"11111111-2222-4333-8444-555555555555"
		);
		expect(payload.tag).toBe("[KRC] Registered for Challenge");
		expect(activeCampaignSource.extractTopic?.({}, payload)).toBe(
			"contact_tag_added"
		);
	});

	it("uses the API contact for identify and track identity", () => {
		const payload = parseActiveCampaignWebhookBody(rawPayload);
		const enrichment = {
			data: {
				contact: {
					id: "123456",
					email: "robert@example.com",
					phone: "+15550101234",
					firstName: "Robert",
					lastName: "Probert",
					cdate: "2026-07-01T10:00:00-05:00",
					udate: "2026-07-17T22:01:25-05:00",
				},
			},
			failed: { contact: false },
		};

		const validation = contactTagAddedHandler.validate(payload);
		expect(validation.valid).toBe(true);

		const events = contactTagAddedHandler.transform(payload, enrichment);
		expect(events).toHaveLength(2);

		const identify = events.find((event) => event.type === "identify");
		expect(identify).toMatchObject({
			type: "identify",
			userId: "robert@example.com",
			anonymousId: "11111111-2222-4333-8444-555555555555",
			timestamp: "2026-07-17T22:01:25-05:00",
			traits: {
				activecampaign_contact_id: "123456",
				email: "robert@example.com",
				phone: "+15550101234",
				first_name: "Robert",
				last_name: "Probert",
				name: "Robert Probert",
			},
		});

		const track = events.find((event) => event.type === "track");
		expect(track).toMatchObject({
			type: "track",
			event: "Contact Tag Added",
			userId: "robert@example.com",
			anonymousId: "11111111-2222-4333-8444-555555555555",
			properties: {
				activecampaign_contact_id: "123456",
				tag: "[KRC] Registered for Challenge",
				initiated_from: "admin",
				initiated_by: "admin",
				list_id: "0",
			},
		});
	});

	it("fetches a contact through ActiveCampaign API v3", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					contact: {
						id: "123456",
						email: "robert@example.com",
						firstName: "Robert",
						lastName: "Probert",
					},
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				}
			)
		);
		const client = createActiveCampaignClient({
			apiUrl: "https://example.api-us1.com",
			apiToken: "test-api-token",
		});

		const contact = await client.getContact("123456");

		expect(contact?.email).toBe("robert@example.com");
		expect(fetchSpy).toHaveBeenCalledOnce();
		const [requestUrl, requestOptions] = fetchSpy.mock.calls[0];
		expect(requestUrl).toBe(
			"https://example.api-us1.com/api/3/contacts/123456"
		);
		expect(new Headers(requestOptions?.headers).get("Api-Token")).toBe(
			"test-api-token"
		);
	});

	it("accepts the form-encoded webhook at the ActiveCampaign endpoint", async () => {
		const request = new Request(
			"https://example.com/webhook/activecampaign",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
				},
				body: rawPayload,
			}
		);
		const context = createExecutionContext();

		const response = await worker.fetch(request, env, context);
		await waitOnExecutionContext(context);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			ok: true,
			source: "activecampaign",
			topic: "contact_tag_added",
		});
	});
});
