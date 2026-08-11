const HMAC_ALGORITHM = {
	name: 'HMAC',
	hash: 'SHA-256',
} as const;

async function importHmacKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		HMAC_ALGORITHM,
		false,
		['sign'],
	);
}

async function hmac(secret: string, value: string): Promise<Uint8Array> {
	const key = await importHmacKey(secret);
	const signature = await crypto.subtle.sign(
		HMAC_ALGORITHM.name,
		key,
		new TextEncoder().encode(value),
	);

	return new Uint8Array(signature);
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

function bytesToBase64Url(bytes: Uint8Array): string {
	let binary = '';

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary)
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replace(/=+$/u, '');
}

function base64UrlToBytes(value: string): Uint8Array | null {
	const padding = '='.repeat((4 - (value.length % 4)) % 4);
	const base64 = value.replaceAll('-', '+').replaceAll('_', '/') + padding;

	try {
		const binary = atob(base64);
		return Uint8Array.from(binary, (character) => character.charCodeAt(0));
	} catch {
		return null;
	}
}

function signaturesMatch(left: Uint8Array, right: Uint8Array): boolean {
	if (left.length !== right.length) return false;

	let difference = 0;
	for (let index = 0; index < left.length; index += 1) {
		difference |= left[index] ^ right[index];
	}

	return difference === 0;
}

export async function deriveSubjectKey(secret: string, anonymousId: string): Promise<string> {
	const digest = await hmac(secret, `subject:v1:${anonymousId}`);
	return bytesToHex(digest);
}

export async function signValue(secret: string, encodedPayload: string): Promise<string> {
	const signature = await hmac(secret, `cookie:v1:${encodedPayload}`);
	return bytesToBase64Url(signature);
}

export async function verifyValue(
	secret: string,
	encodedPayload: string,
	encodedSignature: string,
): Promise<boolean> {
	const suppliedSignature = base64UrlToBytes(encodedSignature);
	if (!suppliedSignature) return false;

	const expectedSignature = await hmac(secret, `cookie:v1:${encodedPayload}`);
	return signaturesMatch(expectedSignature, suppliedSignature);
}

export function encodePayload(value: unknown): string {
	const bytes = new TextEncoder().encode(JSON.stringify(value));
	return bytesToBase64Url(bytes);
}

export function decodePayload(value: string): unknown {
	const bytes = base64UrlToBytes(value);
	if (!bytes) return null;

	try {
		return JSON.parse(new TextDecoder().decode(bytes));
	} catch {
		return null;
	}
}
