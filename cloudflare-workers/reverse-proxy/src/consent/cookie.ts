import { parse as parseCookie, stringify as cookie } from 'worktop/cookie';
import type { TenantConfig } from '../jitsu-proxy';
import {
	decodePayload,
	encodePayload,
	signValue,
	verifyValue,
} from './crypto';
import {
	CONSENT_POLICY_VERSION,
	type ConsentRecord,
	type ConsentResponseStatus,
	type EventConsent,
} from './types';

export const CONSENT_COOKIE_NAME = 'bb_consent_state';

const EXPLICIT_COOKIE_LIFETIME_MS = 365 * 24 * 60 * 60 * 1000;
const UNKNOWN_COOKIE_LIFETIME_MS = 60 * 60 * 1000;

type SignedConsentPayload = {
	version: 1;
	subjectKey: string;
	preferences: boolean | null;
	statistics: boolean | null;
	marketing: boolean | null;
	responseStatus: ConsentResponseStatus;
	revision: number;
	policyVersion: string;
	expiresAt: number;
};

function isNullableBoolean(value: unknown): value is boolean | null {
	return value === true || value === false || value === null;
}

function isResponseStatus(value: unknown): value is ConsentResponseStatus {
	return value === 'explicit' ||
		value === 'gpc' ||
		value === 'unanswered' ||
		value === 'unknown';
}

function parseSignedPayload(
	value: unknown,
	expectedSubjectKey: string,
	now: number,
): EventConsent | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

	const payload = value as Partial<SignedConsentPayload>;
	if (payload.version !== 1) return null;
	if (payload.subjectKey !== expectedSubjectKey) return null;
	if (!isNullableBoolean(payload.preferences)) return null;
	if (!isNullableBoolean(payload.statistics)) return null;
	if (!isNullableBoolean(payload.marketing)) return null;
	if (!isResponseStatus(payload.responseStatus)) return null;
	if (!Number.isInteger(payload.revision) || Number(payload.revision) < 0) return null;
	if (typeof payload.policyVersion !== 'string' || !payload.policyVersion) return null;
	if (!Number.isFinite(payload.expiresAt) || Number(payload.expiresAt) <= now) return null;

	return {
		preferences: payload.preferences,
		statistics: payload.statistics,
		marketing: payload.marketing,
		responseStatus: payload.responseStatus,
		revision: Number(payload.revision),
		policyVersion: payload.policyVersion,
		expiresAt: Number(payload.expiresAt),
	};
}

export function createUnknownConsent(now = Date.now()): EventConsent {
	return {
		preferences: null,
		statistics: null,
		marketing: null,
		responseStatus: 'unknown',
		revision: 0,
		policyVersion: CONSENT_POLICY_VERSION,
		expiresAt: now + UNKNOWN_COOKIE_LIFETIME_MS,
	};
}

export function recordToEventConsent(
	record: ConsentRecord,
	now = Date.now(),
): EventConsent {
	return {
		preferences: record.preferences,
		statistics: record.statistics,
		marketing: record.marketing,
		responseStatus: record.gpcApplied ? 'gpc' : 'explicit',
		revision: record.revision,
		policyVersion: record.policyVersion,
		expiresAt: Math.min(
			record.expiresAt ?? now + EXPLICIT_COOKIE_LIFETIME_MS,
			now + EXPLICIT_COOKIE_LIFETIME_MS,
		),
	};
}

export async function readSignedConsentCookie(
	request: Request,
	secret: string,
	expectedSubjectKey: string,
	now = Date.now(),
): Promise<EventConsent | null> {
	const cookies = parseCookie(request.headers.get('Cookie') ?? '');
	const signedValue = cookies[CONSENT_COOKIE_NAME];
	if (!signedValue) return null;

	const [encodedPayload, encodedSignature, extraPart] = signedValue.split('.');
	if (!encodedPayload || !encodedSignature || extraPart) return null;

	const isValid = await verifyValue(secret, encodedPayload, encodedSignature);
	if (!isValid) return null;

	return parseSignedPayload(
		decodePayload(encodedPayload),
		expectedSubjectKey,
		now,
	);
}

export async function createSignedConsentCookie(
	request: Request,
	tenant: TenantConfig,
	secret: string,
	subjectKey: string,
	consent: EventConsent,
	now = Date.now(),
): Promise<string> {
	const payload: SignedConsentPayload = {
		version: 1,
		subjectKey,
		...consent,
	};
	const encodedPayload = encodePayload(payload);
	const encodedSignature = await signValue(secret, encodedPayload);
	const maxage = Math.max(1, Math.floor((consent.expiresAt - now) / 1000));

	return cookie(
		CONSENT_COOKIE_NAME,
		`${encodedPayload}.${encodedSignature}`,
		{
			path: '/',
			domain: tenant.cookieDomain,
			maxage,
			samesite: 'Lax',
			secure: new URL(request.url).protocol === 'https:',
			httponly: true,
		},
	);
}
