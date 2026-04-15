/**
 * Auth types for the pluggable AuthProvider pattern.
 * Inlines the types from pika-shared since bus-ui does not depend on that package.
 */

import type { RequestEvent } from '@sveltejs/kit';

// ---------------------------------------------------------------------------
// Shared primitive types
// ---------------------------------------------------------------------------

export type RecordOrUndef = Record<string, unknown> | undefined;

export interface UserCognitoIdentity {
    cognitoIdentityId: string;
    cognitoAccessToken: string;
}

export interface UserAwsCredentials {
    accessKeyId: string;
    secretKey: string;
    sessionToken: string;
    expiration: string;
}

// ---------------------------------------------------------------------------
// AuthenticatedUser / AuthenticateResult
// ---------------------------------------------------------------------------

/**
 * Represents an authenticated user stored in the encrypted `bu` cookie.
 *
 * T — auth data (tokens, identity IDs). Not persisted to DB, not sent to client.
 * U — custom data (accountId, etc.). Available server-side and to agent tools.
 *
 * Default for both generics is `Record<string, unknown> | undefined` so that
 * the non-generic usage (`AuthenticatedUser`) allows any auth/custom data shape.
 */
export interface AuthenticatedUser<T extends RecordOrUndef = RecordOrUndef, U extends RecordOrUndef = RecordOrUndef> {
    userId: string;
    firstName?: string;
    lastName?: string;
    /** 'internal-user' = DSCO employee; 'external-user' = customer */
    userType?: 'internal-user' | 'external-user';
    authData?: T;
    customData?: U;
    roles?: string[];
    features?: Record<string, unknown>;
    overrideData?: Record<string, U>;
}

export interface AuthenticateResult<T extends RecordOrUndef = RecordOrUndef, U extends RecordOrUndef = RecordOrUndef> {
    authenticatedUser?: AuthenticatedUser<T, U>;
    redirectTo?: Response;
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class NotAuthenticatedError extends Error {
    constructor(message = 'User not authenticated') {
        super(message);
        this.name = 'NotAuthenticatedError';
    }
}

export class ForceUserToReauthenticateError extends Error {
    allowRetry?: boolean;
    constructor(message = 'User must re-authenticate', opts?: { allowRetry?: boolean }) {
        super(message);
        this.name = 'ForceUserToReauthenticateError';
        this.allowRetry = opts?.allowRetry;
    }
}

// ---------------------------------------------------------------------------
// AuthProvider abstract base class
// ---------------------------------------------------------------------------

export abstract class AuthProvider<T extends RecordOrUndef = RecordOrUndef, U extends RecordOrUndef = RecordOrUndef> {
    constructor(protected readonly stage: string) {}

    /**
     * Authenticate from request — called when no session cookie exists.
     * Returns:
     *   - { authenticatedUser } — authenticated; framework serializes to cookie
     *   - { redirectTo: Response } — OAuth redirect / client-auth flow
     *   - Throws NotAuthenticatedError — not authenticated, redirect to /signin
     */
    abstract authenticate(event: RequestEvent): Promise<AuthenticateResult<T, U>>;

    /**
     * Validate/refresh the existing session on every request.
     * Returns:
     *   - undefined — session still valid, no cookie update needed
     *   - AuthenticatedUser — updated user; framework re-serializes cookie
     *   - Throws ForceUserToReauthenticateError — session invalid, clear cookies + redirect
     */
    validateUser?(_event: RequestEvent, _user: AuthenticatedUser<T, U>): Promise<AuthenticatedUser<T, U> | undefined>;

    /**
     * Optionally inject extra data into event.locals for specific routes
     * (e.g. pass DSCO token endpoint URLs to the client-auth page).
     */
    addValueToLocalsForRoute?(
        pathName: string,
        event: RequestEvent,
        user: AuthenticatedUser<T, U> | undefined
    ): Promise<Record<string, unknown> | undefined>;

    /**
     * Get Cognito identity credentials for AWS SDK calls.
     * Return undefined if not applicable (e.g. local dev mock).
     */
    getUserCognitoIdentity?(_user: AuthenticatedUser<T, U>): Promise<UserCognitoIdentity | undefined>;

    /**
     * Get full AWS credentials for use with AWS SDK.
     * Used by getSession() and /api/aws-creds.
     */
    getAwsCredentials?(
        _user: AuthenticatedUser<T, U>
    ): Promise<{ accessKeyId: string; secretAccessKey: string; sessionToken: string; expiration: Date } | undefined>;

    /**
     * Handle logout. Return redirect path or undefined for default /signin.
     */
    logout?(_event: RequestEvent, _user: AuthenticatedUser<T, U>): Promise<string | undefined>;
}

// Keep BusUser as an alias so existing imports don't break during the transition.
// New code should use AuthenticatedUser<DscoAuthData, ...> directly.
export type BusUser = AuthenticatedUser<Record<string, string | undefined>, Record<string, string | undefined>>;
