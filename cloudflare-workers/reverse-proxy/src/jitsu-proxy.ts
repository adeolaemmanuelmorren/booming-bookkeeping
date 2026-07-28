import { parse as parseCookie, stringify as cookie, type Attributes } from 'worktop/cookie';
import type { PurchaseState } from './stripe/purchase-state';
import type { PurchaseEnv } from './stripe/types';

export interface Env extends PurchaseEnv {
	JITSU_CLOUD_HOST: string;
	JITSU_WRITE_KEY: string;
	PURCHASE_STATE: DurableObjectNamespace<PurchaseState>;
}

/**********************************************************************
 *  ROUTING / DEPLOYMENT
 *********************************************************************/
export const CK_PATH = '/route/ck';
export const JITSU_SCRIPT_PATH = '/p.js';
const JITSU_BATCH_PATH = '/v1/batch';
const JITSU_EVENT_PATHS = new Set([
	'/api/s/page',
	'/api/s/track',
	'/api/s/identify',
	'/api/s/group',
	'/api/s/event',
]);

const ATTR_CURRENT_COOKIE = '_attr_current';
const ATTR_CURRENT_JS_COOKIE = '_attr_current_js';
const ATTR_EVENT_SIGNATURE_COOKIE = '_attr_event_sig';
const JITSU_ANONYMOUS_ID_COOKIE = '__eventn_id';
const JITSU_SERVER_ANONYMOUS_ID_COOKIE = '__eventn_id_srvr';
const SEGMENT_ANONYMOUS_ID_COOKIE = 'ajs_anonymous_id';

const ANONYMOUS_ID_MAX_AGE = 60 * 60 * 24 * 365 * 5;
const MAX_EVENT_BODY_BYTES = 1024 * 1024;
const JITSU_UPSTREAM_TIMEOUT_MS = 8000;
const ANONYMOUS_ID_PATTERN = /^[A-Za-z0-9._~-]{8,128}$/;

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

type PreparedJitsuEvent = {
	body: Record<string, unknown>;
	cookieHeaders: string[];
	suppressUpstream: boolean;
};

type ResolvedIdentity = {
	anonymousId: string;
	cookieHeaders: string[];
};

export type TenantConfig = {
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

function normalizeAnonymousId(value: unknown): string | undefined {
	let normalized = getString(value);
	if (!normalized) return undefined;

	try {
		normalized = decodeURIComponent(normalized);
	} catch {
		// Use the raw value when legacy percent-encoding is malformed.
	}

	try {
		const parsed = JSON.parse(normalized);
		if (typeof parsed === 'string') normalized = parsed;
	} catch {
		// A normal UUID is not JSON, so parsing failure is expected.
	}

	normalized = normalized.trim();
	if (!ANONYMOUS_ID_PATTERN.test(normalized)) return undefined;

	return normalized;
}

function isJitsuEventPath(path: string): boolean {
	return JITSU_EVENT_PATHS.has(path) || path === JITSU_BATCH_PATH;
}

export function isJitsuWorkerPath(path: string): boolean {
	return path === CK_PATH ||
		path === JITSU_SCRIPT_PATH ||
		isJitsuEventPath(path);
}

function getTenantForHostname(hostname: string): TenantConfig | null {
	const normalizedHostname = hostname.toLowerCase();

	return TENANTS.find((tenant) => tenant.trackingHost === normalizedHostname) ?? null;
}

function getRequestTenant(request: Request): TenantConfig | null {
	return getTenantForHostname(new URL(request.url).hostname);
}

function isTenantSite(hostname: string, tenant: TenantConfig): boolean {
	const normalizedHostname = hostname.toLowerCase();

	return normalizedHostname === tenant.cookieDomain || normalizedHostname.endsWith(`.${tenant.cookieDomain}`);
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

function getAnonymousIdCookieHeaders(request: Request, tenant: TenantConfig, anonymousId: string): string[] {
	const readableOptions = {
		...getReadableCookieOptions(request, tenant, ANONYMOUS_ID_MAX_AGE),
		secure: true,
	};
	const serverOptions = {
		...getHttpOnlyCookieOptions(request, tenant, ANONYMOUS_ID_MAX_AGE),
		secure: true,
	};

	return [
		cookie(JITSU_ANONYMOUS_ID_COOKIE, anonymousId, readableOptions),
		cookie(JITSU_SERVER_ANONYMOUS_ID_COOKIE, anonymousId, serverOptions),
	];
}

function getHandoffIdentity(url: URL): { anonymousId?: string; conflict: boolean } {
	const hasAjsAid = url.searchParams.has('ajs_aid');
	const hasAnAid = url.searchParams.has('an_aid');
	const ajsAid = normalizeAnonymousId(url.searchParams.get('ajs_aid'));
	const anAid = normalizeAnonymousId(url.searchParams.get('an_aid'));

	if (hasAjsAid && hasAnAid) {
		if (ajsAid && anAid && ajsAid === anAid) {
			return { anonymousId: ajsAid, conflict: false };
		}

		return { conflict: true };
	}

	if (hasAjsAid) {
		return ajsAid ? { anonymousId: ajsAid, conflict: false } : { conflict: true };
	}

	if (hasAnAid) {
		return anAid ? { anonymousId: anAid, conflict: false } : { conflict: true };
	}

	return { conflict: false };
}

function resolveAnonymousIdentity(
	request: Request,
	tenant: TenantConfig,
	payloadAnonymousId?: string,
): ResolvedIdentity {
	const handoff = getHandoffIdentity(new URL(request.url));
	const cookies = parseCookie(request.headers.get('cookie') || '');
	const anonymousId =
		handoff.anonymousId ??
		normalizeAnonymousId(cookies[JITSU_SERVER_ANONYMOUS_ID_COOKIE]) ??
		normalizeAnonymousId(cookies[JITSU_ANONYMOUS_ID_COOKIE]) ??
		normalizeAnonymousId(cookies[SEGMENT_ANONYMOUS_ID_COOKIE]) ??
		payloadAnonymousId ??
		crypto.randomUUID();

	if (handoff.conflict) {
		console.warn('anonymous_id_handoff_conflict');
	}

	return {
		anonymousId,
		cookieHeaders: getAnonymousIdCookieHeaders(request, tenant, anonymousId),
	};
}

function getPayloadAnonymousId(path: string, body: Record<string, unknown>): string | undefined {
	if (path !== JITSU_BATCH_PATH) {
		return normalizeAnonymousId(body.anonymousId) ?? normalizeAnonymousId(body.anonymous_id);
	}

	if (!Array.isArray(body.batch)) return undefined;

	for (const rawEvent of body.batch) {
		const event = readObject(rawEvent);
		if (!event) continue;

		const eventAnonymousId =
			normalizeAnonymousId(event.anonymousId) ?? normalizeAnonymousId(event.anonymous_id);
		if (eventAnonymousId) return eventAnonymousId;
	}

	return undefined;
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

function getEventPageUrl(body: Record<string, unknown>): URL | null {
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
	suppressUpstream: boolean;
}> {
	if (!isAttrEvent(body)) {
		return { cookieHeaders: [], suppressUpstream: false };
	}

	const fingerprint = getAttrEventFingerprint(body);
	if (!fingerprint) {
		return { cookieHeaders: [], suppressUpstream: true };
	}

	const signature = await sha256Hex(fingerprint);
	const cookies = parseCookie(request.headers.get('cookie') || '');
	if (cookies[ATTR_EVENT_SIGNATURE_COOKIE] === signature) {
		return { cookieHeaders: [], suppressUpstream: true };
	}

	return {
		cookieHeaders: [cookie(ATTR_EVENT_SIGNATURE_COOKIE, signature, getCookieOptions(request, tenant))],
		suppressUpstream: false,
	};
}

function getAllowedOrigin(origin: string | null, tenant: TenantConfig): string | null {
	if (origin == null) return null;

	const originUrl = tryParseUrl(origin);
	if (!originUrl) return null;

	const hostname = originUrl.hostname.toLowerCase();
	if (isTenantSite(hostname, tenant)) return origin;

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

function applyCorsHeaders(headers: Headers, allowedOrigin: string | null) {
	if (allowedOrigin) {
		headers.set('Access-Control-Allow-Origin', allowedOrigin);
		headers.set('Access-Control-Allow-Credentials', 'true');
		appendVary(headers, 'Origin');
	}
}

function corsifyResponse(resp: Response, allowedOrigin: string | null): Response {
	const headers = new Headers(resp.headers);
	applyCorsHeaders(headers, allowedOrigin);

	return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
}

function handlePreflight(allowedOrigin: string | null): Response {
	const headers = new Headers();
	applyCorsHeaders(headers, allowedOrigin);

	headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

	headers.set('Access-Control-Allow-Headers', 'Content-Type');

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
 * ENRICH Jitsu events with observed attribution values
 *********************************************************************/
function applyAuthoritativeIdentity(request: Request, body: Record<string, unknown>, anonymousId: string) {
	body.anonymousId = anonymousId;
	delete body.anonymous_id;

	const context = readObject(body.context) ?? {};
	body.context = context;

	const clientIp = getString(request.headers.get('CF-Connecting-IP'));
	if (clientIp) {
		context.ip = clientIp;
	} else {
		delete context.ip;
	}

	const userAgent = getString(request.headers.get('User-Agent'));
	if (userAgent) {
		context.userAgent = userAgent;
	}
}

async function prepareJitsuEvent(
	request: Request,
	tenant: TenantConfig,
	body: Record<string, unknown>,
	anonymousId: string,
): Promise<PreparedJitsuEvent> {
	applyAuthoritativeIdentity(request, body, anonymousId);

	const pageUrl = getEventPageUrl(body);
	const attribution = buildAvailableAttribution(request, pageUrl, body);
	const cookies = parseCookie(request.headers.get('cookie') || '');
	const cookieHeaders = getCurrentAttributionCookieHeaders(request, tenant, cookies, attribution);
	await enrichAttrEvent(request, body);

	const put = (key: string, value?: string) => {
		if (!value) return;

		const context = readObject(body.context) ?? {};
		body.context = context;

		const existingAttribution = readObject(context.attribution) ?? {};
		context.attribution = existingAttribution;

		if (existingAttribution[key] === value) return;

		existingAttribution[key] = value;
	};

	for (const [key, value] of Object.entries(attribution)) {
		put(key, value);
	}

	const attrForwarding = await shouldSuppressAttrEvent(request, tenant, body);

	return {
		body,
		cookieHeaders: [...cookieHeaders, ...attrForwarding.cookieHeaders],
		suppressUpstream: attrForwarding.suppressUpstream,
	};
}

function dedupeCookieHeaders(cookieHeaders: string[]): string[] {
	const cookiesByName = new Map<string, string>();

	for (const cookieHeader of cookieHeaders) {
		const equalsIndex = cookieHeader.indexOf('=');
		const name = equalsIndex >= 0 ? cookieHeader.slice(0, equalsIndex) : cookieHeader;
		cookiesByName.set(name, cookieHeader);
	}

	return [...cookiesByName.values()];
}

class HttpError extends Error {
	constructor(
		public readonly status: number,
		message: string,
	) {
		super(message);
	}
}

function getJitsuCloudUrl(env: Env, path: string): URL {
	const configuredHost = getString(env.JITSU_CLOUD_HOST);
	if (!configuredHost) {
		throw new HttpError(503, 'Jitsu Cloud host is not configured');
	}

	let upstreamUrl: URL;
	try {
		upstreamUrl = new URL(configuredHost);
	} catch {
		throw new HttpError(503, 'Jitsu Cloud host is invalid');
	}

	if (upstreamUrl.protocol !== 'https:') {
		throw new HttpError(503, 'Jitsu Cloud host must use HTTPS');
	}

	upstreamUrl.pathname = path;
	upstreamUrl.search = '';
	upstreamUrl.hash = '';

	return upstreamUrl;
}

function getJitsuWriteKey(env: Env): string {
	const writeKey = getString(env.JITSU_WRITE_KEY);
	if (!writeKey) {
		throw new HttpError(503, 'Jitsu write key is not configured');
	}

	return writeKey;
}

async function fetchJitsu(input: URL, init: RequestInit): Promise<Response> {
	const abortController = new AbortController();
	const timeoutId = setTimeout(() => abortController.abort(), JITSU_UPSTREAM_TIMEOUT_MS);

	try {
		return await fetch(input, {
			...init,
			signal: abortController.signal,
		});
	} catch (error) {
		if (abortController.signal.aborted) {
			throw new HttpError(504, 'Jitsu Cloud request timed out');
		}

		throw error;
	} finally {
		clearTimeout(timeoutId);
	}
}

function isJsonRequest(request: Request): boolean {
	const contentType = request.headers.get('Content-Type') ?? '';
	return contentType.toLowerCase().split(';', 1)[0].trim() === 'application/json';
}

async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
	if (!isJsonRequest(request)) {
		throw new HttpError(415, 'Content-Type must be application/json');
	}

	const declaredLength = Number(request.headers.get('Content-Length') ?? '0');
	if (Number.isFinite(declaredLength) && declaredLength > MAX_EVENT_BODY_BYTES) {
		throw new HttpError(413, 'Request body is too large');
	}

	const bodyText = await request.text();
	if (new TextEncoder().encode(bodyText).byteLength > MAX_EVENT_BODY_BYTES) {
		throw new HttpError(413, 'Request body is too large');
	}

	let body: unknown;
	try {
		body = JSON.parse(bodyText);
	} catch {
		throw new HttpError(400, 'Request body must be valid JSON');
	}

	const bodyObject = readObject(body);
	if (!bodyObject) {
		throw new HttpError(400, 'Request body must be a JSON object');
	}

	return bodyObject;
}

async function forwardJitsuEvent(
	env: Env,
	path: string,
	body: Record<string, unknown>,
): Promise<Response> {
	const upstreamUrl = getJitsuCloudUrl(env, path);
	const upstreamResponse = await fetchJitsu(upstreamUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Write-Key': getJitsuWriteKey(env),
		},
		body: JSON.stringify(body),
	});
	const responseText = await upstreamResponse.text();
	const contentType = upstreamResponse.headers.get('Content-Type') ?? 'application/json';

	if (responseText && contentType.toLowerCase().includes('application/json')) {
		try {
			JSON.parse(responseText);
		} catch {
			throw new HttpError(502, 'Jitsu Cloud returned malformed JSON');
		}
	}

	const headers = new Headers({
		'Cache-Control': 'no-store',
		'Content-Type': contentType,
	});
	const responseBody = [204, 205, 304].includes(upstreamResponse.status) ? null : responseText;

	return new Response(responseBody, {
		status: upstreamResponse.status,
		statusText: upstreamResponse.statusText,
		headers,
	});
}

async function handleJitsuEventRequest(
	request: Request,
	env: Env,
	tenant: TenantConfig,
): Promise<Response> {
	const path = new URL(request.url).pathname;
	const requestBody = await readJsonObject(request);
	const payloadAnonymousId = getPayloadAnonymousId(path, requestBody);
	const identity = resolveAnonymousIdentity(request, tenant, payloadAnonymousId);
	const cookieHeaders = [...identity.cookieHeaders];

	if (path !== JITSU_BATCH_PATH) {
		const preparedEvent = await prepareJitsuEvent(request, tenant, requestBody, identity.anonymousId);
		cookieHeaders.push(...preparedEvent.cookieHeaders);

		if (preparedEvent.suppressUpstream) {
			return appendSetCookieHeaders(new Response(null, { status: 204 }), dedupeCookieHeaders(cookieHeaders));
		}

		const response = await forwardJitsuEvent(env, path, preparedEvent.body);
		return appendSetCookieHeaders(response, dedupeCookieHeaders(cookieHeaders));
	}

	const batch = requestBody.batch;
	if (!Array.isArray(batch)) {
		throw new HttpError(400, 'Batch requests require a batch array');
	}

	const batchContext = readObject(requestBody.context);
	const forwardedEvents: Record<string, unknown>[] = [];
	for (const rawEvent of batch) {
		const event = readObject(rawEvent);
		if (!event) {
			throw new HttpError(400, 'Every batch item must be a JSON object');
		}

		if (batchContext) {
			event.context = {
				...batchContext,
				...(readObject(event.context) ?? {}),
			};
		}

		const preparedEvent = await prepareJitsuEvent(request, tenant, event, identity.anonymousId);
		cookieHeaders.push(...preparedEvent.cookieHeaders);

		if (!preparedEvent.suppressUpstream) {
			forwardedEvents.push(preparedEvent.body);
		}
	}

	if (forwardedEvents.length === 0) {
		return appendSetCookieHeaders(new Response(null, { status: 204 }), dedupeCookieHeaders(cookieHeaders));
	}

	requestBody.batch = forwardedEvents;
	delete requestBody.writeKey;

	const response = await forwardJitsuEvent(env, path, requestBody);
	return appendSetCookieHeaders(response, dedupeCookieHeaders(cookieHeaders));
}

async function handleJitsuScriptRequest(
	env: Env,
	identity: ResolvedIdentity,
): Promise<Response> {
	const upstreamUrl = getJitsuCloudUrl(env, JITSU_SCRIPT_PATH);
	const upstreamResponse = await fetchJitsu(upstreamUrl, { method: 'GET' });

	if (!upstreamResponse.ok) {
		throw new HttpError(502, 'Jitsu browser SDK is unavailable');
	}

	const headers = new Headers({
		'Cache-Control': 'private, no-store',
		'Content-Type': upstreamResponse.headers.get('Content-Type') ?? 'application/javascript; charset=utf-8',
		'X-Content-Type-Options': 'nosniff',
	});

	const response = new Response(upstreamResponse.body, {
		status: 200,
		headers,
	});

	return appendSetCookieHeaders(response, identity.cookieHeaders);
}

function errorResponse(error: unknown): Response {
	if (error instanceof HttpError) {
		return new Response(JSON.stringify({ error: error.message }), {
			status: error.status,
			headers: {
				'Cache-Control': 'no-store',
				'Content-Type': 'application/json',
			},
		});
	}

	console.error('worker_error', error instanceof Error ? error.message : 'unknown_error');

	return new Response(JSON.stringify({ error: 'Upstream request failed' }), {
		status: 502,
		headers: {
			'Cache-Control': 'no-store',
			'Content-Type': 'application/json',
		},
	});
}

export {
	HttpError,
	appendSetCookieHeaders,
	corsifyResponse,
	errorResponse,
	getAllowedOrigin,
	getRequestTenant,
	getString,
	handleCkRequest,
	handleJitsuEventRequest,
	handleJitsuScriptRequest,
	handlePreflight,
	normalizeAnonymousId,
	readJsonObject,
	readObject,
	resolveAnonymousIdentity,
	tryParseUrl,
};
