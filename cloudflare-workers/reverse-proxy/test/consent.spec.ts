import {
	createExecutionContext,
	env as workerEnv,
	waitOnExecutionContext,
} from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { type Env } from "../src/index";
import {
	createConsentChoice,
	getConsentRecord,
	saveConsentRecord,
} from "../src/consent/service";

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

async function runRequest(request: Request, env: Env = TEST_ENV): Promise<Response> {
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

function consentRequest(
	host: string,
	path: "/consent/bootstrap" | "/consent/state",
	body: Record<string, unknown>,
	cookie = "",
): Request {
	const rootDomain = host.replace(/^sg\./, "");

	return new IncomingRequest(`https://${host}${path}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Origin: `https://${rootDomain}`,
			...(cookie ? { Cookie: cookie } : {}),
		},
		body: JSON.stringify(body),
	});
}

function eventRequest(
	body: Record<string, unknown>,
	headers: Record<string, string> = {},
): Request {
	return new IncomingRequest(
		"https://sg.thebookkeepingchallenge.com/api/s/track",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Origin: "https://thebookkeepingchallenge.com",
				...headers,
			},
			body: JSON.stringify(body),
		},
	);
}

function getSetCookieHeaders(response: Response): string[] {
	const headers = response.headers as Headers & {
		getSetCookie?: () => string[];
	};
	const values = headers.getSetCookie?.();
	if (values) return values;

	const value = response.headers.get("Set-Cookie");
	return value ? [value] : [];
}

function getSetCookie(response: Response, name: string): string {
	return getSetCookieHeaders(response)
		.find((value) => value.startsWith(`${name}=`)) ?? "";
}

function toCookieHeader(setCookie: string): string {
	return setCookie.split(";")[0] ?? "";
}

function createChoice(
	input: Partial<{
		preferences: boolean;
		statistics: boolean;
		marketing: boolean;
		gpcApplied: boolean;
		sourceDomain: string;
	}> = {},
) {
	return createConsentChoice({
		preferences: false,
		statistics: false,
		marketing: false,
		gpcApplied: false,
		sourceDomain: "thebookkeepingchallenge.com",
		...input,
	});
}

describe("consent storage and API", () => {
	it("routes records only to the 32 deterministic shard names", async () => {
		const getConsent = vi.fn(async () => null);
		const getByName = vi.fn(() => ({ getConsent }));
		const env = {
			CONSENT_SECRET: "test-consent-secret-with-32-bytes",
			CONSENT_SHARD: { getByName },
		} as unknown as Env;

		for (let index = 0; index < 100; index += 1) {
			await getConsentRecord(env, `shard-test-${index}`);
		}

		const names = getByName.mock.calls.map(([name]) => String(name));
		expect(new Set(names).size).toBeGreaterThan(1);

		for (const name of names) {
			expect(name).toMatch(/^consent-v1-(?:[0-9]|[12][0-9]|3[01])$/);
		}
	});

	it("returns no record and creates first-party identity and consent cookies", async () => {
		const anonymousId = `no-record-${crypto.randomUUID()}`;
		const response = await runRequest(consentRequest(
			"sg.thebookkeepingchallenge.com",
			"/consent/bootstrap",
			{
				anonymousId,
				policyVersion: "v1",
			},
		));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			status: "no_record",
			consent: null,
		});
		expect(getSetCookie(response, "__eventn_id")).toContain(
			"Domain=thebookkeepingchallenge.com",
		);
		expect(getSetCookie(response, "__eventn_id_srvr")).toContain("HttpOnly");

		const consentCookie = getSetCookie(response, "bb_consent_state");
		expect(consentCookie).toContain("Domain=thebookkeepingchallenge.com");
		expect(consentCookie).toContain("HttpOnly");
		expect(consentCookie).toContain("SameSite=Lax");
	});

	it("transfers an explicit opt-out to another root", async () => {
		const anonymousId = `cross-root-${crypto.randomUUID()}`;
		const saved = await runRequest(consentRequest(
			"sg.thebookkeepingchallenge.com",
			"/consent/state",
			{
				anonymousId,
				preferences: false,
				statistics: false,
				marketing: false,
				gpcApplied: false,
				policyVersion: "v1",
			},
		));
		const loaded = await runRequest(consentRequest(
			"sg.keyboardrich.com",
			"/consent/bootstrap",
			{
				anonymousId,
				policyVersion: "v1",
			},
		));

		expect(saved.status).toBe(200);
		expect(await saved.json()).toMatchObject({
			status: "saved",
			consent: {
				responseType: "opted_out",
				revision: 1,
			},
		});
		expect(await loaded.json()).toMatchObject({
			status: "explicit",
			consent: {
				preferences: false,
				statistics: false,
				marketing: false,
				responseType: "opted_out",
				revision: 1,
			},
		});
		expect(getSetCookie(loaded, "bb_consent_state")).toContain(
			"Domain=keyboardrich.com",
		);
	});

	it("increments changed choices but does not rewrite identical choices", async () => {
		const anonymousId = `revision-${crypto.randomUUID()}`;
		const optedOut = createChoice();
		const optedIn = createChoice({
			preferences: true,
			statistics: true,
			marketing: true,
		});

		const first = await saveConsentRecord(TEST_ENV, anonymousId, optedOut, 1_000);
		const repeated = await saveConsentRecord(TEST_ENV, anonymousId, optedOut, 2_000);
		const changed = await saveConsentRecord(TEST_ENV, anonymousId, optedIn, 3_000);

		expect(first.revision).toBe(1);
		expect(repeated.revision).toBe(1);
		expect(repeated.updatedAt).toBe(1_000);
		expect(changed.revision).toBe(2);
		expect(changed.responseType).toBe("opted_in");
	});

	it("expires affirmative consent after 12 months but preserves opt-outs", async () => {
		const oneYear = 365 * 24 * 60 * 60 * 1_000;
		const optedInId = `expires-${crypto.randomUUID()}`;
		const optedOutId = `preserved-${crypto.randomUUID()}`;

		await saveConsentRecord(TEST_ENV, optedInId, createChoice({
			preferences: true,
			statistics: true,
			marketing: true,
		}), 1_000);
		await saveConsentRecord(TEST_ENV, optedOutId, createChoice(), 1_000);

		expect(await getConsentRecord(
			TEST_ENV,
			optedInId,
			1_000 + oneYear + 1,
		)).toBeNull();
		expect(await getConsentRecord(
			TEST_ENV,
			optedOutId,
			1_000 + (oneYear * 10),
		)).toMatchObject({
			responseType: "opted_out",
			expiresAt: null,
		});
	});

	it("keeps the most restrictive choice when handoff and local identities differ", async () => {
		const handoffId = `handoff-${crypto.randomUUID()}`;
		const localId = `local-${crypto.randomUUID()}`;

		await saveConsentRecord(TEST_ENV, handoffId, createChoice({
			preferences: true,
			statistics: true,
			marketing: true,
		}));
		await saveConsentRecord(TEST_ENV, localId, createChoice());

		const response = await runRequest(consentRequest(
			"sg.boomingbookkeeping.com",
			"/consent/bootstrap",
			{
				anonymousId: handoffId,
				policyVersion: "v1",
			},
			`__eventn_id_srvr=${localId}`,
		));

		expect(await response.json()).toMatchObject({
			status: "explicit",
			consent: {
				preferences: false,
				statistics: false,
				marketing: false,
				responseType: "opted_out",
			},
		});
		expect(await getConsentRecord(TEST_ENV, handoffId)).toMatchObject({
			responseType: "opted_out",
		});
		expect(await getConsentRecord(TEST_ENV, localId)).toMatchObject({
			responseType: "opted_out",
		});
	});

	it("stores an HMAC subject key instead of the raw anonymous ID", async () => {
		const anonymousId = `raw-id-${crypto.randomUUID()}`;
		await saveConsentRecord(TEST_ENV, anonymousId, createChoice());

		const record = await getConsentRecord(TEST_ENV, anonymousId);

		expect(record?.subjectKey).toMatch(/^[0-9a-f]{64}$/);
		expect(record?.subjectKey).not.toContain(anonymousId);
	});

	it("rejects invalid consent input and cross-root origins", async () => {
		const invalidChoice = await runRequest(consentRequest(
			"sg.thebookkeepingchallenge.com",
			"/consent/state",
			{
				anonymousId: `invalid-${crypto.randomUUID()}`,
				preferences: true,
				statistics: "yes",
				marketing: false,
				policyVersion: "v1",
			},
		));
		const oldPolicy = await runRequest(consentRequest(
			"sg.thebookkeepingchallenge.com",
			"/consent/bootstrap",
			{
				anonymousId: `policy-${crypto.randomUUID()}`,
				policyVersion: "old",
			},
		));
		const wrongOrigin = new IncomingRequest(
			"https://sg.thebookkeepingchallenge.com/consent/bootstrap",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Origin: "https://keyboardrich.com",
				},
				body: JSON.stringify({
					anonymousId: `origin-${crypto.randomUUID()}`,
					policyVersion: "v1",
				}),
			},
		);

		expect(invalidChoice.status).toBe(400);
		expect(oldPolicy.status).toBe(409);
		expect((await runRequest(wrongOrigin)).status).toBe(403);
	});
});

describe("Jitsu consent context", () => {
	it("forwards an unanswered event and attaches the browser snapshot", async () => {
		const upstreamFetch = vi.fn(async () => new Response("{}"));
		vi.stubGlobal("fetch", upstreamFetch);

		const browserConsent = {
			preferences: true,
			statistics: true,
			marketing: true,
			responseStatus: "unanswered",
			revision: 0,
			policyVersion: "v1",
		};
		const response = await runRequest(eventRequest({
			event: "Page Viewed",
			anonymousId: `unanswered-${crypto.randomUUID()}`,
		}, {
			"X-Boom-Consent": JSON.stringify(browserConsent),
		}));
		const init = upstreamFetch.mock.calls[0]?.[1] as RequestInit;
		const forwarded = JSON.parse(String(init.body));

		expect(response.status).toBe(200);
		expect(forwarded.context.consent).toEqual(browserConsent);
	});

	it("uses the central record when the signed cookie is missing", async () => {
		const anonymousId = `fallback-${crypto.randomUUID()}`;
		await saveConsentRecord(TEST_ENV, anonymousId, createChoice());

		const upstreamFetch = vi.fn(async () => new Response("{}"));
		vi.stubGlobal("fetch", upstreamFetch);
		const response = await runRequest(eventRequest({
			event: "Page Viewed",
		}, {
			Cookie: `__eventn_id_srvr=${anonymousId}`,
		}));
		const init = upstreamFetch.mock.calls[0]?.[1] as RequestInit;
		const forwarded = JSON.parse(String(init.body));

		expect(response.status).toBe(200);
		expect(forwarded.context.consent).toMatchObject({
			preferences: false,
			statistics: false,
			marketing: false,
			responseStatus: "explicit",
			revision: 1,
			policyVersion: "v1",
		});
		expect(getSetCookie(response, "bb_consent_state")).toContain("HttpOnly");
	});

	it("uses the signed cookie on later events", async () => {
		const anonymousId = `cookie-${crypto.randomUUID()}`;
		const saved = await runRequest(consentRequest(
			"sg.thebookkeepingchallenge.com",
			"/consent/state",
			{
				anonymousId,
				preferences: true,
				statistics: false,
				marketing: false,
				gpcApplied: false,
				policyVersion: "v1",
			},
		));
		const signedCookie = toCookieHeader(
			getSetCookie(saved, "bb_consent_state"),
		);

		const upstreamFetch = vi.fn(async () => new Response("{}"));
		vi.stubGlobal("fetch", upstreamFetch);
		const response = await runRequest(eventRequest({
			event: "Form Submitted",
		}, {
			Cookie: `__eventn_id_srvr=${anonymousId}; ${signedCookie}`,
		}));
		const init = upstreamFetch.mock.calls[0]?.[1] as RequestInit;
		const forwarded = JSON.parse(String(init.body));

		expect(response.status).toBe(200);
		expect(forwarded.context.consent).toMatchObject({
			preferences: true,
			statistics: false,
			marketing: false,
			responseStatus: "explicit",
			revision: 1,
		});
		expect(getSetCookie(response, "bb_consent_state")).toBe("");
	});

	it("rejects a signed cookie that belongs to another anonymous identity", async () => {
		const optedInId = `opted-in-${crypto.randomUUID()}`;
		const optedOutId = `opted-out-${crypto.randomUUID()}`;
		const optedInResponse = await runRequest(consentRequest(
			"sg.thebookkeepingchallenge.com",
			"/consent/state",
			{
				anonymousId: optedInId,
				preferences: true,
				statistics: true,
				marketing: true,
				gpcApplied: false,
				policyVersion: "v1",
			},
		));
		await saveConsentRecord(TEST_ENV, optedOutId, createChoice());

		const wrongConsentCookie = toCookieHeader(
			getSetCookie(optedInResponse, "bb_consent_state"),
		);
		const upstreamFetch = vi.fn(async () => new Response("{}"));
		vi.stubGlobal("fetch", upstreamFetch);
		const response = await runRequest(eventRequest({
			event: "Page Viewed",
		}, {
			Cookie: `__eventn_id_srvr=${optedOutId}; ${wrongConsentCookie}`,
		}));
		const init = upstreamFetch.mock.calls[0]?.[1] as RequestInit;
		const forwarded = JSON.parse(String(init.body));

		expect(forwarded.context.consent).toMatchObject({
			preferences: false,
			statistics: false,
			marketing: false,
			responseStatus: "explicit",
		});
		expect(getSetCookie(response, "bb_consent_state")).toContain("HttpOnly");
	});

	it("never drops the Jitsu event when consent resolution is unavailable", async () => {
		const upstreamFetch = vi.fn(async () => new Response("{}"));
		vi.stubGlobal("fetch", upstreamFetch);
		const unavailableConsentEnv = {
			...TEST_ENV,
			CONSENT_SECRET: "",
		};

		const response = await runRequest(eventRequest({
			event: "Page Viewed",
			anonymousId: `available-${crypto.randomUUID()}`,
		}), unavailableConsentEnv);
		const init = upstreamFetch.mock.calls[0]?.[1] as RequestInit;
		const forwarded = JSON.parse(String(init.body));

		expect(response.status).toBe(200);
		expect(upstreamFetch).toHaveBeenCalledTimes(1);
		expect(forwarded.context.consent).toMatchObject({
			responseStatus: "unknown",
			statistics: null,
			marketing: null,
		});
	});
});
