// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {
		// 	user: import('$lib/types').User
		// }
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