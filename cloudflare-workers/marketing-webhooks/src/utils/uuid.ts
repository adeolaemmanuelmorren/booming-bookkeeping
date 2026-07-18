/**
 * UUID generation utilities
 */

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

/**
 * Generate a stable event ID from a base ID and event name
 * Format: evt_{baseId}_{sanitizedEventName}
 */
export function generateEventId(baseId: string | undefined, eventName: string): string | null {
	if (!baseId) return null;
	const safeEventName = String(eventName || "")
		.replace(/[^A-Za-z0-9]+/g, "")
		.toLowerCase();
	return `evt_${baseId}_${safeEventName}`;
}
