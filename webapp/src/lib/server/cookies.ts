/**
 * Encrypt/decrypt BusUser to a single httpOnly cookie "bu" (ES-2951).
 * AES-256-GCM with a random IV per cookie write; IV prepended to ciphertext.
 * Uses COOKIE_SECRET or AUTH_SECRET from env at runtime (not inlined at build).
 */

import type { BusUser } from './auth/types.js';
import { env } from '$env/dynamic/private';

const COOKIE_NAME = 'bu';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // AES-256

const COOKIE_OPTIONS = {
	httpOnly: true,
	secure: true,
	sameSite: 'lax' as const,
	maxAge: 4 * 60 * 60, // 4 hours
	path: '/',
};

function getSecret(): string {
	const secret = env.COOKIE_SECRET || env.AUTH_SECRET || process.env.COOKIE_SECRET || process.env.AUTH_SECRET || 'supersecret1234567890123456789012';
	if (!secret || secret.length < 16) {
		throw new Error('COOKIE_SECRET or AUTH_SECRET (min 16 chars) required for cookie encryption');
	}
	return secret;
}

/** Derive a fixed-length key from the secret using SHA-256. */
async function deriveKey(secret: string): Promise<CryptoKey> {
	const encoder = new TextEncoder();
	const data = encoder.encode(secret);
	const hash = await crypto.subtle.digest('SHA-256', data);
	const key = await crypto.subtle.importKey(
		'raw',
		hash.slice(0, KEY_LENGTH),
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
	return key;
}

function base64UrlEncode(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
	str = str.replace(/-/g, '+').replace(/_/g, '/');
	const pad = str.length % 4;
	if (pad) str += '='.repeat(4 - pad);
	const binary = atob(str);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

/**
 * Serialize and encrypt BusUser, then set the "bu" cookie on the response.
 * Call this from hooks or auth callback after successful auth.
 */
export async function setBusUserCookie(
	user: BusUser,
	options: { cookies: { set: (name: string, value: string, opts: Record<string, unknown>) => void } }
): Promise<void> {
	const secret = getSecret();
	const key = await deriveKey(secret);
	const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
	const plain = new TextEncoder().encode(JSON.stringify(user));
	const cipher = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv, tagLength: AUTH_TAG_LENGTH * 8 },
		key,
		plain
	);
	const combined = new Uint8Array(iv.length + cipher.byteLength);
	combined.set(iv);
	combined.set(new Uint8Array(cipher), iv.length);
	const value = base64UrlEncode(combined);
	options.cookies.set(COOKIE_NAME, value, COOKIE_OPTIONS);
}

/**
 * Read and decrypt the "bu" cookie, returning BusUser or null if missing/invalid.
 */
export async function getBusUserFromCookie(
	options: { cookies: { get: (name: string) => string | undefined } }
): Promise<BusUser | null> {
	const value = options.cookies.get(COOKIE_NAME);
	if (!value) return null;
	try {
		const secret = getSecret();
		const key = await deriveKey(secret);
		const combined = base64UrlDecode(value);
		if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) return null;
		const iv = combined.slice(0, IV_LENGTH);
		const cipher = combined.slice(IV_LENGTH);
		const plain = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv, tagLength: AUTH_TAG_LENGTH * 8 },
			key,
			cipher
		);
		const json = new TextDecoder().decode(plain);
		return JSON.parse(json) as BusUser;
	} catch {
		return null;
	}
}

/**
 * Clear the "bu" cookie (e.g. on logout or invalid session).
 */
export function clearBusUserCookie(options: {
	cookies: { set: (name: string, value: string, opts: Record<string, unknown>) => void };
}): void {
	options.cookies.set(COOKIE_NAME, '', {
		...COOKIE_OPTIONS,
		maxAge: 0,
	});
}

export { COOKIE_NAME, COOKIE_OPTIONS };
