/**
 * Main queue processor
 *
 * Processes webhook messages from the queue:
 * 1. Route to appropriate source handler
 * 2. Enrich with source API data
 * 3. Transform to Segment events
 * 4. Send to Segment
 */

import { env } from "cloudflare:workers";
import type { MarketingWebhookEnv, QueueMessage, ProcessingResult } from "../types";
import { getSource } from "../sources/registry";
import { createSegmentClient } from "../clients";
import { firstOf, generateEventId, toUnderscoreCaseKeys } from "../utils";

/**
 * Get the shared Segment write key.
 */
function getSegmentWriteKey(): string | null {
	const envRecord = env as unknown as MarketingWebhookEnv;
	return envRecord.SEGMENT_WRITE_KEY ?? null;
}

function getShopifyEventId(headers: Record<string, string>): string | null {
	return firstOf(
		headers["x-shopify-event-id"],
		headers["X-Shopify-Event-Id"],
		headers["X-SHOPIFY-EVENT-ID"]
	);
}

function getSourcePlatform(source: string): string {
	const platformNames: Record<string, string> = {
		activecampaign: "ActiveCampaign",
		shopify: "Shopify",
		webflow: "Webflow",
	};

	return platformNames[source] ?? source;
}

function buildMarketingSourceContext(message: QueueMessage): Record<string, unknown> {
	return {
		source: message.source,
		sourcePlatform: getSourcePlatform(message.source),
		topic: message.topic,
		messageId: message.metadata.messageId,
		receivedAt: message.metadata.receivedAt,
	};
}

function buildRootContext(
	eventContext: Record<string, unknown> | undefined,
	message: QueueMessage
): Record<string, unknown> {
	return {
		...message.metadata.requestContext,
		...eventContext,
		marketingSource: buildMarketingSourceContext(message),
	};
}

/**
 * Process a single queue message
 */
export async function processMessage(
	message: QueueMessage
): Promise<ProcessingResult> {
	const { source, topic, payload, metadata } = message;

	console.log(`[Processor] Processing ${source}/${topic} - ${metadata.messageId}`);

	// 1. Get the source handler
	const sourceHandler = getSource(source);
	if (!sourceHandler) {
		console.error(`[Processor] Unknown source: ${source}`);
		return {
			success: false,
			error: `Unknown source: ${source}`,
			shouldRetry: false, // Don't retry unknown sources
		};
	}

	// 2. Get the topic handler
	const topicHandler = sourceHandler.handlers.get(topic);
	if (!topicHandler) {
		console.error(`[Processor] Unknown topic ${topic} for source ${source}`);
		return {
			success: false,
			error: `Unknown topic: ${topic}`,
			shouldRetry: false, // Don't retry unknown topics
		};
	}

	// 3. Validate the payload
	const validation = topicHandler.validate(payload);
	if (!validation.valid) {
		console.error(`[Processor] Validation failed: ${validation.error}`);
		return {
			success: false,
			error: `Validation failed: ${validation.error}`,
			shouldRetry: false, // Don't retry invalid payloads
		};
	}

	// 4. Enrich the payload (if enricher exists)
	let enrichment;
	if (sourceHandler.enricher) {
		try {
			enrichment = await sourceHandler.enricher.enrich(validation.data);
			console.log(`[Processor] Enrichment complete`, {
				failed: enrichment.failed,
			});
		} catch (error) {
			// Enrichment failure is not fatal - continue without enrichment
			console.error(`[Processor] Enrichment error (non-fatal):`, error);
		}
	}

	// 5. Transform to Segment events
	let events;
	try {
		events = topicHandler.transform(validation.data, enrichment);
		const shopifyEventId = source === "shopify" ? getShopifyEventId(metadata.headers) : null;
		events = events.map((event) => {
			const { integrations, ...rest } = event;
			const idempotentMessageId = shopifyEventId
				? generateEventId(shopifyEventId, event.event ?? event.type)
				: null;
			return {
				...rest,
				messageId: idempotentMessageId ?? rest.messageId,
				context: buildRootContext(rest.context, message),
				properties: event.properties ? toUnderscoreCaseKeys(event.properties) : undefined,
				traits: event.traits ? toUnderscoreCaseKeys(event.traits) : undefined,
			};
		});
		console.log(`[Processor] Transformed to ${events.length} events`);
	} catch (error) {
		console.error(`[Processor] Transform error:`, error);
		return {
			success: false,
			error: `Transform failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			shouldRetry: false, // Don't retry transform failures
		};
	}

	// 6. Send to Segment
	if (events.length === 0) {
		console.log(`[Processor] No events to send`);
		return { success: true };
	}

	try {
		const writeKey = getSegmentWriteKey();
		if (!writeKey) {
			throw new Error("Missing Segment write key");
		}
		const client = createSegmentClient({
			apiUrl: env.SEGMENT_API_URL,
			writeKey,
		});
		console.log(`[Processor] Using shared Segment write key`);

		// Use batch endpoint for efficiency
		const result = await client.sendBatch(events);

		if (!result.success) {
			console.error(`[Processor] Segment send failed:`, result.error);
			return {
				success: false,
				error: result.error,
				shouldRetry: true,
				retryDelaySeconds: 10,
			};
		}

		console.log(`[Processor] Successfully sent ${events.length} events to Segment`);
		return { success: true };
	} catch (error) {
		console.error(`[Processor] Segment error:`, error);
		return {
			success: false,
			error: `Segment error: ${error instanceof Error ? error.message : "Unknown error"}`,
			shouldRetry: true,
			retryDelaySeconds: 10,
		};
	}
}

/**
 * Process a batch of queue messages
 */
export async function processBatch(
	batch: MessageBatch<QueueMessage>
): Promise<void> {
	console.log(`[Processor] Processing batch of ${batch.messages.length} messages`);

	for (const msg of batch.messages) {
		const result = await processMessage(msg.body);

		if (result.success) {
			msg.ack();
		} else if (result.shouldRetry) {
			msg.retry({
				delaySeconds: result.retryDelaySeconds ?? 5,
			});
		} else {
			// Non-retriable failure - send directly to DLQ, then ack original
			console.log(`[Processor] Message ${msg.body.metadata.messageId} failed permanently: ${result.error}`);
			try {
				await env.DLQ_QUEUE.send({
					...msg.body,
					metadata: {
						...msg.body.metadata,
						failureReason: result.error,
						failedAt: new Date().toISOString(),
					},
				});
				console.log(`[Processor] Sent to DLQ: ${msg.body.metadata.messageId}`);
			} catch (dlqError) {
				console.error(`[Processor] Failed to send to DLQ:`, dlqError);
				// Retry so we don't lose the message
				msg.retry({ delaySeconds: 30 });
				continue;
			}
			msg.ack();
		}
	}
}
