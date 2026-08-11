import {
	createExecutionContext,
	env as workerEnv,
	waitOnExecutionContext,
} from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { type Env } from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const TEST_ENV: Env = {
	JITSU_CLOUD_HOST: "https://test-site.d.jitsu.com",
	JITSU_WRITE_KEY: "test-key:test-secret",
	STRIPE_SECRET_KEY: "sk_test_main",
	STRIPE_KAJABI_SECRET_KEY: "sk_test_kajabi",
	PURCHASE_STATE: {} as DurableObjectNamespace,
	CONSENT_SECRET: "test-consent-secret-with-32-bytes",
	CONSENT_SHARD: workerEnv.CONSENT_SHARD,
};

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

function getSetCookie(response: Response, name: string): string {
	return getSetCookieHeaders(response).find((value) => value.startsWith(`${name}=`)) ?? "";
}

function getCookieValue(setCookie: string): string {
	const firstPart = setCookie.split(";")[0] ?? "";
	const equalsIndex = firstPart.indexOf("=");
	if (equalsIndex < 0) return "";

	return decodeURIComponent(firstPart.slice(equalsIndex + 1));
}

function stubUpstream(body = "{}", status = 200, contentType = "application/json") {
	const upstreamFetch = vi.fn(async (_input: unknown, _init?: RequestInit) => new Response(body, {
		status,
		headers: { "Content-Type": contentType },
	}));
	vi.stubGlobal("fetch", upstreamFetch);
	return upstreamFetch;
}

async function runRequest(request: Request, env: Env = TEST_ENV): Promise<Response> {
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

function eventRequest(
	path: string,
	body: Record<string, unknown>,
	headers: Record<string, string> = {},
): Request {
	return new IncomingRequest(`https://sg.thebookkeepingchallenge.com${path}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Origin: "https://thebookkeepingchallenge.com",
			...headers,
		},
		body: JSON.stringify(body),
	});
}

describe("Jitsu browser SDK delivery and identity", () => {
	it("serves p.js through the Worker and mints a matching cookie pair", async () => {
		const upstreamFetch = stubUpstream("window.jitsu = {};", 200, "application/javascript");
		const response = await runRequest(new IncomingRequest("https://sg.thebookkeepingchallenge.com/p.js"));

		const readableCookie = getSetCookie(response, "__eventn_id");
		const serverCookie = getSetCookie(response, "__eventn_id_srvr");
		const anonymousId = getCookieValue(readableCookie);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("window.jitsu = {};");
		expect(response.headers.get("Cache-Control")).toBe("private, no-store");
		expect(anonymousId).toMatch(/^[0-9a-f-]{36}$/);
		expect(getCookieValue(serverCookie)).toBe(anonymousId);
		expect(readableCookie).toContain("Domain=thebookkeepingchallenge.com");
		expect(readableCookie).toContain("Max-Age=157680000");
		expect(readableCookie).toContain("SameSite=Lax");
		expect(readableCookie).toContain("Secure");
		expect(readableCookie).not.toContain("HttpOnly");
		expect(serverCookie).toContain("HttpOnly");
		expect(upstreamFetch).toHaveBeenCalledTimes(1);
		expect(String(upstreamFetch.mock.calls[0]?.[0])).toBe("https://test-site.d.jitsu.com/p.js");
	});

	it("uses the HttpOnly identity as authoritative and repairs the readable cookie", async () => {
		stubUpstream("// jitsu", 200, "application/javascript");
		const response = await runRequest(new IncomingRequest("https://sg.keyboardrichchallenge.com/p.js", {
			headers: {
				Cookie: "__eventn_id=readable-identity; __eventn_id_srvr=server-identity",
			},
		}));

		expect(getCookieValue(getSetCookie(response, "__eventn_id"))).toBe("server-identity");
		expect(getCookieValue(getSetCookie(response, "__eventn_id_srvr"))).toBe("server-identity");
		expect(getSetCookie(response, "__eventn_id")).toContain("Domain=keyboardrichchallenge.com");
	});

	it("migrates the legacy Segment cookie before minting a new identity", async () => {
		stubUpstream("// jitsu", 200, "application/javascript");
		const legacyId = "2f598b8b-567d-45d1-9af2-5ca30ca245e2";
		const encodedLegacyId = encodeURIComponent(JSON.stringify(legacyId));
		const response = await runRequest(new IncomingRequest("https://sg.keyboardrich.com/p.js", {
			headers: { Cookie: `ajs_anonymous_id=${encodedLegacyId}` },
		}));

		expect(getCookieValue(getSetCookie(response, "__eventn_id"))).toBe(legacyId);
		expect(getSetCookie(response, "__eventn_id")).toContain("Domain=keyboardrich.com");
	});

	it.each([
		["matching parameters", "?ajs_aid=shared-identity&an_aid=shared-identity"],
		["legacy ajs_aid only", "?ajs_aid=shared-identity"],
		["Jitsu an_aid only", "?an_aid=shared-identity"],
	])("accepts %s as a cross-root handoff", async (_name, query) => {
		stubUpstream("// jitsu", 200, "application/javascript");
		const response = await runRequest(new IncomingRequest(
			`https://sg.boomingbookkeeping.com/p.js${query}`,
			{ headers: { Cookie: "__eventn_id_srvr=local-identity" } },
		));

		expect(getCookieValue(getSetCookie(response, "__eventn_id"))).toBe("shared-identity");
		expect(getSetCookie(response, "__eventn_id")).toContain("Domain=boomingbookkeeping.com");
	});

	it("rejects conflicting handoff parameters without logging their values", async () => {
		stubUpstream("// jitsu", 200, "application/javascript");
		const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const response = await runRequest(new IncomingRequest(
			"https://sg.thebookkeepingchallenge.com/p.js?ajs_aid=first-identity&an_aid=second-identity",
			{ headers: { Cookie: "__eventn_id_srvr=local-identity" } },
		));

		expect(getCookieValue(getSetCookie(response, "__eventn_id"))).toBe("local-identity");
		expect(warning).toHaveBeenCalledWith("anonymous_id_handoff_conflict");
		expect(JSON.stringify(warning.mock.calls)).not.toContain("first-identity");
		expect(JSON.stringify(warning.mock.calls)).not.toContain("second-identity");
	});

	it("returns a controlled error when the upstream SDK cannot be loaded", async () => {
		stubUpstream("not found", 404, "text/plain");
		const response = await runRequest(new IncomingRequest("https://sg.thebookkeepingchallenge.com/p.js"));

		expect(response.status).toBe(502);
		expect(await response.json()).toEqual({ error: "Jitsu browser SDK is unavailable" });
	});
});

describe("Jitsu event forwarding", () => {
	it("uses the validated payload identity when cross-origin cookies are absent", async () => {
		const upstreamFetch = stubUpstream();
		const response = await runRequest(eventRequest("/api/s/track", {
			event: "Form Submitted",
			anonymousId: "payload-identity",
		}));

		expect(response.status).toBe(200);
		const init = upstreamFetch.mock.calls[0]?.[1] as RequestInit;
		const upstreamBody = JSON.parse(String(init.body));

		expect(upstreamBody.anonymousId).toBe("payload-identity");
	});

	it("rejects an invalid payload identity before forwarding", async () => {
		const upstreamFetch = stubUpstream();
		await runRequest(eventRequest("/api/s/track", {
			event: "Form Submitted",
			anonymousId: "invalid identity with spaces",
		}));

		const init = upstreamFetch.mock.calls[0]?.[1] as RequestInit;
		const upstreamBody = JSON.parse(String(init.body));

		expect(upstreamBody.anonymousId).toMatch(/^[0-9a-f-]{36}$/);
		expect(upstreamBody.anonymousId).not.toBe("invalid identity with spaces");
	});

	it.each(["page", "track", "identify", "group", "event"])(
		"forwards /api/s/%s with the private key only upstream",
		async (eventType) => {
			const upstreamFetch = stubUpstream('{"ok":true}');
			const response = await runRequest(eventRequest(`/api/s/${eventType}`, {
				type: eventType,
				anonymousId: "browser-identity",
				context: { page: { url: "https://thebookkeepingchallenge.com/offer" } },
			}, {
				Cookie: "__eventn_id_srvr=server-identity; __eventn_id=browser-identity",
				"CF-Connecting-IP": "203.0.113.10",
				"User-Agent": "Boom Test Browser",
			}));

			expect(response.status).toBe(200);
			expect(response.headers.get("X-Write-Key")).toBeNull();
			expect(String(upstreamFetch.mock.calls[0]?.[0])).toBe(`https://test-site.d.jitsu.com/api/s/${eventType}`);

			const init = upstreamFetch.mock.calls[0]?.[1] as RequestInit;
			const upstreamHeaders = new Headers(init.headers);
			const upstreamBody = JSON.parse(String(init.body));

			expect(upstreamHeaders.get("X-Write-Key")).toBe(TEST_ENV.JITSU_WRITE_KEY);
			expect(upstreamBody.anonymousId).toBe("server-identity");
			expect(upstreamBody.context.ip).toBe("203.0.113.10");
			expect(upstreamBody.context.userAgent).toBe("Boom Test Browser");
			expect(upstreamBody.context.page.url).toBe("https://thebookkeepingchallenge.com/offer");
		}
	);

	it("preserves attribution and ad-cookie enrichment", async () => {
		const upstreamFetch = stubUpstream();
		await runRequest(eventRequest("/api/s/track", {
			event: "Form Submitted",
			context: {
				page: {
					url: "https://thebookkeepingchallenge.com/offer?utm_source=google&gclid=query-gclid",
				},
			},
		}, {
			Cookie: "__eventn_id_srvr=server-identity; _fbp=fb.1.123; _uetvid=uet-visitor",
		}));

		const init = upstreamFetch.mock.calls[0]?.[1] as RequestInit;
		const upstreamBody = JSON.parse(String(init.body));

		expect(upstreamBody.context.attribution).toMatchObject({
			utm_source: "google",
			gclid: "query-gclid",
			fbp: "fb.1.123",
			uetvid: "uet-visitor",
		});
	});

	it("forwards batches with one authoritative identity and removes browser write keys", async () => {
		const upstreamFetch = stubUpstream();
		const response = await runRequest(eventRequest("/v1/batch", {
			writeKey: "browser-visible-key",
			batch: [
				{ type: "page", anonymousId: "wrong-one", context: {} },
				{ type: "track", event: "Form Submitted", anonymousId: "wrong-two", context: {} },
			],
		}, {
			Cookie: "__eventn_id_srvr=batch-identity",
		}));

		expect(response.status).toBe(200);
		const init = upstreamFetch.mock.calls[0]?.[1] as RequestInit;
		const upstreamBody = JSON.parse(String(init.body));

		expect(upstreamBody.writeKey).toBeUndefined();
		expect(upstreamBody.batch).toHaveLength(2);
		expect(upstreamBody.batch[0].anonymousId).toBe("batch-identity");
		expect(upstreamBody.batch[1].anonymousId).toBe("batch-identity");
	});

	it.each([401, 429])("returns upstream status %s without exposing the key", async (status) => {
		stubUpstream('{"error":"upstream error"}', status);
		const response = await runRequest(eventRequest("/api/s/track", { event: "test" }));

		expect(response.status).toBe(status);
		expect(await response.text()).toBe('{"error":"upstream error"}');
		expect(response.headers.get("X-Write-Key")).toBeNull();
	});

	it("rejects malformed JSON from Jitsu Cloud", async () => {
		stubUpstream("not-json", 200, "application/json");
		const response = await runRequest(eventRequest("/api/s/track", { event: "test" }));

		expect(response.status).toBe(502);
		expect(await response.json()).toEqual({ error: "Jitsu Cloud returned malformed JSON" });
	});

	it("returns a controlled error when Jitsu Cloud cannot be reached", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => {
			throw new Error("network unavailable");
		}));

		const response = await runRequest(eventRequest("/api/s/track", { event: "test" }));

		expect(response.status).toBe(502);
		expect(await response.json()).toEqual({ error: "Upstream request failed" });
	});
});

describe("attr event preservation", () => {
	it("suppresses empty attr events before Jitsu forwarding", async () => {
		const upstreamFetch = stubUpstream();
		const response = await runRequest(eventRequest("/api/s/track", { event: "attr" }));

		expect(response.status).toBe(204);
		expect(upstreamFetch).not.toHaveBeenCalled();
	});

	it("suppresses duplicate attr events after Worker enrichment", async () => {
		const fbp = "fb.1.123";
		const attribution = { fbp };
		const signature = await sha256Hex(stableStringify({ attribution, fbp }));
		const upstreamFetch = stubUpstream();
		const response = await runRequest(eventRequest("/api/s/track", { event: "attr" }, {
			Cookie: `_fbp=${fbp}; _attr_event_sig=${signature}; __eventn_id_srvr=server-identity`,
		}));

		expect(response.status).toBe(204);
		expect(upstreamFetch).not.toHaveBeenCalled();

		const currentCookie = getSetCookie(response, "_attr_current");
		const currentJsCookie = getSetCookie(response, "_attr_current_js");
		expect(JSON.parse(getCookieValue(currentCookie))).toEqual({ fbp });
		expect(JSON.parse(getCookieValue(currentJsCookie))).toEqual({ fbp });
		expect(currentCookie).toContain("HttpOnly");
		expect(currentCookie).toContain("Domain=thebookkeepingchallenge.com");
		expect(currentCookie).toContain("SameSite=Lax");
		expect(currentJsCookie).not.toContain("HttpOnly");
		expect(currentJsCookie).toContain("Domain=thebookkeepingchallenge.com");
	});

	it("keeps deterministic attr event IDs", async () => {
		const upstreamFetch = stubUpstream();
		await runRequest(eventRequest("/api/s/track", { event: "attr" }, {
			Cookie: "_fbp=fb.1.123; __eventn_id_srvr=server-identity",
		}));

		const init = upstreamFetch.mock.calls[0]?.[1] as RequestInit;
		const upstreamBody = JSON.parse(String(init.body));

		expect(upstreamBody.properties.fbp).toBe("fb.1.123");
		expect(upstreamBody.properties.event_id).toMatch(/^attr_[0-9a-f]{32}$/);
	});
});

describe("routing, validation, and CORS", () => {
	it.each([
		["sg.thebookkeepingchallenge.com", "thebookkeepingchallenge.com"],
		["sg.keyboardrichchallenge.com", "keyboardrichchallenge.com"],
		["sg.keyboardrich.com", "keyboardrich.com"],
		["sg.boomingbookkeeping.com", "boomingbookkeeping.com"],
	])("sets identity cookies for %s on %s", async (trackingHost, cookieDomain) => {
		stubUpstream("// jitsu", 200, "application/javascript");
		const response = await runRequest(new IncomingRequest(`https://${trackingHost}/p.js`));

		expect(getSetCookie(response, "__eventn_id")).toContain(`Domain=${cookieDomain}`);
		expect(getSetCookie(response, "__eventn_id_srvr")).toContain(`Domain=${cookieDomain}`);
	});

	it("allows credentialed preflight requests from the matching tenant", async () => {
		const response = await runRequest(new IncomingRequest("https://sg.keyboardrichchallenge.com/api/s/track", {
			method: "OPTIONS",
			headers: {
				Origin: "https://members.keyboardrichchallenge.com",
				"Access-Control-Request-Method": "POST",
				"Access-Control-Request-Headers": "content-type",
			},
		}));

		expect(response.status).toBe(204);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://members.keyboardrichchallenge.com");
		expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
		expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, X-Boom-Consent");
	});

	it("rejects origins that do not belong to the request tenant", async () => {
		const upstreamFetch = stubUpstream();
		const response = await runRequest(new IncomingRequest("https://sg.thebookkeepingchallenge.com/api/s/track", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Origin: "https://keyboardrichchallenge.com",
			},
			body: JSON.stringify({ event: "test" }),
		}));

		expect(response.status).toBe(403);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
		expect(upstreamFetch).not.toHaveBeenCalled();
	});

	it("rejects unsupported paths and methods", async () => {
		expect((await runRequest(new IncomingRequest("https://sg.thebookkeepingchallenge.com/route/evs/m"))).status).toBe(404);
		expect((await runRequest(new IncomingRequest("https://sg.thebookkeepingchallenge.com/api/s/track"))).status).toBe(405);
	});

	it("rejects unconfigured tracking hosts", async () => {
		const response = await runRequest(new IncomingRequest("https://sg.example.com/p.js"));
		expect(response.status).toBe(404);
	});

	it("rejects missing content types, malformed JSON, and oversized bodies", async () => {
		const missingContentType = await runRequest(new IncomingRequest("https://sg.thebookkeepingchallenge.com/api/s/track", {
			method: "POST",
			body: "{}",
		}));
		const malformedJson = await runRequest(new IncomingRequest("https://sg.thebookkeepingchallenge.com/api/s/track", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "{",
		}));
		const oversizedBody = await runRequest(new IncomingRequest("https://sg.thebookkeepingchallenge.com/api/s/track", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ value: "x".repeat(1024 * 1024) }),
		}));

		expect(missingContentType.status).toBe(415);
		expect(malformedJson.status).toBe(400);
		expect(oversizedBody.status).toBe(413);
	});

	it("requires both Jitsu configuration values", async () => {
		const noHost = await runRequest(eventRequest("/api/s/track", { event: "test" }), {
			...TEST_ENV,
			JITSU_CLOUD_HOST: "",
			JITSU_WRITE_KEY: "test-key:test-secret",
		});
		const noKey = await runRequest(eventRequest("/api/s/track", { event: "test" }), {
			...TEST_ENV,
			JITSU_CLOUD_HOST: "https://test-site.d.jitsu.com",
			JITSU_WRITE_KEY: "",
		});

		expect(noHost.status).toBe(503);
		expect(noKey.status).toBe(503);
	});
});

describe("purchase confirmation endpoints", () => {
	it("registers the nested browser attempt and derives the main Stripe account", async () => {
		const registerAttempt = vi.fn(async () => undefined);
		const getByName = vi.fn(() => ({ registerAttempt }));
		const env = {
			...TEST_ENV,
			PURCHASE_STATE: { getByName } as unknown as DurableObjectNamespace,
		};
		const submittedAt = new Date().toISOString();
		const response = await runRequest(eventRequest("/v1/purchase-attempts", {
			anonymous_id: "purchase-browser-id",
			attempt: {
				email: " Person@Example.com ",
				payment_method_id: "pm_checkout123",
				submitted_at: submittedAt,
			},
		}), env);

		expect(response.status).toBe(202);
		expect(getByName).toHaveBeenCalledWith("purchase-browser-id");
		expect(registerAttempt).toHaveBeenCalledWith({
			email: "person@example.com",
			paymentMethodId: "pm_checkout123",
			stripeAccount: "main",
			submittedAt: Date.parse(submittedAt),
		});
	});

	it("derives the Kajabi Stripe account from the checkout origin", async () => {
		const registerAttempt = vi.fn(async () => undefined);
		const env = {
			...TEST_ENV,
			PURCHASE_STATE: {
				getByName: vi.fn(() => ({ registerAttempt })),
			} as unknown as DurableObjectNamespace,
		};
		const submittedAt = new Date().toISOString();
		const response = await runRequest(new IncomingRequest(
			"https://sg.boomingbookkeeping.com/v1/purchase-attempts",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Origin: "https://learn.boomingbookkeeping.com",
				},
				body: JSON.stringify({
					anonymous_id: "purchase-browser-id",
					attempt: {
						email: "person@example.com",
						payment_method_id: "pm_kajabi123",
						submitted_at: submittedAt,
					},
				}),
			},
		), env);

		expect(response.status).toBe(202);
		expect(registerAttempt).toHaveBeenCalledWith(expect.objectContaining({
			stripeAccount: "kajabi",
		}));
	});

	it("returns the confirmed charge contract from the anonymous ID state", async () => {
		const poll = vi.fn(async () => ({
			charges: [{
				address: {
					city: "Austin",
					country: "US",
					postalCode: "78701",
					region: "TX",
					street: "123 Main St",
				},
				chargeId: "ch_confirmed123",
				contentIds: ["authoritative stripe product"],
				currency: "USD",
				email: "person@example.com",
				name: "Person Example",
				phone: "+15555550123",
				productId: "authoritative stripe product",
				productName: "Authoritative Stripe Product",
				products: [{
					contentId: "authoritative stripe product",
					name: "Authoritative Stripe Product",
					price: 47,
					quantity: 1,
					stripeProductId: "prod_test",
				}],
				stripeAccount: "main",
				value: 47,
			}],
			hasPendingAttempts: true,
			retryAfterMs: 2500,
		}));
		const env = {
			...TEST_ENV,
			PURCHASE_STATE: {
				getByName: vi.fn(() => ({ poll })),
			} as unknown as DurableObjectNamespace,
		};
		const response = await runRequest(eventRequest("/v1/purchase-confirmations", {
			anonymous_id: "purchase-browser-id",
		}), env);

		expect(response.status).toBe(200);
		expect(poll).toHaveBeenCalledWith("main");
		expect(await response.json()).toEqual({
			charges: [{
				address: {
					city: "Austin",
					country: "US",
					postal_code: "78701",
					region: "TX",
					street: "123 Main St",
				},
				charge_id: "ch_confirmed123",
				content_ids: ["authoritative stripe product"],
				currency: "USD",
				email: "person@example.com",
				name: "Person Example",
				payment_source: "stripe",
				phone: "+15555550123",
				product_id: "authoritative stripe product",
				product_name: "Authoritative Stripe Product",
				products: [{
					currency: "USD",
					price: 47,
					product_id: "authoritative stripe product",
					product_name: "Authoritative Stripe Product",
					quantity: 1,
					stripe_product_id: "prod_test",
				}],
				value: 47,
			}],
			has_pending_attempts: true,
			retry_after_ms: 2500,
		});
	});

	it("rejects incomplete purchase attempts before touching Durable Objects", async () => {
		const getByName = vi.fn();
		const env = {
			...TEST_ENV,
			PURCHASE_STATE: { getByName } as unknown as DurableObjectNamespace,
		};
		const response = await runRequest(eventRequest("/v1/purchase-attempts", {
			anonymous_id: "purchase-browser-id",
			attempt: {
				email: "person@example.com",
				payment_method_id: "not-a-payment-method",
				submitted_at: new Date().toISOString(),
			},
		}), env);

		expect(response.status).toBe(400);
		expect(getByName).not.toHaveBeenCalled();
	});
});
