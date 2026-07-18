import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

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
