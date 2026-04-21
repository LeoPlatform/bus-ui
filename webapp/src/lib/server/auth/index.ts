/**
 * Load the active AuthProvider.
 *
 * Priority:
 *  1. LOCAL=true → DefaultAuthProvider (always; bypasses any custom provider)
 *  2. `../auth-provider` — custom DSCO provider (or any other custom impl)
 *  3. DefaultAuthProvider — mock for local dev (fallback when import fails)
 *
 * If USE_LOCAL_COGNITO_IDENTITY=true, overrides getUserCognitoIdentity with
 * values from LOCAL_COGNITO_IDENTITY_ID and LOCAL_COGNITO_IDENTITY_TOKEN.
 */

import { env } from '$env/dynamic/private';
import { DefaultAuthProvider } from './default-provider.js';
import type { AuthProvider } from './types.js';
export { ForceUserToReauthenticateError, NotAuthenticatedError } from './types.js';

const stage = env.STAGE || process.env.STAGE || (process.env.NODE_ENV === 'production' ? 'prod' : 'test');

function isLocalMode(): boolean {
    return env.LOCAL === 'true' || process.env.LOCAL === 'true';
}

export async function loadAuthProvider(): Promise<AuthProvider> {
    if (isLocalMode()) {
        console.log('[Auth] LOCAL=true — using DefaultAuthProvider (local dev mock)');
        return addLocalCognitoIdentityOverrideIfConfigured(new DefaultAuthProvider(stage));
    }

    let provider: AuthProvider | undefined;

    try {
        const mod = await import('../auth-provider.js');
        const ProviderClass = mod.default;
        if (ProviderClass && typeof ProviderClass === 'function') {
            provider = new (ProviderClass as new (s: string) => AuthProvider)(stage);
            console.log('[Auth] Custom DSCO auth provider loaded');
        }
    } catch {
        // No custom provider — fall back to default
    }

    if (!provider) {
        console.log('[Auth] Using DefaultAuthProvider (local dev mock)');
        provider = new DefaultAuthProvider(stage);
    }

    return addLocalCognitoIdentityOverrideIfConfigured(provider);
}

function addLocalCognitoIdentityOverrideIfConfigured(provider: AuthProvider): AuthProvider {
    const useLocal = process.env.USE_LOCAL_COGNITO_IDENTITY === 'true';
    if (!useLocal) return provider;

    const identityId = process.env.LOCAL_COGNITO_IDENTITY_ID;
    const token = process.env.LOCAL_COGNITO_IDENTITY_TOKEN;

    if (!identityId || !token) {
        throw new Error(
            'USE_LOCAL_COGNITO_IDENTITY=true but LOCAL_COGNITO_IDENTITY_ID or LOCAL_COGNITO_IDENTITY_TOKEN is not set'
        );
    }

    provider.getUserCognitoIdentity = async (_user) => ({
        cognitoIdentityId: identityId,
        cognitoAccessToken: token,
    });

    return provider;
}
