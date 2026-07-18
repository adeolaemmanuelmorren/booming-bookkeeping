/**
 * Segment HTTP Tracking API client
 */

import type { SegmentEvent } from "../types";
import { createHttpClient } from "./http";

export interface SegmentClientConfig {
	apiUrl: string;
	writeKey: string;
}

export interface SendResult {
	success: boolean;
	error?: string;
	failedEvents?: number;
}

/**
 * Create a Segment API client.
 */
export function createSegmentClient(config: SegmentClientConfig) {
	const { apiUrl, writeKey } = config;
	const baseUrl = apiUrl.replace(/\/+$/, "");

	// Segment Basic Auth is the write key as username with an empty password.
	const authHeader = `Basic ${btoa(writeKey + ":")}`;

	const client = createHttpClient(baseUrl, {
		maxRetries: 3,
		baseDelayMs: 500,
		allowNonJson: true,
		headers: {
			Authorization: authHeader,
			"Content-Type": "application/json",
		},
	});

	return {
		/**
		 * Send a single event to Segment.
		 */
		async sendEvent(event: SegmentEvent): Promise<{ success: boolean; error?: string }> {
			const endpoint = event.type === "identify" ? "/v1/identify" : "/v1/track";
			const result = await client.post<{ ok: boolean }>(endpoint, event);

			if (result.error) {
				return { success: false, error: result.error };
			}
			return { success: true };
		},

		/**
		 * Send multiple events to Segment.
		 */
		async sendEvents(events: SegmentEvent[]): Promise<SendResult> {
			const results = await Promise.all(events.map((event) => this.sendEvent(event)));

			const failures = results.filter((r) => !r.success);

			if (failures.length > 0) {
				return {
					success: false,
					error: failures.map((f) => f.error).join("; "),
					failedEvents: failures.length,
				};
			}

			return { success: true };
		},

		/**
		 * Send events as a batch.
		 */
		async sendBatch(events: SegmentEvent[]): Promise<SendResult> {
			if (events.length === 0) {
				return { success: true };
			}

			const batch = {
				batch: events,
				sentAt: new Date().toISOString(),
			};

			const result = await client.post<{ ok: boolean }>("/v1/batch", batch);

			if (result.error) {
				return { success: false, error: result.error };
			}

			return { success: true };
		},
	};
}

export type SegmentClient = ReturnType<typeof createSegmentClient>;
