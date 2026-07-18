/**
 * Dead Letter Queue handler
 *
 * Persists failed messages to KV namespace for later inspection and replay.
 */

import { env } from "cloudflare:workers";
import type { QueueMessage, DLQEntry } from "../types";

/**
 * Handle a batch of DLQ messages
 * Writes each failed message to KV for persistence
 */
export async function handleDLQ(
	batch: MessageBatch<QueueMessage>
): Promise<void> {
	console.log(`[DLQ Handler] Processing ${batch.messages.length} failed messages`);

	for (const msg of batch.messages) {
		const { source, topic, metadata } = msg.body;

		// Generate KV key: dlq:{source}:{topic}:{date}:{messageId}
		const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
		const safeTopic = topic.replace(/\//g, "-"); // checkouts/create → checkouts-create
		const key = `dlq:${source}:${safeTopic}:${date}:${metadata.messageId}`;

		// Build DLQ entry with metadata
		const dlqEntry: DLQEntry = {
			message: msg.body,
			failedAt: new Date().toISOString(),
			attempts: msg.attempts,
			queueName: batch.queue,
		};

		try {
			await env.DLQ_KV.put(key, JSON.stringify(dlqEntry), {
				// KV entries expire after 30 days by default for cleanup
				expirationTtl: 60 * 60 * 24 * 30,
				metadata: {
					source,
					topic,
					messageId: metadata.messageId,
					receivedAt: metadata.receivedAt,
					attempts: msg.attempts,
				},
			});

			console.log(`[DLQ Handler] Persisted to KV: ${key}`);
			msg.ack();
		} catch (error) {
			console.error(`[DLQ Handler] Failed to persist message ${metadata.messageId}:`, error);
			// Retry - we don't want to lose messages
			msg.retry({ delaySeconds: 30 });
		}
	}
}

/**
 * List failed messages from KV (for admin/debugging)
 */
export async function listFailedMessages(
	options: {
		source?: string;
		topic?: string;
		date?: string;
		limit?: number;
		cursor?: string;
	} = {}
): Promise<{
	keys: Array<{ name: string; metadata: Record<string, unknown> }>;
	cursor?: string;
	complete: boolean;
}> {
	const { source, topic, date, limit = 100, cursor } = options;

	// Build prefix based on filters
	let prefix = "dlq:";
	if (source) {
		prefix += `${source}:`;
		if (topic) {
			const safeTopic = topic.replace(/\//g, "-");
			prefix += `${safeTopic}:`;
			if (date) {
				prefix += `${date}:`;
			}
		}
	}

	const listed = await env.DLQ_KV.list({
		prefix,
		limit,
		cursor,
	});

	return {
		keys: listed.keys.map((key) => ({
			name: key.name,
			metadata: (key.metadata || {}) as Record<string, unknown>,
		})),
		cursor: listed.list_complete ? undefined : listed.cursor,
		complete: listed.list_complete,
	};
}

/**
 * Get a specific failed message from KV
 */
export async function getFailedMessage(
	key: string
): Promise<DLQEntry | null> {
	const value = await env.DLQ_KV.get(key);
	if (!value) return null;

	return JSON.parse(value) as DLQEntry;
}

/**
 * Replay a failed message by re-queuing it
 */
export async function replayFailedMessage(
	key: string
): Promise<{ success: boolean; error?: string }> {
	const entry = await getFailedMessage(key);
	if (!entry) {
		return { success: false, error: "Message not found" };
	}

	try {
		// Re-queue the original message
		await env.WEBHOOK_QUEUE.send(entry.message);

		// Optionally delete from DLQ after replay
		// await env.DLQ_KV.delete(key);

		console.log(`[DLQ Handler] Replayed message: ${key}`);
		return { success: true };
	} catch (error) {
		return {
			success: false,
			error: `Failed to replay: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Delete a failed message from KV
 */
export async function deleteFailedMessage(key: string): Promise<void> {
	await env.DLQ_KV.delete(key);
	console.log(`[DLQ Handler] Deleted message: ${key}`);
}
