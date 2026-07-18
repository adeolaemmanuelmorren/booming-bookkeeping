/**
 * Queue message types for the Marketing Webhook Processor
 */

/**
 * Message structure for the webhook queue
 */
export interface QueueMessage {
	/** Source identifier (e.g., 'shopify', 'klaviyo') */
	source: string;

	/** Topic/event type (e.g., 'checkouts/create', 'orders/paid') */
	topic: string;

	/** Raw webhook payload */
	payload: unknown;

	/** Message metadata */
	metadata: QueueMessageMetadata;
}

export interface QueueMessageMetadata {
	/** ISO timestamp when message was received */
	receivedAt: string;

	/** Unique message identifier */
	messageId: string;

	/** Original request headers */
	headers: Record<string, string>;

	/** Request context captured at the Cloudflare edge */
	requestContext?: Record<string, unknown>;
}

/**
 * Result of processing a queue message
 */
export interface ProcessingResult {
	success: boolean;
	error?: string;
	shouldRetry?: boolean;
	retryDelaySeconds?: number;
	eventsCount?: number;
}

/**
 * DLQ entry stored in KV
 */
export interface DLQEntry {
	message: QueueMessage;
	failedAt: string;
	attempts: number;
	queueName?: string;
	lastError?: string;
}
