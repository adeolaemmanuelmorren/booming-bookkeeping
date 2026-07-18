/**
 * Generic HTTP client with retry logic
 */

import { sleep } from "../utils";

export interface HttpClientConfig {
	maxRetries: number;
	baseDelayMs: number;
	headers?: Record<string, string>;
	allowNonJson?: boolean;
}

export interface HttpRequestResult<T> {
	data: T | null;
	error: string | null;
	status?: number;
}

const DEFAULT_CONFIG: HttpClientConfig = {
	maxRetries: 3,
	baseDelayMs: 500,
};

/**
 * Make an HTTP request with retry logic and exponential backoff
 */
export async function httpRequest<T>(
	url: string,
	options: RequestInit & { config?: Partial<HttpClientConfig> } = {}
): Promise<HttpRequestResult<T>> {
	const config = { ...DEFAULT_CONFIG, ...options.config };
	const { maxRetries, baseDelayMs, headers: configHeaders } = config;

	const requestHeaders = new Headers(options.headers);
	if (configHeaders) {
		Object.entries(configHeaders).forEach(([key, value]) => {
			requestHeaders.set(key, value);
		});
	}

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const response = await fetch(url, {
				...options,
				headers: requestHeaders,
			});

			// Handle rate limiting
			if (response.status === 429) {
				const retryAfter = parseInt(response.headers.get("Retry-After") || "2", 10);
				if (attempt < maxRetries) {
					await sleep(retryAfter * 1000);
					continue;
				}
				return {
					data: null,
					error: `Rate limited after ${maxRetries} attempts`,
					status: 429,
				};
			}

			// Handle server errors with retry
			if (response.status >= 500 && attempt < maxRetries) {
				await sleep(baseDelayMs * Math.pow(2, attempt - 1));
				continue;
			}

			// Non-success response
			if (!response.ok) {
				const errorText = await response.text().catch(() => "Unknown error");
				return {
					data: null,
					error: `HTTP ${response.status}: ${errorText}`,
					status: response.status,
				};
			}

	// Success - parse JSON (optionally allow non-JSON bodies)
	try {
		const data = (await response.json()) as T;
		return { data, error: null, status: response.status };
	} catch (err) {
		if (config.allowNonJson) {
			return { data: null, error: null, status: response.status };
		}
		throw err;
	}
		} catch (err) {
			if (attempt < maxRetries) {
				await sleep(baseDelayMs * Math.pow(2, attempt - 1));
				continue;
			}
			return {
				data: null,
				error: `Request failed: ${err instanceof Error ? err.message : "Unknown error"}`,
			};
		}
	}

	return { data: null, error: "Max retries exceeded" };
}

/**
 * Create a configured HTTP client for a specific API
 */
export function createHttpClient(baseUrl: string, config: Partial<HttpClientConfig> = {}) {
	return {
		async get<T>(endpoint: string, headers?: Record<string, string>): Promise<HttpRequestResult<T>> {
			return httpRequest<T>(`${baseUrl}${endpoint}`, {
				method: "GET",
				headers,
				config,
			});
		},

		async post<T>(
			endpoint: string,
			body: unknown,
			headers?: Record<string, string>
		): Promise<HttpRequestResult<T>> {
			return httpRequest<T>(`${baseUrl}${endpoint}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...headers,
				},
				body: JSON.stringify(body),
				config,
			});
		},
	};
}
