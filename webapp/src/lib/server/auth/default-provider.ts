/**
 * Mock auth provider for local dev when no OAuth is configured.
 */

import type { RequestEvent } from '@sveltejs/kit';
import { AuthProvider, type BusUser, type AuthenticateResult } from './types.js';
import { env } from '$env/dynamic/private';

const MOCK_USER: BusUser = {
	userId: 'local-dev',
	name: 'Local Developer',
	email: 'local@localhost',
	provider: 'default',
	authData: {
		accessToken: '',
		expiresAt: Math.floor(Date.now() / 1000) + 86400,
	},
	sessionCreatedAt: new Date().toISOString(),
};

export class DefaultAuthProvider extends AuthProvider {
	async authenticate(_event: RequestEvent): Promise<AuthenticateResult> {
		return { user: { ...MOCK_USER, sessionCreatedAt: new Date().toISOString() } };
	}

	async getAwsCredentials(_user: BusUser) {
		const accessKeyId = env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
		const secretAccessKey = env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
		const sessionToken = env.AWS_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN;
		
		if (accessKeyId && secretAccessKey) {
			return {
				accessKeyId,
				secretAccessKey,
				sessionToken: sessionToken || '',
				expiration: new Date(Date.now() + 86400 * 1000)
			};
		}
		console.error("DefaultAuthProvider: Missing AWS credentials in env");
		return undefined;
	}
}
