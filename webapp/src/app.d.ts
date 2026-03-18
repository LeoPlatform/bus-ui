// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Set by hooks after AuthProvider flow (Stage 2). Until then, auth uses @auth/sveltekit and session. */
			user?: import('$lib/server/auth/types.js').BusUser;
			/** Set by hooks when AuthProvider is loaded (Stage 2). */
			authProvider?: import('$lib/server/auth/types.js').AuthProvider;
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