import { DurableObject } from "cloudflare:workers";

interface StoredDebugEvent extends Record<string, SqlStorageValue> {
	id: number;
	endpoint: string;
	received_at: string;
	properties_json: string;
}

export interface ReverseEtlDebugEvent {
	id: number;
	endpoint: string;
	receivedAt: string;
	propertiesJson: string;
}

export class ReverseEtlDebugStore extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		ctx.blockConcurrencyWhile(async () => {
			this.ctx.storage.sql.exec(`
				CREATE TABLE IF NOT EXISTS debug_events (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					endpoint TEXT NOT NULL,
					received_at TEXT NOT NULL,
					properties_json TEXT NOT NULL
				);

				CREATE INDEX IF NOT EXISTS idx_debug_events_received_at
				ON debug_events(received_at);
			`);
		});
	}

	storeEvent(
		endpoint: string,
		receivedAt: string,
		propertiesJson: string
	): number {
		const row = this.ctx.storage.sql
			.exec<{ id: number }>(
				`
					INSERT INTO debug_events (
						endpoint,
						received_at,
						properties_json
					)
					VALUES (?, ?, ?)
					RETURNING id
				`,
				endpoint,
				receivedAt,
				propertiesJson
			)
			.one();

		return row.id;
	}

	listEvents(limit = 100, beforeId?: number): ReverseEtlDebugEvent[] {
		const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);

		if (beforeId) {
			const rows = this.ctx.storage.sql
				.exec<StoredDebugEvent>(
					`
						SELECT id, endpoint, received_at, properties_json
						FROM debug_events
						WHERE id < ?
						ORDER BY id DESC
						LIMIT ?
					`,
					beforeId,
					safeLimit
				)
				.toArray();

			return rows.map(toDebugEvent);
		}

		const rows = this.ctx.storage.sql
			.exec<StoredDebugEvent>(
				`
					SELECT id, endpoint, received_at, properties_json
					FROM debug_events
					ORDER BY id DESC
					LIMIT ?
				`,
				safeLimit
			)
			.toArray();

		return rows.map(toDebugEvent);
	}
}

function toDebugEvent(row: StoredDebugEvent): ReverseEtlDebugEvent {
	return {
		id: row.id,
		endpoint: row.endpoint,
		receivedAt: row.received_at,
		propertiesJson: row.properties_json,
	};
}
