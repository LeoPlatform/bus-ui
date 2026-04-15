/**
 * Mock auth provider for local dev when no DSCO auth is configured.
 * Returns a hardcoded test user; reads AWS creds from env vars.
 *
 * SECURITY WARNING: This provider is for development only!
 * It auto-authenticates every request as the same hardcoded user.
 */

import type { RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { AuthProvider } from './types.js';
import type { AuthenticatedUser, AuthenticateResult } from './types.js';

export class DefaultAuthProvider extends AuthProvider {
    async authenticate(_event: RequestEvent): Promise<AuthenticateResult> {
        const user: AuthenticatedUser = {
            userId: 'local-dev',
            firstName: 'Local',
            lastName: 'Developer',
            userType: 'internal-user',
            authData: undefined,
            customData: undefined,
            roles: [],
        };
        return { authenticatedUser: user };
    }

    async getAwsCredentials(_user: AuthenticatedUser) {
        const accessKeyId =
            env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey =
            env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
        const sessionToken =
            env.AWS_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN;

        if (accessKeyId && secretAccessKey) {
            return {
                accessKeyId,
                secretAccessKey,
                sessionToken: sessionToken || '',
                expiration: new Date(Date.now() + 86400 * 1000),
            };
        }
        console.error('[DefaultAuthProvider] Missing AWS credentials in env');
        return undefined;
    }
}
