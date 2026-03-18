/**
 * Auth types for the pluggable AuthProvider pattern (ES-2951).
 * No DynamoDB user table — identity comes from Cognito/OAuth tokens.
 */

import type { RequestEvent } from '@sveltejs/kit';

export interface BusUser {
	/** Stable user ID — sub from Cognito JWT, or provider-specific sub */
	userId: string;
	/** Display name (from id_token name claim or profile) */
	name?: string;
	email?: string;
	/** Avatar URL */
	picture?: string;
	/** Which OAuth provider authenticated this user */
	provider: string;
	/**
	 * Auth tokens — stored only in the encrypted server-side cookie.
	 * Never serialized to the client or sent in page data.
	 */
	authData: {
		accessToken: string;
		idToken?: string;
		refreshToken?: string;
		expiresAt: number; // unix seconds
		/** Provider-specific: login key for Cognito Identity Pool */
		identityPoolLoginKey?: string;
	};
	/** ISO timestamp of cookie creation for absolute timeout enforcement */
	sessionCreatedAt: string;
	/** ISO timestamp of last activity for idle timeout (optional) */
	lastActivity?: string;
}

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

export interface AuthenticateResult {
	user?: BusUser;
	redirectTo?: Response;
}

export abstract class AuthProvider {
	constructor(protected readonly stage: string) {}

	/**
	 * Authenticate from request — called when no session cookie exists.
	 * Returns:
	 *   - { user } — authenticated; framework serializes to cookie
	 *   - { redirectTo: Response } — OAuth redirect / client-auth flow
	 *   - Throws NotAuthenticatedError — not authenticated, redirect to /signin
	 */
	abstract authenticate(event: RequestEvent): Promise<AuthenticateResult>;

	/**
	 * Validate/refresh the existing session on every request.
	 * Returns:
	 *   - undefined — session still valid, no cookie update needed
	 *   - BusUser — updated user (e.g. refreshed tokens); framework re-serializes cookie
	 *   - Throws ForceUserToReauthenticateError — session invalid, clear cookies + redirect
	 */
	validateUser?(_event: RequestEvent, _user: BusUser): Promise<BusUser | undefined>;

	/**
	 * Get Cognito identity credentials for AWS SDK calls.
	 * Return undefined if not applicable (e.g. local dev mock).
	 */
	getUserCognitoIdentity?(
		_user: BusUser
	): Promise<{ identityId: string; token: string } | undefined>;

	/**
	 * Get full AWS credentials (accessKeyId, secretAccessKey, sessionToken, expiration)
	 * for use with AWS SDK. Used by getSession and /api/aws-creds.
	 */
	getAwsCredentials?(
		_user: BusUser
	): Promise<
		| { accessKeyId: string; secretAccessKey: string; sessionToken: string; expiration: Date }
		| undefined
	>;

	/**
	 * Handle logout. Return redirect path or undefined for default /signin.
	 */
	logout?(_event: RequestEvent, _user: BusUser): Promise<string | undefined>;
}
