/**
 * Cookie serialization / deserialization for the `bu` (BusUser / AuthenticatedUser) cookie.
 *
 * Encryption: AES-256-GCM with a random IV per write.
 * Key: SHA-256 of AUTH_SECRET (no KMS / SSM — upgradeable later).
 * Version prefix: "v1:" so future key-rotation schemes can detect old cookies.
 */

import type { RequestEvent } from '@sveltejs/kit';
import type { AuthenticatedUser } from './auth/types.js';
import { env } from '$env/dynamic/private';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTH_COOKIE_NAME = 'bu';
const DAS_COOKIE_NAME = 'das';
const DID_COOKIE_NAME = 'did';
const VERSION_PREFIX = 'v1:';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    maxAge: 4 * 60 * 60, // 4 hours
    path: '/',
};

// ---------------------------------------------------------------------------
// Key derivation
// ---------------------------------------------------------------------------

function getSecret(): string {
    const secret =
        env.AUTH_SECRET ||
        process.env.AUTH_SECRET ||
        env.COOKIE_SECRET ||
        process.env.COOKIE_SECRET ||
        'supersecret1234567890123456789012';
    if (!secret || secret.length < 16) {
        throw new Error('AUTH_SECRET (min 16 chars) required for cookie encryption');
    }
    return secret;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const hash = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
    return crypto.subtle.importKey(
        'raw',
        hash.slice(0, KEY_LENGTH),
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

// ---------------------------------------------------------------------------
// Base64-URL helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encrypt an AuthenticatedUser and set the `bu` httpOnly cookie.
 */
export async function serializeUserToCookies(
    event: RequestEvent,
    user: AuthenticatedUser
): Promise<void> {
    const key = await deriveKey(getSecret());
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
    const value = VERSION_PREFIX + base64UrlEncode(combined);
    event.cookies.set(AUTH_COOKIE_NAME, value, COOKIE_OPTIONS);
}

/**
 * Read and decrypt the `bu` cookie. Returns undefined if missing or invalid.
 */
export async function deserializeUserFromCookies(
    event: RequestEvent
): Promise<AuthenticatedUser | undefined> {
    const raw = event.cookies.get(AUTH_COOKIE_NAME);
    if (!raw) return undefined;

    // Strip version prefix if present
    const value = raw.startsWith(VERSION_PREFIX) ? raw.slice(VERSION_PREFIX.length) : raw;

    try {
        const key = await deriveKey(getSecret());
        const combined = base64UrlDecode(value);
        if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) return undefined;
        const iv = combined.slice(0, IV_LENGTH);
        const cipher = combined.slice(IV_LENGTH);
        const plain = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv, tagLength: AUTH_TAG_LENGTH * 8 },
            key,
            cipher
        );
        return JSON.parse(new TextDecoder().decode(plain)) as AuthenticatedUser;
    } catch {
        return undefined;
    }
}

/**
 * Clear all auth-related cookies (bu, das, did).
 */
export function clearAllAuthCookies(event: RequestEvent): void {
    for (const name of [AUTH_COOKIE_NAME, DAS_COOKIE_NAME, DID_COOKIE_NAME]) {
        event.cookies.delete(name, { path: '/' });
    }
}

// ---------------------------------------------------------------------------
// Legacy compat shims — kept so existing imports in hooks/oauth-provider don't break
// ---------------------------------------------------------------------------

/** @deprecated Use serializeUserToCookies */
export async function setBusUserCookie(
    user: AuthenticatedUser,
    options: { cookies: Pick<RequestEvent['cookies'], 'set'> }
): Promise<void> {
    const key = await deriveKey(getSecret());
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
    const value = VERSION_PREFIX + base64UrlEncode(combined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options.cookies.set(AUTH_COOKIE_NAME, value, COOKIE_OPTIONS as any);
}

/** @deprecated Use deserializeUserFromCookies */
export async function getBusUserFromCookie(
    options: { cookies: Pick<RequestEvent['cookies'], 'get'> }
): Promise<AuthenticatedUser | null> {
    const raw = options.cookies.get(AUTH_COOKIE_NAME);
    if (!raw) return null;
    const value = raw.startsWith(VERSION_PREFIX) ? raw.slice(VERSION_PREFIX.length) : raw;
    try {
        const key = await deriveKey(getSecret());
        const combined = base64UrlDecode(value);
        if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) return null;
        const iv = combined.slice(0, IV_LENGTH);
        const cipher = combined.slice(IV_LENGTH);
        const plain = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv, tagLength: AUTH_TAG_LENGTH * 8 },
            key,
            cipher
        );
        return JSON.parse(new TextDecoder().decode(plain)) as AuthenticatedUser;
    } catch {
        return null;
    }
}

/** @deprecated Use clearAllAuthCookies */
export function clearBusUserCookie(options: {
    cookies: Pick<RequestEvent['cookies'], 'set'>;
}): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options.cookies.set(AUTH_COOKIE_NAME, '', { ...COOKIE_OPTIONS, maxAge: 0 } as any);
}

export { AUTH_COOKIE_NAME as COOKIE_NAME, COOKIE_OPTIONS };
