/**
 * General helper utilities
 */

/**
 * Check if value is a non-empty string
 */
export function isNonEmptyString(val: unknown): val is string {
	return typeof val === "string" && val.length > 0;
}

/**
 * Check if value is a plain object
 */
export function isObject(val: unknown): val is Record<string, unknown> {
	return val !== null && typeof val === "object" && !Array.isArray(val);
}

/**
 * Safely parse a price value to number
 */
export function parsePrice(val: unknown): number {
	if (val === null || val === undefined) return 0;
	const parsed = parseFloat(String(val));
	return isNaN(parsed) ? 0 : parsed;
}

/**
 * Safely parse JSON string
 */
export function parseJsonSafe<T>(str: unknown): T | null {
	if (!isNonEmptyString(str)) return null;
	try {
		return JSON.parse(str) as T;
	} catch {
		return null;
	}
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get first non-empty string from a list of values
 */
export function firstOf(...values: (string | undefined | null)[]): string | null {
	return values.find((v) => isNonEmptyString(v)) || null;
}

/**
 * Safely convert headers to a plain object
 */
export function headersToObject(headers: Headers): Record<string, string> {
	const obj: Record<string, string> = {};
	headers.forEach((value, key) => {
		obj[key] = value;
	});
	return obj;
}

/**
 * Convert object keys to underscore_case (deep).
 */
export function toUnderscoreCaseKeys<T>(value: T): T {
	if (Array.isArray(value)) {
		return value.map((item) => toUnderscoreCaseKeys(item)) as T;
	}

	if (isObject(value)) {
		const result: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value)) {
			const underscoreKey = key
				.replace(/([a-z0-9])([A-Z])/g, "$1_$2")
				.replace(/[-\s]+/g, "_")
				.toLowerCase();
			result[underscoreKey] = toUnderscoreCaseKeys(val);
		}
		return result as T;
	}

	return value;
}
