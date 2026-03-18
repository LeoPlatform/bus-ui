/**
 * Load the active AuthProvider (custom, OAuth, or default mock).
 */

import type { AuthConfig } from '$lib/auth/config.js';
import {
	loadAuthConfigFromEnv,
	loadAuthConfigFromExternalSource,
	loadAuthConfigFromLocal,
} from '$lib/auth/config.js';
import type { AuthProvider } from './types.js';
import { OAuthAuthProvider } from './oauth-provider.js';
import { DefaultAuthProvider } from './default-provider.js';

const stage = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';

let cachedConfig: AuthConfig | null = null;

export async function getAuthConfig(): Promise<AuthConfig> {
	if (cachedConfig) return cachedConfig;
	let config = loadAuthConfigFromEnv();
	const AUTH_CONFIG_SOURCE = process.env.AUTH_CONFIG_SOURCE;
	const LOCAL = process.env.LOCAL;
	try {
		if (AUTH_CONFIG_SOURCE && !LOCAL) {
			config = await loadAuthConfigFromExternalSource(AUTH_CONFIG_SOURCE);
		} else if (AUTH_CONFIG_SOURCE) {
			config = await loadAuthConfigFromLocal(AUTH_CONFIG_SOURCE);
		}
	} catch (e) {
		console.error('Failed to load auth config from source:', e);
	}
	cachedConfig = config;
	return config;
}

export async function loadAuthProvider(config: AuthConfig): Promise<AuthProvider> {
	try {
		const mod = await import('../auth-provider.js');
		if (mod.default && typeof mod.default === 'function') {
			return new mod.default(stage) as AuthProvider;
		}
		if (mod.default && typeof (mod.default as { prototype?: unknown }).prototype !== 'undefined') {
			return new (mod.default as new (s: string) => AuthProvider)(stage);
		}
	} catch {
		// No custom provider
	}

	const hasOAuth = Object.values(config.providers).some((p) => p.enabled);
	if (hasOAuth) {
		return new OAuthAuthProvider(stage, config);
	}
	return new DefaultAuthProvider(stage);
}
