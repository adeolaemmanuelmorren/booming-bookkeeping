/**
 * Segment HTTP API event types.
 */

export interface SegmentEvent {
	type: "track" | "identify";
	event?: string;
	userId?: string | null;
	anonymousId?: string;
	properties?: Record<string, unknown>;
	traits?: Record<string, unknown>;
	context?: Record<string, unknown>;
	integrations?: Record<string, unknown>;
	originalTimestamp?: string;
	timestamp?: string;
	messageId?: string;
	channel?: string;
}

export interface SegmentTrackEvent extends SegmentEvent {
	type: "track";
	event: string;
	properties: Record<string, unknown>;
}

export interface SegmentIdentifyEvent extends SegmentEvent {
	type: "identify";
	traits: Record<string, unknown>;
}

/**
 * Standard library info for Segment context.
 */
export const LIBRARY_INFO = {
	name: "marketing-webhook-processor",
	version: "2.0.0",
} as const;

/**
 * Default Segment integrations.
 */
export const DEFAULT_INTEGRATIONS = {} as const;
