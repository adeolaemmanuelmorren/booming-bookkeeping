import { DurableObject } from 'cloudflare:workers';
import type {
	ConfirmedPurchase,
	PurchaseAttemptInput,
	PurchaseEnv,
	PurchasePollResult,
	StripeAccount,
} from './types';
import { findConfirmedPurchases } from './confirmed-purchases';

const ATTEMPT_TTL_MS = 2 * 60 * 60 * 1000;
const MIN_STRIPE_CHECK_INTERVAL_MS = 2500;
const STRIPE_CHECK_LEASE_MS = 15_000;

type PendingAttemptRow = {
	email: string;
	payment_method_id: string;
	stripe_account: StripeAccount;
	submitted_at: number;
};

export class PurchaseState extends DurableObject<PurchaseEnv> {
	constructor(ctx: DurableObjectState, env: PurchaseEnv) {
		super(ctx, env);

		ctx.blockConcurrencyWhile(async () => {
			this.ctx.storage.sql.exec(`
				CREATE TABLE IF NOT EXISTS pending_attempts (
					attempt_id TEXT PRIMARY KEY,
					email TEXT NOT NULL,
					payment_method_id TEXT NOT NULL,
					stripe_account TEXT NOT NULL,
					submitted_at INTEGER NOT NULL,
					expires_at INTEGER NOT NULL
				);
				CREATE INDEX IF NOT EXISTS pending_attempts_account_expiry
					ON pending_attempts (stripe_account, expires_at);

				CREATE TABLE IF NOT EXISTS delivered_charges (
					charge_id TEXT PRIMARY KEY,
					delivered_at INTEGER NOT NULL
				);

				CREATE TABLE IF NOT EXISTS poll_control (
					stripe_account TEXT PRIMARY KEY,
					next_stripe_check_at INTEGER NOT NULL
				);
			`);
		});
	}

	async registerAttempt(attempt: PurchaseAttemptInput): Promise<void> {
		const expiresAt = attempt.submittedAt + ATTEMPT_TTL_MS;
		const attemptId = await this.getAttemptId(attempt);

		this.ctx.storage.sql.exec(
			`INSERT OR IGNORE INTO pending_attempts (
				attempt_id,
				email,
				payment_method_id,
				stripe_account,
				submitted_at,
				expires_at
			) VALUES (?, ?, ?, ?, ?, ?)`,
			attemptId,
			attempt.email,
			attempt.paymentMethodId,
			attempt.stripeAccount,
			attempt.submittedAt,
			expiresAt,
		);

		const currentAlarm = await this.ctx.storage.getAlarm();
		if (currentAlarm == null || currentAlarm > expiresAt) {
			await this.ctx.storage.setAlarm(expiresAt);
		}
	}

	async poll(account: StripeAccount, now = Date.now()): Promise<PurchasePollResult> {
		this.deleteExpiredAttempts(now);

		const attempts = this.getPendingAttempts(account, now);
		if (attempts.length === 0) {
			return {
				charges: [],
				hasPendingAttempts: false,
				retryAfterMs: 0,
			};
		}

		const retryAfterMs = this.reserveStripeCheck(account, now);
		if (retryAfterMs > 0) {
			return {
				charges: [],
				hasPendingAttempts: true,
				retryAfterMs,
			};
		}

		let matches: ConfirmedPurchase[];

		try {
			const deliveredChargeIds = this.getDeliveredChargeIds();
			matches = await findConfirmedPurchases(
				this.env,
				account,
				attempts,
				now,
				deliveredChargeIds,
			);
		} finally {
			this.setNextStripeCheckAt(account, Date.now() + MIN_STRIPE_CHECK_INTERVAL_MS);
		}

		const newlyDelivered = this.recordNewCharges(matches, Date.now());

		return {
			charges: newlyDelivered,
			hasPendingAttempts: true,
			retryAfterMs: MIN_STRIPE_CHECK_INTERVAL_MS,
		};
	}

	async alarm(): Promise<void> {
		const now = Date.now();
		this.deleteExpiredAttempts(now);
		this.ctx.storage.sql.exec(
			'DELETE FROM delivered_charges WHERE delivered_at <= ?',
			now - ATTEMPT_TTL_MS,
		);

		const pendingExpiry = [...this.ctx.storage.sql
			.exec<{ expires_at: number }>('SELECT MIN(expires_at) AS expires_at FROM pending_attempts')]
			[0]?.expires_at ?? 0;
		const deliveredExpiry = [...this.ctx.storage.sql
			.exec<{ expires_at: number }>(
				'SELECT MIN(delivered_at) + ? AS expires_at FROM delivered_charges',
				ATTEMPT_TTL_MS,
			)]
			[0]?.expires_at ?? 0;
		const nextExpiry = [pendingExpiry, deliveredExpiry]
			.filter((value) => value > now)
			.sort((left, right) => left - right)[0];

		if (nextExpiry) {
			await this.ctx.storage.setAlarm(nextExpiry);
			return;
		}

		this.ctx.storage.sql.exec('DELETE FROM poll_control');
	}

	private async getAttemptId(attempt: PurchaseAttemptInput): Promise<string> {
		const value = [
			attempt.email,
			attempt.paymentMethodId,
			attempt.stripeAccount,
			attempt.submittedAt,
		].join('|');
		const bytes = new TextEncoder().encode(value);
		const digest = await crypto.subtle.digest('SHA-256', bytes);

		return Array.from(new Uint8Array(digest))
			.map((byte) => byte.toString(16).padStart(2, '0'))
			.join('');
	}

	private deleteExpiredAttempts(now: number): void {
		this.ctx.storage.sql.exec(
			'DELETE FROM pending_attempts WHERE expires_at <= ?',
			now,
		);
	}

	private getPendingAttempts(account: StripeAccount, now: number): PurchaseAttemptInput[] {
		const rows = this.ctx.storage.sql.exec<PendingAttemptRow>(
			`SELECT email, payment_method_id, stripe_account, submitted_at
			 FROM pending_attempts
			 WHERE stripe_account = ?
			   AND expires_at > ?
			 ORDER BY submitted_at`,
			account,
			now,
		);

		return [...rows].map((row) => ({
			email: row.email,
			paymentMethodId: row.payment_method_id,
			stripeAccount: row.stripe_account,
			submittedAt: row.submitted_at,
		}));
	}

	private reserveStripeCheck(account: StripeAccount, now: number): number {
		const control = [...this.ctx.storage.sql.exec<{ next_stripe_check_at: number }>(
			'SELECT next_stripe_check_at FROM poll_control WHERE stripe_account = ?',
			account,
		)][0];

		if (control && control.next_stripe_check_at > now) {
			return control.next_stripe_check_at - now;
		}

		this.ctx.storage.sql.exec(
			`INSERT INTO poll_control (stripe_account, next_stripe_check_at)
			 VALUES (?, ?)
			 ON CONFLICT(stripe_account)
			 DO UPDATE SET next_stripe_check_at = excluded.next_stripe_check_at`,
			account,
			now + STRIPE_CHECK_LEASE_MS,
		);

		return 0;
	}

	private setNextStripeCheckAt(account: StripeAccount, nextStripeCheckAt: number): void {
		this.ctx.storage.sql.exec(
			`INSERT INTO poll_control (stripe_account, next_stripe_check_at)
			 VALUES (?, ?)
			 ON CONFLICT(stripe_account)
			 DO UPDATE SET next_stripe_check_at = excluded.next_stripe_check_at`,
			account,
			nextStripeCheckAt,
		);
	}

	private getDeliveredChargeIds(): Set<string> {
		const rows = this.ctx.storage.sql.exec<{ charge_id: string }>(
			'SELECT charge_id FROM delivered_charges',
		);

		return new Set([...rows].map((row) => row.charge_id));
	}

	private recordNewCharges(charges: ConfirmedPurchase[], now: number): ConfirmedPurchase[] {
		const newlyDelivered: ConfirmedPurchase[] = [];

		for (const charge of charges) {
			const result = this.ctx.storage.sql.exec(
				`INSERT OR IGNORE INTO delivered_charges (charge_id, delivered_at)
				 VALUES (?, ?)`,
				charge.chargeId,
				now,
			);

			if (result.rowsWritten > 0) {
				newlyDelivered.push(charge);
			}
		}

		return newlyDelivered;
	}
}
