// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Authenticated user — set by hooks.server.ts after DSCO or OAuth auth. */
			user?: import('$lib/server/auth/types.js').AuthenticatedUser;
			/** Active auth provider — set by hooks.server.ts on every request. */
			authProvider?: import('$lib/server/auth/types.js').AuthProvider;
			/**
			 * Extra per-route data injected by auth provider's addValueToLocalsForRoute().
			 * For example: DSCO token endpoint URLs passed to the client-auth page.
			 */
			customData?: Record<string, unknown>;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

interface AwsCreds {
	accessKeyId: string;
	secretAccessKey: string;
	sessionToken: string;
	expiration: Date;
}

import type { DefaultSession } from '@auth/core/types';

// Extend the default session type to include AWS credentials
declare module '@auth/core/types' {
	interface Session {
		user?: {
			sub?: string;
			name?: string;
			email?: string;
			image?: string;
		} & DefaultSession['user'];
		access_token?: string;
		id_token?: string;
		aws_credentials?: AwsCreds;
	}
}

// Extend the JWT type
declare module '@auth/core/jwt' {
	interface JWT {
		provider?: string;
		sub?: string;
		access_token?: string;
		id_token?: string;
		refresh_token?: string;
		expires_at: number;
	}
}

export {};
