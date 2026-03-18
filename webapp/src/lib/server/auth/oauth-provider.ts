/**
 * OAuthAuthProvider: builds BusUser from @auth/sveltekit session and provides
 * validateUser (token refresh) and getUserCognitoIdentity (Identity Pool creds).
 * Does not replace @auth/sveltekit — runs after it in the handle chain.
 */

import type { RequestEvent } from '@sveltejs/kit';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-providers';
import type { AuthConfig } from '$lib/auth/config.js';
import { AuthProvider, type BusUser } from './types.js';
import type { AuthenticateResult } from './types.js';
import { NotAuthenticatedError } from './types.js';
import type { Session } from '@auth/core/types';

/** Session shape we expect from @auth/sveltekit (session callback adds these). */
export interface SessionWithTokens extends Session {
	access_token?: string;
	id_token?: string;
	refresh_token?: string;
	expires_at?: number;
	provider?: string;
}

function getIdentityPoolLoginKey(provider: string): string {
	const region = process.env.AWS_REGION ?? 'us-east-1';
	const userPoolId = process.env.AUTH_COGNITO_USER_POOL_ID ?? '';
	if (provider === 'cognito' && userPoolId) {
		return `cognito-idp.${region}.amazonaws.com/${userPoolId}`;
	}
	if (provider === 'google') return 'accounts.google.com';
	if (provider === 'github') return 'github.com';
	return '';
}

export class OAuthAuthProvider extends AuthProvider {
	constructor(
		stage: string,
		private readonly config: AuthConfig
	) {
		super(stage);
	}

	/** OAuth is handled by @auth/sveltekit; this is only used when no session. */
	async authenticate(_event: RequestEvent): Promise<AuthenticateResult> {
		throw new NotAuthenticatedError('Use @auth/sveltekit sign-in flow');
	}

	/**
	 * Build BusUser from @auth/sveltekit session (call after auth handle has run).
	 */
	buildBusUserFromSession(session: SessionWithTokens): BusUser {
		if (!session?.user?.sub) throw new Error('Invalid session: missing user.sub');
		const provider = session.provider ?? 'cognito';
		const identityPoolLoginKey = getIdentityPoolLoginKey(provider);
		return {
			userId: session.user.sub,
			name: session.user.name ?? undefined,
			email: session.user.email ?? undefined,
			picture: session.user.image ?? undefined,
			provider,
			authData: {
				accessToken: session.access_token ?? '',
				idToken: session.id_token,
				refreshToken: session.refresh_token,
				expiresAt: session.expires_at ?? 0,
				identityPoolLoginKey: identityPoolLoginKey || undefined,
			},
			sessionCreatedAt: new Date().toISOString(),
			lastActivity: new Date().toISOString(),
		};
	}

	async validateUser(
		_event: RequestEvent,
		user: BusUser
	): Promise<BusUser | undefined> {
		const now = Math.floor(Date.now() / 1000);
		const bufferSeconds = 60;
		if (user.authData.expiresAt > now + bufferSeconds) return undefined;
		if (!user.authData.refreshToken) return undefined;
		// Token refresh would go here; for now we leave as-is and let client re-auth when needed
		return undefined;
	}

	async getUserCognitoIdentity(
		user: BusUser
	): Promise<{ identityId: string; token: string } | undefined> {
		const c = await this.getAwsCredentials(user);
		if (!c) return undefined;
		return { identityId: '', token: c.sessionToken };
	}

	async getAwsCredentials(
		user: BusUser
	): Promise<
		| { accessKeyId: string; secretAccessKey: string; sessionToken: string; expiration: Date }
		| undefined
	> {
		if (!user.authData.idToken || !user.authData.identityPoolLoginKey)
			return undefined;
		const identityPoolId = process.env.AUTH_COGNITO_IDENTITY_POOL_ID ?? '';
		if (!identityPoolId) return undefined;
		const logins = { [user.authData.identityPoolLoginKey]: user.authData.idToken };
		const creds = fromCognitoIdentityPool({
			clientConfig: {
				region:
					this.config.providers.cognito?.region ?? process.env.AWS_REGION ?? 'us-east-1',
			},
			identityPoolId,
			logins,
		});
		const resolved = await creds();
		if (!resolved.sessionToken || !resolved.expiration) return undefined;
		return {
			accessKeyId: resolved.accessKeyId ?? '',
			secretAccessKey: resolved.secretAccessKey ?? '',
			sessionToken: resolved.sessionToken,
			expiration: resolved.expiration,
		};
	}
}
