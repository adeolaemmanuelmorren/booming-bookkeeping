import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
} from "cloudflare:test";
import { afterEach, describe, it, expect, vi } from "vitest";
import worker from "../src/index";

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

function stableStringify(value: unknown): string {
	if (value == null) return "";
	if (typeof value !== "object") return String(value);
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

	return `{${Object.keys(value)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
		.join(",")}}`;
}

async function sha256Hex(value: string): Promise<string> {
	const input = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest("SHA-256", input);

	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

function getSetCookieHeaders(response: Response): string[] {
	const headers = response.headers as Headers & { getSetCookie?: () => string[] };
	const setCookieHeaders = headers.getSetCookie?.();
	if (setCookieHeaders) return setCookieHeaders;

	const setCookie = response.headers.get("Set-Cookie");
	if (!setCookie) return [];

	return [setCookie];
}

function getCookieValue(setCookie: string): string {
	const firstPart = setCookie.split(";")[0] ?? "";
	const equalsIndex = firstPart.indexOf("=");
	if (equalsIndex < 0) return "";

	return decodeURIComponent(firstPart.slice(equalsIndex + 1));
}

describe("CORS", () => {
	it("allows the source tracking domain on route preflights", async () => {
		const request = new IncomingRequest("https://sg.thebookkeepingchallenge.com/route/evs/m", {
			method: "OPTIONS",
			headers: {
				Origin: "https://thebookkeepingchallenge.com",
				"Access-Control-Request-Method": "POST",
				"Access-Control-Request-Headers": "content-type",
			},
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(204);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://thebookkeepingchallenge.com");
		expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
	});

	it("allows the destination tracking domain on route preflights", async () => {
		const request = new IncomingRequest("https://sg.keyboardrichchallenge.com/route/evs/m", {
			method: "OPTIONS",
			headers: {
				Origin: "https://keyboardrichchallenge.com",
				"Access-Control-Request-Method": "POST",
				"Access-Control-Request-Headers": "content-type",
			},
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(204);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://keyboardrichchallenge.com");
		expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
	});

	it("allows subdomains of every configured root domain on route preflights", async () => {
		const cases = [
			{
				requestUrl: "https://sg.thebookkeepingchallenge.com/route/evs/m",
				origin: "https://app.thebookkeepingchallenge.com",
			},
			{
				requestUrl: "https://sg.keyboardrichchallenge.com/route/evs/m",
				origin: "https://members.keyboardrichchallenge.com",
			},
			{
				requestUrl: "https://sg.keyboardrich.com/route/evs/m",
				origin: "https://www.keyboardrich.com",
			},
			{
				requestUrl: "https://sg.boomingbookkeeping.com/route/evs/m",
				origin: "https://www.boomingbookkeeping.com",
			},
		];

		for (const testCase of cases) {
			const request = new IncomingRequest(testCase.requestUrl, {
				method: "OPTIONS",
				headers: {
					Origin: testCase.origin,
					"Access-Control-Request-Method": "POST",
					"Access-Control-Request-Headers": "content-type",
				},
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(204);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe(testCase.origin);
			expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
		}
	});

	it("does not echo unknown origins on route preflights", async () => {
		const request = new IncomingRequest("https://sg.thebookkeepingchallenge.com/route/evs/m", {
			method: "OPTIONS",
			headers: {
				Origin: "https://example.com",
				"Access-Control-Request-Method": "POST",
			},
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(204);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});
});

describe("attr event suppression", () => {
	it("suppresses empty attr events before forwarding to Segment", async () => {
		const request = new IncomingRequest("https://sg.thebookkeepingchallenge.com/route/evs/m", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ event: "attr" }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(204);
	});

	it("suppresses duplicate attr events after worker cookie enrichment", async () => {
		const fbp = "fb.1.123";
		const attribution = { fbp };
		const fingerprint = stableStringify({ attribution, fbp });
		const signature = await sha256Hex(fingerprint);
		const request = new IncomingRequest("https://sg.thebookkeepingchallenge.com/route/evs/m", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: `_fbp=${fbp}; _attr_event_sig=${signature}`,
			},
			body: JSON.stringify({ event: "attr" }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(204);
	});

	it("sets the current attribution cookie on suppressed Segment requests", async () => {
		const fbp = "fb.1.123";
		const attribution = { fbp };
		const fingerprint = stableStringify({ attribution, fbp });
		const signature = await sha256Hex(fingerprint);
		const request = new IncomingRequest("https://sg.thebookkeepingchallenge.com/route/evs/m", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: `_fbp=${fbp}; _attr_event_sig=${signature}`,
			},
			body: JSON.stringify({ event: "attr" }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		const currentCookie = getSetCookieHeaders(response).find((value) =>
			value.startsWith("_attr_current=")
		);
		const currentJsCookie = getSetCookieHeaders(response).find((value) =>
			value.startsWith("_attr_current_js=")
		);

		expect(response.status).toBe(204);
		expect(currentCookie).toContain("HttpOnly");
		expect(currentCookie).toContain("Domain=thebookkeepingchallenge.com");
		expect(currentJsCookie).not.toContain("HttpOnly");
		expect(currentJsCookie).toContain("Domain=thebookkeepingchallenge.com");
		expect(JSON.parse(getCookieValue(currentCookie ?? ""))).toEqual({ fbp });
		expect(JSON.parse(getCookieValue(currentJsCookie ?? ""))).toEqual({ fbp });
	});

	it("keeps prior current attribution values and overwrites observed keys", async () => {
		const previousCurrent = { gclid: "old-gclid", fbclid: "old-fbclid" };
		const attribution = {
			fbclid: "new-fbclid",
			gclid: "old-gclid",
			utm_source: "google",
		};
		const signature = await sha256Hex(stableStringify({ attribution }));
		const request = new IncomingRequest("https://sg.thebookkeepingchallenge.com/route/evs/m", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: `_attr_current=${encodeURIComponent(JSON.stringify(previousCurrent))}; _attr_event_sig=${signature}`,
			},
			body: JSON.stringify({
				event: "attr",
				context: {
					page: {
						url: "https://thebookkeepingchallenge.com/products?utm_source=google&fbclid=new-fbclid",
					},
				},
			}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		const currentCookie = getSetCookieHeaders(response).find((value) =>
			value.startsWith("_attr_current=")
		);
		const currentJsCookie = getSetCookieHeaders(response).find((value) =>
			value.startsWith("_attr_current_js=")
		);

		expect(response.status).toBe(204);
		expect(JSON.parse(getCookieValue(currentCookie ?? ""))).toEqual(attribution);
		expect(JSON.parse(getCookieValue(currentJsCookie ?? ""))).toEqual(attribution);
	});

	it("uses SameSite=Lax for first-party attribution cookies", async () => {
		const attribution = { gclid: "adeola_gclid" };
		const signature = await sha256Hex(stableStringify({ attribution }));
		const request = new IncomingRequest("https://sg.thebookkeepingchallenge.com/route/evs/m", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Origin: "https://www.thebookkeepingchallenge.com",
				Cookie: `_attr_event_sig=${signature}`,
			},
			body: JSON.stringify({
				event: "attr",
				context: {
					page: {
						url: "https://www.thebookkeepingchallenge.com/?gclid=adeola_gclid",
					},
				},
			}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		const currentCookie = getSetCookieHeaders(response).find((value) =>
			value.startsWith("_attr_current=")
		);

		expect(currentCookie).toContain("SameSite=Lax");
	});

	it("uses SameSite=None for cross-site attribution cookies", async () => {
		const attribution = { gclid: "adeola_gclid" };
		const signature = await sha256Hex(stableStringify({ attribution }));
		const request = new IncomingRequest("https://sg.thebookkeepingchallenge.com/route/evs/m", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Origin: "https://keyboardrichchallenge.com",
				Cookie: `_attr_event_sig=${signature}`,
			},
			body: JSON.stringify({
				event: "attr",
				context: {
					page: {
						url: "https://keyboardrichchallenge.com/?gclid=adeola_gclid",
					},
				},
			}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		const currentCookie = getSetCookieHeaders(response).find((value) =>
			value.startsWith("_attr_current=")
		);

		expect(currentCookie).toContain("SameSite=None");
		expect(currentCookie).toContain("Secure");
	});

	it("sets attribution cookies on the request tenant domain", async () => {
		const attribution = { gclid: "boom_gclid" };
		const signature = await sha256Hex(stableStringify({ attribution }));
		const request = new IncomingRequest("https://sg.thebookkeepingchallenge.com/route/evs/m", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Origin: "https://thebookkeepingchallenge.com",
				Cookie: `_attr_event_sig=${signature}`,
			},
			body: JSON.stringify({
				event: "attr",
				context: {
					page: {
						url: "https://thebookkeepingchallenge.com/?gclid=boom_gclid",
					},
				},
			}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		const currentCookie = getSetCookieHeaders(response).find((value) =>
			value.startsWith("_attr_current=")
		);

		expect(currentCookie).toContain("Domain=thebookkeepingchallenge.com");
		expect(currentCookie).toContain("SameSite=Lax");
	});
});
