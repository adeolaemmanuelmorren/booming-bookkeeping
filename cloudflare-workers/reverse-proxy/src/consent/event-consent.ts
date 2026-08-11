import type { Env, TenantConfig } from '../jitsu-proxy';
import { deriveSubjectKey } from './crypto';
import {
	createSignedConsentCookie,
	createUnknownConsent,
	readSignedConsentCookie,
	recordToEventConsent,
} from './cookie';
import { getConsentRecord } from './service';
import {
	CONSENT_POLICY_VERSION,
	type EventConsent,
} from './types';

export const BROWSER_CONSENT_HEADER = 'X-Boom-Consent';

type ResolvedEventConsent = {
	consent: EventConsent;
	cookieHeaders: string[];
};

function getString(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;

	const trimmed = value.trim();
	return trimmed || undefined;
}

function readObject(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
}

function getNullableBoolean(
	value: unknown,
): boolean | null | undefined {
	if (value === true || value === false || value === null) return value;
	return undefined;
}

function readBrowserConsent(request: Request): EventConsent | null {
	const rawValue = getString(request.headers.get(BROWSER_CONSENT_HEADER));
	if (!rawValue) return null;

	let parsed: unknown;
	try {
		parsed = JSON.parse(rawValue);
	} catch {
		return null;
	}

	const value = readObject(parsed);
	if (!value) return null;

	const responseStatus = getString(value.responseStatus);
	if (responseStatus !== 'unanswered' && responseStatus !== 'unknown') {
		return null;
	}

	const preferences = getNullableBoolean(value.preferences);
	const statistics = getNullableBoolean(value.statistics);
	const marketing = getNullableBoolean(value.marketing);
	if (preferences === undefined || statistics === undefined || marketing === undefined) {
		return null;
	}

	if (responseStatus === 'unknown' &&
		(preferences !== null || statistics !== null || marketing !== null)) {
		return null;
	}

	if (responseStatus === 'unanswered' &&
		(preferences === null || statistics === null || marketing === null)) {
		return null;
	}

	return {
		preferences,
		statistics,
		marketing,
		responseStatus,
		revision: 0,
		policyVersion: CONSENT_POLICY_VERSION,
		expiresAt: Date.now() + 60 * 60 * 1000,
	};
}

function applyBrowserSnapshot(
	signedConsent: EventConsent,
	browserConsent: EventConsent | null,
): EventConsent {
	if (signedConsent.responseStatus !== 'unknown') return signedConsent;
	return browserConsent ?? signedConsent;
}

export async function resolveEventConsent(
	request: Request,
	env: Env,
	tenant: TenantConfig,
	anonymousId: string,
): Promise<ResolvedEventConsent> {
	const browserConsent = readBrowserConsent(request);

	try {
		if (!env.CONSENT_SECRET ||
			new TextEncoder().encode(env.CONSENT_SECRET).length < 32 ||
			!env.CONSENT_SHARD) {
			return {
				consent: browserConsent ?? createUnknownConsent(),
				cookieHeaders: [],
			};
		}

		const subjectKey = await deriveSubjectKey(
			env.CONSENT_SECRET,
			anonymousId,
		);
		const signedConsent = await readSignedConsentCookie(
			request,
			env.CONSENT_SECRET,
			subjectKey,
		);

		if (signedConsent?.policyVersion === CONSENT_POLICY_VERSION) {
			return {
				consent: applyBrowserSnapshot(signedConsent, browserConsent),
				cookieHeaders: [],
			};
		}

		const record = await getConsentRecord(env, anonymousId);
		const consent = record
			? recordToEventConsent(record)
			: browserConsent ?? createUnknownConsent();
		const cookieConsent = record
			? consent
			: createUnknownConsent();
		const consentCookie = await createSignedConsentCookie(
			request,
			tenant,
			env.CONSENT_SECRET,
			subjectKey,
			cookieConsent,
		);

		return {
			consent,
			cookieHeaders: [consentCookie],
		};
	} catch {
		console.warn('consent_resolution_failed');

		return {
			consent: browserConsent ?? createUnknownConsent(),
			cookieHeaders: [],
		};
	}
}

export function applyConsentContext(
	body: Record<string, unknown>,
	consent: EventConsent,
): void {
	const context = readObject(body.context) ?? {};
	body.context = context;

	context.consent = {
		preferences: consent.preferences,
		statistics: consent.statistics,
		marketing: consent.marketing,
		responseStatus: consent.responseStatus,
		revision: consent.revision,
		policyVersion: consent.policyVersion,
	};
}
