import {
	HttpError,
	appendSetCookieHeaders,
	getAnonymousIdCookieHeaders,
	getLocalAnonymousId,
	getString,
	normalizeAnonymousId,
	readJsonObject,
	type Env,
	type TenantConfig,
} from '../jitsu-proxy';
import {
	createSignedConsentCookie,
	createUnknownConsent,
	recordToEventConsent,
} from './cookie';
import { deriveSubjectKey } from './crypto';
import {
	createConsentChoice,
	resolveSharedConsent,
	saveConsentRecord,
} from './service';
import { CONSENT_POLICY_VERSION } from './types';

export const CONSENT_BOOTSTRAP_PATH = '/consent/bootstrap';
export const CONSENT_STATE_PATH = '/consent/state';

function requireConsentSecret(env: Env): string {
	const secret = getString(env.CONSENT_SECRET);
	if (!secret || new TextEncoder().encode(secret).length < 32) {
		throw new HttpError(503, 'Consent secret is not configured');
	}

	return secret;
}

function getSourceDomain(request: Request, tenant: TenantConfig): string {
	const origin = request.headers.get('Origin');
	if (!origin) return tenant.cookieDomain;

	try {
		return new URL(origin).hostname.toLowerCase();
	} catch {
		return tenant.cookieDomain;
	}
}

function getSuppliedAnonymousId(body: Record<string, unknown>): string | undefined {
	const rawValue = getString(body.anonymousId) ?? getString(body.anonymous_id);
	if (!rawValue) return undefined;

	const anonymousId = normalizeAnonymousId(rawValue);
	if (!anonymousId) {
		throw new HttpError(400, 'Anonymous ID is invalid');
	}

	return anonymousId;
}

function getResolvedIdentity(
	request: Request,
	tenant: TenantConfig,
	body: Record<string, unknown>,
): {
	anonymousId: string;
	localAnonymousId?: string;
	cookieHeaders: string[];
} {
	const localAnonymousId = getLocalAnonymousId(request);
	const suppliedAnonymousId = getSuppliedAnonymousId(body);
	const anonymousId =
		suppliedAnonymousId ??
		localAnonymousId ??
		crypto.randomUUID();

	return {
		anonymousId,
		localAnonymousId,
		cookieHeaders: getAnonymousIdCookieHeaders(
			request,
			tenant,
			anonymousId,
		),
	};
}

function assertPolicyVersion(body: Record<string, unknown>): void {
	const policyVersion = getString(body.policyVersion);
	if (!policyVersion || policyVersion === CONSENT_POLICY_VERSION) return;

	throw new HttpError(409, 'Consent policy version is not supported');
}

function getRequiredBoolean(
	body: Record<string, unknown>,
	key: 'preferences' | 'statistics' | 'marketing',
): boolean {
	const value = body[key];
	if (typeof value !== 'boolean') {
		throw new HttpError(400, `${key} must be a boolean`);
	}

	return value;
}

function getOptionalBoolean(
	body: Record<string, unknown>,
	key: 'gpcApplied',
): boolean {
	const value = body[key];
	if (value == null) return false;
	if (typeof value !== 'boolean') {
		throw new HttpError(400, `${key} must be a boolean`);
	}

	return value;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'Cache-Control': 'no-store',
			'Content-Type': 'application/json',
		},
	});
}

export function isConsentPath(path: string): boolean {
	return path === CONSENT_BOOTSTRAP_PATH || path === CONSENT_STATE_PATH;
}

export async function handleConsentBootstrap(
	request: Request,
	env: Env,
	tenant: TenantConfig,
): Promise<Response> {
	const body = await readJsonObject(request);
	assertPolicyVersion(body);

	const secret = requireConsentSecret(env);
	const identity = getResolvedIdentity(request, tenant, body);
	const record = await resolveSharedConsent(
		env,
		identity.anonymousId,
		identity.localAnonymousId,
		getSourceDomain(request, tenant),
	);
	const consent = record
		? recordToEventConsent(record)
		: createUnknownConsent();
	const subjectKey = record?.subjectKey ??
		await deriveSubjectKey(secret, identity.anonymousId);
	const consentCookie = await createSignedConsentCookie(
		request,
		tenant,
		secret,
		subjectKey,
		consent,
	);
	const response = jsonResponse({
		status: record ? 'explicit' : 'no_record',
		consent: record
			? {
				preferences: record.preferences,
				statistics: record.statistics,
				marketing: record.marketing,
				responseType: record.responseType,
				gpcApplied: record.gpcApplied,
				revision: record.revision,
				policyVersion: record.policyVersion,
			}
			: null,
	});

	return appendSetCookieHeaders(
		response,
		[...identity.cookieHeaders, consentCookie],
	);
}

export async function handleConsentState(
	request: Request,
	env: Env,
	tenant: TenantConfig,
): Promise<Response> {
	const body = await readJsonObject(request);
	assertPolicyVersion(body);

	const secret = requireConsentSecret(env);
	const identity = getResolvedIdentity(request, tenant, body);
	const choice = createConsentChoice({
		preferences: getRequiredBoolean(body, 'preferences'),
		statistics: getRequiredBoolean(body, 'statistics'),
		marketing: getRequiredBoolean(body, 'marketing'),
		gpcApplied: getOptionalBoolean(body, 'gpcApplied'),
		sourceDomain: getSourceDomain(request, tenant),
	});
	const record = await saveConsentRecord(
		env,
		identity.anonymousId,
		choice,
	);
	const consent = recordToEventConsent(record);
	const consentCookie = await createSignedConsentCookie(
		request,
		tenant,
		secret,
		record.subjectKey,
		consent,
	);
	const response = jsonResponse({
		status: 'saved',
		consent: {
			preferences: record.preferences,
			statistics: record.statistics,
			marketing: record.marketing,
			responseType: record.responseType,
			gpcApplied: record.gpcApplied,
			revision: record.revision,
			policyVersion: record.policyVersion,
		},
	});

	return appendSetCookieHeaders(
		response,
		[...identity.cookieHeaders, consentCookie],
	);
}
