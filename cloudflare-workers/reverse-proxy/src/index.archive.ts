import { Segment } from '@segment/edge-sdk';
import { parse as parseCookie, stringify as cookie, type Attributes } from 'worktop/cookie';

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	// MY_KV_NAMESPACE: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket;
	//
	// Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
	// MY_SERVICE: Fetcher;
	//
	// Example binding to a Queue. Learn more at https://developers.cloudflare.com/queues/javascript-apis/
	// MY_QUEUE: Queue;
}

/**********************************************************************
 *  ROUTING / DEPLOYMENT
 *********************************************************************/
const ROUTE_PREFIX = 'route';
const CK_PATH = `/${ROUTE_PREFIX}/ck`;
const EVS_PREFIX = `/${ROUTE_PREFIX}/evs/`;

const ATTR_CURRENT_COOKIE = '_attr_current';
const ATTR_CURRENT_JS_COOKIE = '_attr_current_js';
const ATTR_EVENT_SIGNATURE_COOKIE = '_attr_event_sig';

/** Lifetime for the current attribution cookie (in seconds) */
const ATTR_CURRENT_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

/** Lifetime for duplicate attr-event suppression (in seconds) */
const ATTR_EVENT_SIGNATURE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/**********************************************************************
 *  ► ATTRIBUTION CONFIG - mapping of incoming-name → attribution-name
 *********************************************************************/
const ATTRIBUTION_MAP = {
	utm_source: 'utm_source',
	utm_medium: 'utm_medium',
	utm_campaign: 'utm_campaign',
	utm_term: 'utm_term',
	utm_content: 'utm_content',
	gclid: 'gclid',
	fbclid: 'fbclid',
	gbraid: 'gbraid',
	wbraid: 'wbraid',
	twclid: 'twclid',
	ttclid: 'ttclid',
	li_fat_id: 'li_fat_id',
	_fbc: 'fbc',
	_fbp: 'fbp',
	_ttp: 'ttp',
	_ttclid: 'ttclid',
	_rdt_uuid: 'rdt_uuid',
	rdt_cid: 'rdt_cid',
	msclkid: 'msclkid',
	utm_id: 'utm_id',
} as const;

const ATTR_EVENT_NAME = 'attr';

const ATTR_COOKIE_MAP = {
	_fbc: 'fbc',
	_fbp: 'fbp',
	_uetvid: 'uetvid',
	_uetsid: 'uetsid',
	_ttp: 'ttp',
	_ttclid: 'ttclid',
	_rdt_uuid: 'rdt_uuid',
	msclkid: 'msclkid',
	gclid: 'gclid',
	gbraid: 'gbraid',
	wbraid: 'wbraid',
	fbclid: 'fbclid',
	twclid: 'twclid',
	ttclid: 'ttclid',
	rdt_cid: 'rdt_cid',
	li_fat_id: 'li_fat_id',
} as const;

/* Convenience derived types */
type ParamKey = keyof typeof ATTRIBUTION_MAP; // eg "utm_source"

type PreparedSegmentEvent = {
	request: Request;
	cookieHeaders: string[];
	suppressSegment: boolean;
};

type TenantConfig = {
	trackingHost: string;
	cookieDomain: string;
};

/**********************************************************************
 *  TENANT / DOMAIN CONFIG
 *********************************************************************/
const TENANTS: TenantConfig[] = [
	{
		trackingHost: 'sg.thebookkeepingchallenge.com',
		cookieDomain: 'thebookkeepingchallenge.com',
	},
	{
		trackingHost: 'sg.keyboardrichchallenge.com',
		cookieDomain: 'keyboardrichchallenge.com',
	},
	{
		trackingHost: 'sg.keyboardrich.com',
		cookieDomain: 'keyboardrich.com',
	},
	{
		trackingHost: 'sg.boomingbookkeeping.com',
		cookieDomain: 'boomingbookkeeping.com',
	},
];

const DEFAULT_TENANT = TENANTS[0];

/**********************************************************************
 * SMALL HELPERS
 *********************************************************************/

function tryParseUrl(urlString: string | null | undefined): URL | null {
	if (!urlString) return null;
	try {
		return new URL(urlString);
	} catch {
		return null;
	}
}

function getString(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;

	const trimmed = value.trim();
	if (!trimmed) return undefined;

	return trimmed;
}

function getTenantForHostname(hostname: string): TenantConfig {
	const normalizedHostname = hostname.toLowerCase();

	return TENANTS.find((tenant) => tenant.trackingHost === normalizedHostname) ?? DEFAULT_TENANT;
}

function getRequestTenant(request: Request): TenantConfig {
	return getTenantForHostname(new URL(request.url).hostname);
}

function isTenantSite(hostname: string, tenant: TenantConfig): boolean {
	const normalizedHostname = hostname.toLowerCase();

	return normalizedHostname === tenant.cookieDomain || normalizedHostname.endsWith(`.${tenant.cookieDomain}`);
}

function isConfiguredSite(hostname: string): boolean {
	const normalizedHostname = hostname.toLowerCase();

	return TENANTS.some((tenant) => isTenantSite(normalizedHostname, tenant));
}

function readObject(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
}

function stableStringify(value: unknown): string {
	if (value == null) return '';
	if (typeof value !== 'object') return String(value);
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

	return `{${Object.keys(value)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
		.join(',')}}`;
}

async function sha256Hex(value: string): Promise<string> {
	const input = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest('SHA-256', input);

	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

function getHttpOnlyCookieOptions(request: Request, tenant: TenantConfig, maxage: number): Attributes {
	const isSecure = new URL(request.url).protocol === 'https:';

	return {
		path: '/',
		samesite: 'Lax',
		maxage,
		domain: tenant.cookieDomain,
		secure: isSecure,
		httponly: true,
	};
}

function getReadableCookieOptions(request: Request, tenant: TenantConfig, maxage: number): Attributes {
	const isSecure = new URL(request.url).protocol === 'https:';

	return {
		path: '/',
		samesite: 'Lax',
		maxage,
		domain: tenant.cookieDomain,
		secure: isSecure,
		httponly: false,
	};
}

function getAttributionSameSite(request: Request, tenant: TenantConfig): 'Lax' | 'None' {
	const originUrl = tryParseUrl(request.headers.get('origin'));
	if (originUrl) {
		return isTenantSite(originUrl.hostname, tenant) ? 'Lax' : 'None';
	}

	const refererUrl = tryParseUrl(request.headers.get('referer'));
	if (refererUrl) {
		return isTenantSite(refererUrl.hostname, tenant) ? 'Lax' : 'None';
	}

	return 'Lax';
}

function getAttributionHttpOnlyCookieOptions(request: Request, tenant: TenantConfig): Attributes {
	return {
		...getHttpOnlyCookieOptions(request, tenant, ATTR_CURRENT_MAX_AGE),
		samesite: getAttributionSameSite(request, tenant),
		secure: true,
	};
}

function getAttributionReadableCookieOptions(request: Request, tenant: TenantConfig): Attributes {
	return {
		...getReadableCookieOptions(request, tenant, ATTR_CURRENT_MAX_AGE),
		samesite: getAttributionSameSite(request, tenant),
		secure: true,
	};
}

function getCookieOptions(request: Request, tenant: TenantConfig): Attributes {
	return getHttpOnlyCookieOptions(request, tenant, ATTR_EVENT_SIGNATURE_MAX_AGE);
}

function parseJsonCookieRecord(value: string | undefined): Record<string, string> {
	if (!value) return {};

	const valuesToTry = [value];
	try {
		valuesToTry.push(decodeURIComponent(value));
	} catch {
		// Ignore malformed percent-encoding and try the raw cookie value.
	}

	for (const valueToTry of valuesToTry) {
		try {
			const parsed = JSON.parse(valueToTry);
			const record = readObject(parsed);
			if (!record) continue;

			const output: Record<string, string> = {};
			for (const [key, rawValue] of Object.entries(record)) {
				const stringValue = getString(rawValue);
				if (!stringValue) continue;
				output[key] = stringValue;
			}

			return output;
		} catch {
			// Try the next representation.
		}
	}

	return {};
}

function getCurrentAttributionCookieHeaders(
	request: Request,
	tenant: TenantConfig,
	cookies: Record<string, unknown>,
	attribution: Record<string, string>,
): string[] {
	const current = {
		...parseJsonCookieRecord(getString(cookies[ATTR_CURRENT_JS_COOKIE])),
		...parseJsonCookieRecord(getString(cookies[ATTR_CURRENT_COOKIE])),
		...attribution,
	};

	if (Object.keys(current).length === 0) return [];

	const value = JSON.stringify(current);

	return [
		cookie(ATTR_CURRENT_COOKIE, value, getAttributionHttpOnlyCookieOptions(request, tenant)),
		cookie(ATTR_CURRENT_JS_COOKIE, value, getAttributionReadableCookieOptions(request, tenant)),
	];
}

function getSegmentPageUrl(body: Record<string, unknown>): URL | null {
	const context = readObject(body.context);
	const page = readObject(context?.page);

	return tryParseUrl(getString(page?.url));
}

function getNestedAttributionValue(body: Record<string, unknown> | null, paramKey: ParamKey): string | undefined {
	if (!body) return undefined;

	const attrName = ATTRIBUTION_MAP[paramKey];
	const context = readObject(body.context);
	const attribution = readObject(context?.attribution);
	const properties = readObject(body.properties);
	const traits = readObject(body.traits);

	return (
		getString(body[paramKey]) ??
		getString(body[attrName]) ??
		getString(attribution?.[attrName]) ??
		getString(properties?.[paramKey]) ??
		getString(properties?.[attrName]) ??
		getString(traits?.[paramKey]) ??
		getString(traits?.[attrName])
	);
}

function getNestedAttrCookieValue(body: Record<string, unknown>, cookieName: string, propertyName: string): string | undefined {
	const properties = readObject(body.properties);
	const traits = readObject(body.traits);

	return (
		getString(body[cookieName]) ??
		getString(body[propertyName]) ??
		getString(properties?.[cookieName]) ??
		getString(properties?.[propertyName]) ??
		getString(traits?.[cookieName]) ??
		getString(traits?.[propertyName])
	);
}

function setAttributionValue(target: Record<string, string>, key: string, value: string | undefined) {
	if (!value) return;
	target[key] = value;
}

function copyExistingAttribution(target: Record<string, string>, body: Record<string, unknown> | null) {
	const context = readObject(body?.context);
	const attribution = readObject(context?.attribution);
	if (!attribution) return;

	for (const [key, value] of Object.entries(attribution)) {
		const stringValue = getString(value);
		if (!stringValue) continue;
		if (key === 'first' || key === 'last' || key === 'current') continue;
		if (key.startsWith('first_') || key.startsWith('last_')) continue;

		target[key] = stringValue;
	}
}

function buildAvailableAttribution(
	request: Request,
	pageUrl: URL | null,
	body: Record<string, unknown> | null,
): Record<string, string> {
	const cookies = parseCookie(request.headers.get('cookie') || '');
	const attribution = parseJsonCookieRecord(getString(cookies[ATTR_CURRENT_COOKIE]));
	copyExistingAttribution(attribution, body);

	for (const paramKey of Object.keys(ATTRIBUTION_MAP) as ParamKey[]) {
		const value =
			getString(pageUrl?.searchParams.get(paramKey)) ??
			getNestedAttributionValue(body, paramKey) ??
			getString(cookies[paramKey]);

		if (!value) continue;

		const attrName = ATTRIBUTION_MAP[paramKey];
		attribution[attrName] = value;
	}

	for (const [cookieName, propertyName] of Object.entries(ATTR_COOKIE_MAP)) {
		const value = getNestedAttrCookieValue(body ?? {}, cookieName, propertyName) ?? getString(cookies[cookieName]);
		setAttributionValue(attribution, propertyName, value);
	}

	return attribution;
}

function appendSetCookieHeaders(resp: Response, cookieHeaders: string[]): Response {
	if (cookieHeaders.length === 0) return resp;

	const headers = new Headers(resp.headers);
	for (const cookieHeader of cookieHeaders) {
		headers.append('Set-Cookie', cookieHeader);
	}

	return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
}

function getAttrCookieProperties(request: Request): Record<string, string> {
	const cookies = parseCookie(request.headers.get('cookie') || '');
	const properties: Record<string, string> = {};

	for (const [cookieName, propertyName] of Object.entries(ATTR_COOKIE_MAP)) {
		const value = getString(cookies[cookieName]);
		if (!value) continue;

		properties[propertyName] = value;
	}

	return properties;
}

function getClientAttrCookieProperties(body: Record<string, unknown>): Record<string, string> {
	const properties: Record<string, string> = {};

	for (const [cookieName, propertyName] of Object.entries(ATTR_COOKIE_MAP)) {
		const value = getNestedAttrCookieValue(body, cookieName, propertyName);
		if (!value) continue;

		properties[propertyName] = value;
	}

	return properties;
}

async function enrichAttrEvent(request: Request, body: Record<string, unknown>): Promise<boolean> {
	if (body.event !== ATTR_EVENT_NAME) return false;

	const attrProperties = {
		...getClientAttrCookieProperties(body),
		...getAttrCookieProperties(request),
	};

	if (Object.keys(attrProperties).length === 0) {
		return false;
	}

	const properties = readObject(body.properties) ?? {};
	body.properties = properties;

	for (const [key, value] of Object.entries(attrProperties)) {
		properties[key] = value;
	}

	const anonymousId =
		getString(body.anonymousId) ??
		getString(body.anonymous_id) ??
		getString(properties.anonymous_id) ??
		getString(properties.ajs_anonymous_id) ??
		'anon';

	const eventSignature = stableStringify(attrProperties);
	const eventHash = await sha256Hex(`${anonymousId}:${eventSignature}`);
	properties.event_id = `attr_${eventHash.slice(0, 32)}`;

	return true;
}

function isAttrEvent(body: Record<string, unknown>): boolean {
	return body.event === ATTR_EVENT_NAME;
}

function getAttrEventFingerprint(body: Record<string, unknown>): string {
	if (!isAttrEvent(body)) return '';

	const properties = readObject(body.properties);
	const context = readObject(body.context);
	const attribution = readObject(context?.attribution);
	const fingerprint: Record<string, unknown> = {};

	if (properties) {
		for (const propertyName of Object.values(ATTR_COOKIE_MAP)) {
			const value = getString(properties[propertyName]);
			if (!value) continue;

			fingerprint[propertyName] = value;
		}
	}

	if (attribution && Object.keys(attribution).length > 0) {
		fingerprint.attribution = attribution;
	}

	if (Object.keys(fingerprint).length === 0) {
		return '';
	}

	return stableStringify(fingerprint);
}

async function shouldSuppressAttrEvent(request: Request, tenant: TenantConfig, body: Record<string, unknown>): Promise<{
	cookieHeaders: string[];
	suppressSegment: boolean;
}> {
	if (!isAttrEvent(body)) {
		return { cookieHeaders: [], suppressSegment: false };
	}

	const fingerprint = getAttrEventFingerprint(body);
	if (!fingerprint) {
		return { cookieHeaders: [], suppressSegment: true };
	}

	const signature = await sha256Hex(fingerprint);
	const cookies = parseCookie(request.headers.get('cookie') || '');
	if (cookies[ATTR_EVENT_SIGNATURE_COOKIE] === signature) {
		return { cookieHeaders: [], suppressSegment: true };
	}

	return {
		cookieHeaders: [cookie(ATTR_EVENT_SIGNATURE_COOKIE, signature, getCookieOptions(request, tenant))],
		suppressSegment: false,
	};
}

function getAllowedOrigin(origin: string | null): string | null {
	if (origin == null) return null;
	if (origin === 'null') return origin;

	const originUrl = tryParseUrl(origin);
	if (!originUrl) return null;

	const hostname = originUrl.hostname.toLowerCase();
	if (isConfiguredSite(hostname)) return origin;

	return null;
}

function appendVary(headers: Headers, value: string) {
	const existing = headers.get('Vary');
	if (!existing) {
		headers.set('Vary', value);
		return;
	}
	const parts = existing
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	if (!parts.includes(value)) {
		parts.push(value);
		headers.set('Vary', parts.join(', '));
	}
}

function applyCorsHeaders(headers: Headers, requestOrigin: string | null, allowedOrigin: string | null) {
	if (allowedOrigin) {
		headers.set('Access-Control-Allow-Origin', allowedOrigin);
		headers.set('Access-Control-Allow-Credentials', 'true');
		appendVary(headers, 'Origin');
		return;
	}

	if (requestOrigin == null) {
		headers.set('Access-Control-Allow-Origin', '*');
	}
}

function corsifyResponse(resp: Response, requestOrigin: string | null, allowedOrigin: string | null): Response {
	const headers = new Headers(resp.headers);
	applyCorsHeaders(headers, requestOrigin, allowedOrigin);

	return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
}

function handlePreflight(request: Request, requestOrigin: string | null, allowedOrigin: string | null): Response {
	const headers = new Headers();
	applyCorsHeaders(headers, requestOrigin, allowedOrigin);

	headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

	const requestedHeaders = request.headers.get('Access-Control-Request-Headers');
	if (requestedHeaders) {
		headers.set('Access-Control-Allow-Headers', requestedHeaders);
		appendVary(headers, 'Access-Control-Request-Headers');
	} else {
		headers.set('Access-Control-Allow-Headers', 'Content-Type');
	}

	headers.set('Access-Control-Max-Age', '86400');

	return new Response(null, { status: 204, headers });
}

/**********************************************************************
 * /route/ck - Legacy attribution ping endpoint
 *********************************************************************/
async function handleCkRequest(_request: Request): Promise<Response> {
	return new Response(JSON.stringify({ ok: true, skipped: true }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});
}

/**********************************************************************
 * ENRICH Segment events with observed attribution values
 *********************************************************************/
async function prepareSegmentEvent(req: Request, tenant: TenantConfig): Promise<PreparedSegmentEvent> {
	/* Only POSTs that go through the Segment proxy's /evs/ endpoint */
	if (req.method !== 'POST' || !/\/evs\//.test(new URL(req.url).pathname)) {
		return { request: req, cookieHeaders: [], suppressSegment: false };
	}

	let body: Record<string, unknown>;
	try {
		body = (await req.clone().json()) as Record<string, unknown>;
	} catch {
		return { request: req, cookieHeaders: [], suppressSegment: false };
	} // not JSON => ignore

	const pageUrl = getSegmentPageUrl(body);
	const attribution = buildAvailableAttribution(req, pageUrl, body);
	const cookies = parseCookie(req.headers.get('cookie') || '');
	const cookieHeaders = getCurrentAttributionCookieHeaders(req, tenant, cookies, attribution);
	let didEnrichBody = await enrichAttrEvent(req, body);

	/* Helper for filling the campaign object */
	const put = (k: string, v?: string) => {
		if (v == null || v === '') return;

		const context = readObject(body.context) ?? {};
		body.context = context;

		const attribution = readObject(context.attribution) ?? {};
		context.attribution = attribution;

		if (attribution[k] === v) return;

		attribution[k] = v;
		didEnrichBody = true;
	};

	for (const [key, value] of Object.entries(attribution)) {
		put(key, value);
	}

	if (!didEnrichBody) {
		const attrForwarding = await shouldSuppressAttrEvent(req, tenant, body);
		return {
			request: req,
			cookieHeaders: [...cookieHeaders, ...attrForwarding.cookieHeaders],
			suppressSegment: attrForwarding.suppressSegment,
		};
	}

	const attrForwarding = await shouldSuppressAttrEvent(req, tenant, body);

	return {
		request: new Request(req, { body: JSON.stringify(body) }),
		cookieHeaders: [...cookieHeaders, ...attrForwarding.cookieHeaders],
		suppressSegment: attrForwarding.suppressSegment,
	};
}

/**********************************************************************
 * WORKER ENTRY POINT
 *********************************************************************/

const productionWritekey = 'LeGcqnjII4aW9yoAMyrjcfcKjrSCqIvY';

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const requestOrigin = request.headers.get('origin');
		const allowedOrigin = getAllowedOrigin(requestOrigin);
		let isRoute = false;

		try {
			const url = new URL(request.url);
			const path = url.pathname;
			const tenant = getRequestTenant(request);

			isRoute = path.startsWith(`/${ROUTE_PREFIX}/`);
			const isCk = path === CK_PATH;
			// Strict preflight handling for credentialed cross-origin calls.
			if (isRoute && request.method === 'OPTIONS') {
				return handlePreflight(request, requestOrigin, allowedOrigin);
			}

			// /route/ck - attribution cookie endpoint (no Segment SDK involvement)
			if (isCk) {
				const resp = await handleCkRequest(request);
				return corsifyResponse(resp, requestOrigin, allowedOrigin);
			}

			/* ──────────────────────────────────────────────────────────────
			 * 1️⃣  INBOUND  – decorate **only** Segment event POSTs
			 *
			 * `prepareSegmentEvent`:
			 *   • Detects               POSTs whose pathname matches  /evs/
			 *   • Injects observed URL params and tracking cookies into
			 *     body.context.attribution
			 *   • For every other request (HTML, JS, API, images …)
			 *     it returns the original Request untouched, so the overhead
			 *     is just a single `if` and function call.
			 * ──────────────────────────────────────────────────────────── */
			const preparedEvent = await prepareSegmentEvent(request, tenant);
			if (preparedEvent.suppressSegment) {
				const resp = appendSetCookieHeaders(new Response(null, { status: 204 }), preparedEvent.cookieHeaders);
				return isRoute ? corsifyResponse(resp, requestOrigin, allowedOrigin) : resp;
			}

			/* ──────────────────────────────────────────────────────────────
			 * 2️⃣  SEGMENT EDGE SDK
			 *
			 *  We forward the (possibly enriched) request to the SDK.
			 *  The SDK:
			 *     • Serves first-party AJS at   /route/ajs/<hash>
			 *     • Serves settings at          /route/v1/projects/<writeKey>/settings
			 *     • Proxies browser events to   /route/evs/*
			 *
			 *  We don't patch its internals; all enrichment happens *before*
			 *  the call.
			 * ──────────────────────────────────────────────────────────── */
			const segment = new Segment(
				{
					writeKey: productionWritekey,
					routePrefix: ROUTE_PREFIX, // path prefix for serving Segment assets
				},
				{
					// Dedicated subdomain mode (do NOT proxy origin pages)
					ajsInjection: false,
					edgeVariations: false,
					proxyOrigin: false,
					serverSideCookies: true,
					// Hide writeKey from browser responses and inject it server-side
					redactWritekey: true,
					// Reduce attack surface: disable unused features/endpoints.
					clientSideTraits: false,
					engageIncomingWebhook: false,
					useProfilesAPI: false,
				},
			);

			const segmentResp = await segment.handleEvent(preparedEvent.request);
			const resp = appendSetCookieHeaders(segmentResp, preparedEvent.cookieHeaders);

			// Ensure /route endpoints are credentialed CORS compatible across subdomains.
			return isRoute ? corsifyResponse(resp, requestOrigin, allowedOrigin) : resp;
		} catch (err) {
			console.error('worker_error', err);
			const resp = new Response(JSON.stringify({ error: 'Internal error' }), {
				status: 502,
				headers: { 'Content-Type': 'application/json' },
			});
			return isRoute ? corsifyResponse(resp, requestOrigin, allowedOrigin) : resp;
		}
	},
};

// Documentation: https://github.com/segmentio/analytics-edge/blob/main/packages/edge-sdk/README.md
