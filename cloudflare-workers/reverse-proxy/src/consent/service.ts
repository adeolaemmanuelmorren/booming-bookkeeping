import { deriveSubjectKey } from './crypto';
import {
	CONSENT_POLICY_VERSION,
	type ConsentChoice,
	type ConsentEnv,
	type ConsentRecord,
	type ConsentResponseType,
} from './types';

const SHARD_COUNT = 32;

function getResponseType(
	preferences: boolean,
	statistics: boolean,
	marketing: boolean,
	gpcApplied: boolean,
): ConsentResponseType {
	if (gpcApplied) return 'gpc';
	if (preferences && statistics && marketing) return 'opted_in';
	if (!preferences && !statistics && !marketing) return 'opted_out';
	return 'custom';
}

function getShardNumber(subjectKey: string): number {
	const firstByte = Number.parseInt(subjectKey.slice(0, 2), 16);
	return firstByte & (SHARD_COUNT - 1);
}

function getConsentStub(env: ConsentEnv, subjectKey: string) {
	const shardNumber = getShardNumber(subjectKey);
	return env.CONSENT_SHARD.getByName(`consent-v1-${shardNumber}`);
}

function mergeRecords(
	primary: ConsentRecord | null,
	secondary: ConsentRecord | null,
	sourceDomain: string,
): ConsentChoice | null {
	if (!primary && !secondary) return null;

	if (!primary || !secondary) {
		const record = primary ?? secondary;
		if (!record) return null;

		return {
			preferences: record.preferences,
			statistics: record.statistics,
			marketing: record.marketing,
			responseType: record.responseType,
			gpcApplied: record.gpcApplied,
			policyVersion: CONSENT_POLICY_VERSION,
			sourceDomain,
		};
	}

	const preferences = primary.preferences && secondary.preferences;
	const statistics = primary.statistics && secondary.statistics;
	const marketing = primary.marketing && secondary.marketing;
	const gpcApplied = primary.gpcApplied || secondary.gpcApplied;

	return {
		preferences,
		statistics,
		marketing,
		responseType: getResponseType(
			preferences,
			statistics,
			marketing,
			gpcApplied,
		),
		gpcApplied,
		policyVersion: CONSENT_POLICY_VERSION,
		sourceDomain,
	};
}

export function createConsentChoice(input: {
	preferences: boolean;
	statistics: boolean;
	marketing: boolean;
	gpcApplied: boolean;
	sourceDomain: string;
}): ConsentChoice {
	return {
		...input,
		responseType: getResponseType(
			input.preferences,
			input.statistics,
			input.marketing,
			input.gpcApplied,
		),
		policyVersion: CONSENT_POLICY_VERSION,
	};
}

export async function getConsentRecord(
	env: ConsentEnv,
	anonymousId: string,
	now = Date.now(),
): Promise<ConsentRecord | null> {
	const subjectKey = await deriveSubjectKey(env.CONSENT_SECRET, anonymousId);
	const stub = getConsentStub(env, subjectKey);
	return stub.getConsent(subjectKey, now);
}

export async function saveConsentRecord(
	env: ConsentEnv,
	anonymousId: string,
	choice: ConsentChoice,
	now = Date.now(),
): Promise<ConsentRecord> {
	const subjectKey = await deriveSubjectKey(env.CONSENT_SECRET, anonymousId);
	const stub = getConsentStub(env, subjectKey);
	return stub.saveConsent(subjectKey, choice, now);
}

export async function resolveSharedConsent(
	env: ConsentEnv,
	anonymousId: string,
	localAnonymousId: string | undefined,
	sourceDomain: string,
	now = Date.now(),
): Promise<ConsentRecord | null> {
	const primaryPromise = getConsentRecord(env, anonymousId, now);

	if (!localAnonymousId || localAnonymousId === anonymousId) {
		return primaryPromise;
	}

	const [primary, secondary] = await Promise.all([
		primaryPromise,
		getConsentRecord(env, localAnonymousId, now),
	]);
	const mergedChoice = mergeRecords(primary, secondary, sourceDomain);
	if (!mergedChoice) return null;

	const [mergedPrimary] = await Promise.all([
		saveConsentRecord(
			env,
			anonymousId,
			mergedChoice,
			now,
		),
		saveConsentRecord(
			env,
			localAnonymousId,
			mergedChoice,
			now,
		),
	]);

	return mergedPrimary;
}
