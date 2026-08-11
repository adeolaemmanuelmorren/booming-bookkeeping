import type { ConsentShard } from './consent-shard';

export const CONSENT_POLICY_VERSION = 'v1';

export type ConsentResponseType =
	| 'opted_in'
	| 'opted_out'
	| 'custom'
	| 'gpc';

export type ConsentResponseStatus =
	| 'explicit'
	| 'gpc'
	| 'unanswered'
	| 'unknown';

export type ConsentChoice = {
	preferences: boolean;
	statistics: boolean;
	marketing: boolean;
	responseType: ConsentResponseType;
	gpcApplied: boolean;
	policyVersion: string;
	sourceDomain: string;
};

export type ConsentRecord = ConsentChoice & {
	subjectKey: string;
	revision: number;
	updatedAt: number;
	expiresAt: number | null;
};

export type EventConsent = {
	preferences: boolean | null;
	statistics: boolean | null;
	marketing: boolean | null;
	responseStatus: ConsentResponseStatus;
	revision: number;
	policyVersion: string;
	expiresAt: number;
};

export interface ConsentEnv {
	CONSENT_SECRET: string;
	CONSENT_SHARD: DurableObjectNamespace<ConsentShard>;
}
