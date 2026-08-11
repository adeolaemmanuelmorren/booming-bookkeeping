import { DurableObject } from 'cloudflare:workers';
import type {
	ConsentChoice,
	ConsentEnv,
	ConsentRecord,
	ConsentResponseType,
} from './types';

const AFFIRMATIVE_LIFETIME_MS = 365 * 24 * 60 * 60 * 1000;

type ConsentRow = {
	subject_key: string;
	revision: number;
	preferences: number;
	statistics: number;
	marketing: number;
	response_type: ConsentResponseType;
	gpc_applied: number;
	policy_version: string;
	source_domain: string;
	updated_at: number;
	expires_at: number | null;
};

function toRecord(row: ConsentRow): ConsentRecord {
	return {
		subjectKey: row.subject_key,
		revision: row.revision,
		preferences: row.preferences === 1,
		statistics: row.statistics === 1,
		marketing: row.marketing === 1,
		responseType: row.response_type,
		gpcApplied: row.gpc_applied === 1,
		policyVersion: row.policy_version,
		sourceDomain: row.source_domain,
		updatedAt: row.updated_at,
		expiresAt: row.expires_at,
	};
}

function choicesMatch(record: ConsentRecord, choice: ConsentChoice): boolean {
	return record.preferences === choice.preferences &&
		record.statistics === choice.statistics &&
		record.marketing === choice.marketing &&
		record.responseType === choice.responseType &&
		record.gpcApplied === choice.gpcApplied &&
		record.policyVersion === choice.policyVersion;
}

function getExpiry(choice: ConsentChoice, now: number): number | null {
	if (choice.responseType !== 'opted_in') return null;
	return now + AFFIRMATIVE_LIFETIME_MS;
}

export class ConsentShard extends DurableObject<ConsentEnv> {
	constructor(ctx: DurableObjectState, env: ConsentEnv) {
		super(ctx, env);

		ctx.blockConcurrencyWhile(async () => {
			this.ctx.storage.sql.exec(`
				CREATE TABLE IF NOT EXISTS consent_schema_versions (
					version INTEGER PRIMARY KEY
				);
				CREATE TABLE IF NOT EXISTS consent_records (
					subject_key TEXT PRIMARY KEY,
					revision INTEGER NOT NULL,
					preferences INTEGER NOT NULL,
					statistics INTEGER NOT NULL,
					marketing INTEGER NOT NULL,
					response_type TEXT NOT NULL,
					gpc_applied INTEGER NOT NULL,
					policy_version TEXT NOT NULL,
					source_domain TEXT NOT NULL,
					updated_at INTEGER NOT NULL,
					expires_at INTEGER
				);
				CREATE INDEX IF NOT EXISTS consent_records_expiry
					ON consent_records (expires_at);
				INSERT OR IGNORE INTO consent_schema_versions (version)
					VALUES (1);
			`);
		});
	}

	async getConsent(subjectKey: string, now = Date.now()): Promise<ConsentRecord | null> {
		const record = this.readConsent(subjectKey);
		if (!record) return null;
		if (record.expiresAt == null || record.expiresAt > now) return record;

		this.ctx.storage.sql.exec(
			'DELETE FROM consent_records WHERE subject_key = ?',
			subjectKey,
		);

		return null;
	}

	async saveConsent(
		subjectKey: string,
		choice: ConsentChoice,
		now = Date.now(),
	): Promise<ConsentRecord> {
		const existing = this.readConsent(subjectKey);
		if (existing && existing.expiresAt !== null && existing.expiresAt <= now) {
			this.ctx.storage.sql.exec(
				'DELETE FROM consent_records WHERE subject_key = ?',
				subjectKey,
			);
		} else if (existing && choicesMatch(existing, choice)) {
			return existing;
		}

		const expiresAt = getExpiry(choice, now);
		const row = this.ctx.storage.sql.exec<ConsentRow>(
			`INSERT INTO consent_records (
				subject_key,
				revision,
				preferences,
				statistics,
				marketing,
				response_type,
				gpc_applied,
				policy_version,
				source_domain,
				updated_at,
				expires_at
			) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(subject_key) DO UPDATE SET
				revision = consent_records.revision + 1,
				preferences = excluded.preferences,
				statistics = excluded.statistics,
				marketing = excluded.marketing,
				response_type = excluded.response_type,
				gpc_applied = excluded.gpc_applied,
				policy_version = excluded.policy_version,
				source_domain = excluded.source_domain,
				updated_at = excluded.updated_at,
				expires_at = excluded.expires_at
			RETURNING *`,
			subjectKey,
			choice.preferences ? 1 : 0,
			choice.statistics ? 1 : 0,
			choice.marketing ? 1 : 0,
			choice.responseType,
			choice.gpcApplied ? 1 : 0,
			choice.policyVersion,
			choice.sourceDomain,
			now,
			expiresAt,
		).one();

		return toRecord(row);
	}

	private readConsent(subjectKey: string): ConsentRecord | null {
		const rows = this.ctx.storage.sql.exec<ConsentRow>(
			'SELECT * FROM consent_records WHERE subject_key = ?',
			subjectKey,
		).toArray();
		const row = rows[0];

		return row ? toRecord(row) : null;
	}
}
