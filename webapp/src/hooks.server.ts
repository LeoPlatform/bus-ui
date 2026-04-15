/**
 * SvelteKit server hooks.
 *
 * Handle chain (DSCO auth takes priority over OAuth):
 *  1. Public routes bypass: /signin, /signout, /auth/*, /api/auth/*, /health
 *  2. Force-reauth: clear cookies and redirect
 *  3. Deserialize user from `bu` cookie
 *  4. If user found: call validateUser() — handle ForceUserToReauthenticateError
 *  5. If no user: call authenticate() — handle redirects, set bu cookie
 *  6. Set event.locals.user and event.locals.authProvider
 *  7. Call addValueToLocalsForRoute() if provider implements it
 *
 * @auth/sveltekit (OAuth) still runs inside the chain for OAuth sign-in flows.
 */

import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { handle as authHandle } from './auth.js';
import { loadAuthProvider, ForceUserToReauthenticateError, NotAuthenticatedError } from '$lib/server/auth/index.js';
import type { AuthProvider } from '$lib/server/auth/types.js';
import { OAuthAuthProvider } from '$lib/server/auth/oauth-provider.js';
import type { SessionWithTokens } from '$lib/server/auth/oauth-provider.js';
import {
    serializeUserToCookies,
    deserializeUserFromCookies,
    clearAllAuthCookies,
    setBusUserCookie,
} from '$lib/server/cookies.js';
import type { AuthenticatedUser } from '$lib/server/auth/types.js';

// ---------------------------------------------------------------------------
// Module-level singleton — auth provider loaded once per process
// ---------------------------------------------------------------------------

let authProvider: AuthProvider | null = null;

async function getProvider(): Promise<AuthProvider> {
    if (authProvider) return authProvider;
    authProvider = await loadAuthProvider();
    return authProvider;
}

// ---------------------------------------------------------------------------
// Public paths that require no authentication
// ---------------------------------------------------------------------------

function isPublicPath(pathname: string): boolean {
    // Strip base path prefix so route checks work regardless of deployment path
    const path = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
    return (
        path === '/signin' ||
        path === '/signout' ||
        path === '/health' ||
        path.startsWith('/auth/') ||
        path.startsWith('/api/auth/')
    );
}

// ---------------------------------------------------------------------------
// Main handle
// ---------------------------------------------------------------------------

export async function handle({ event, resolve }) {
    return authHandle({
        event,
        resolve: async (e) => {
            const provider = await getProvider();
            e.locals.authProvider = provider;

            const pathname = e.url.pathname;

            // ------------------------------------------------------------------
            // Public routes — no auth required
            // ------------------------------------------------------------------
            if (isPublicPath(pathname)) {
                // Let addValueToLocalsForRoute inject customData (e.g. DSCO URLs for client-auth)
                await addToLocalsFromAuthProvider(pathname, e, provider, undefined);
                const res = await resolve(e);
                console.log(`[Hooks] ${e.request.method} ${pathname} -> ${res.status} (public)`);
                return res;
            }

            // ------------------------------------------------------------------
            // Force re-auth route
            // ------------------------------------------------------------------
            if (pathname === `${base}/force-reauth`) {
                clearAllAuthCookies(e);
                const returnUrl = e.url.searchParams.get('return_url') || '/';
                console.log('[Hooks] Force re-auth: clearing cookies and redirecting to', returnUrl);
                return redirect(302, returnUrl);
            }

            // ------------------------------------------------------------------
            // Try to restore user from session (OAuth) first
            // ------------------------------------------------------------------
            let user: AuthenticatedUser | undefined;

            const session = (await e.locals.auth?.()) as SessionWithTokens | null;
            if (session?.user?.sub) {
                const oauth = provider as OAuthAuthProvider;
                if (typeof oauth.buildBusUserFromSession === 'function') {
                    user = oauth.buildBusUserFromSession(session);
                    await serializeUserToCookies(e, user);
                }
            }

            // ------------------------------------------------------------------
            // Try to restore user from encrypted bu cookie
            // ------------------------------------------------------------------
            if (!user) {
                user = await deserializeUserFromCookies(e) ?? undefined;
            }

            // ------------------------------------------------------------------
            // Validate existing user (timeouts, fingerprint, IP)
            // ------------------------------------------------------------------
            if (user) {
                try {
                    if (provider.validateUser) {
                        const updated = await provider.validateUser(e, user);
                        if (updated) {
                            await serializeUserToCookies(e, updated);
                            user = updated;
                        }
                    }
                } catch (err) {
                    if (err instanceof ForceUserToReauthenticateError) {
                        console.log(`[Hooks] ForceReauth: ${err.message} (allowRetry=${err.allowRetry})`);
                        clearAllAuthCookies(e);
                        // Clear user so we fall through to authenticate() below
                        // which will start the DSCO flow (or OAuth flow, depending on provider)
                        user = undefined;

                        if (err.allowRetry) {
                            const url = new URL(e.url);
                            if (url.searchParams.has('auth_retry')) {
                                console.log('[Hooks] Auth retry already attempted, redirecting to /signin');
                                return redirect(302, `${base}/signin`);
                            }
                            url.searchParams.set('auth_retry', '1');
                            console.log('[Hooks] Retrying auth:', url.pathname + url.search);
                            return redirect(302, url.pathname + url.search);
                        }
                        // For non-retry cases (security violations, migration), fall through
                        // to authenticate() which will restart the full auth flow
                    } else {
                        throw err;
                    }
                }
            }

            // ------------------------------------------------------------------
            // No user yet — call authenticate() to start / continue the auth flow
            // ------------------------------------------------------------------
            if (!user) {
                try {
                    const result = await provider.authenticate(e);
                    if (result.authenticatedUser) {
                        user = result.authenticatedUser;
                        await serializeUserToCookies(e, user);
                    }
                    if (result.redirectTo) {
                        console.log(`[Hooks] ${e.request.method} ${pathname} -> authenticate() redirect`);
                        return result.redirectTo;
                    }
                    if (!user) {
                        return redirect(302, `${base}/signin?redirectTo=${encodeURIComponent(pathname + e.url.search)}`);
                    }
                } catch (err) {
                    if (err instanceof NotAuthenticatedError) {
                        clearAllAuthCookies(e);
                        return redirect(302, `${base}/signin`);
                    }
                    throw err;
                }
            }

            // ------------------------------------------------------------------
            // User is authenticated — populate locals
            // ------------------------------------------------------------------
            e.locals.user = user;

            await addToLocalsFromAuthProvider(pathname, e, provider, user);

            // Clean up auth_retry query param on successful auth
            if (e.url.searchParams.has('auth_retry')) {
                const url = new URL(e.url);
                url.searchParams.delete('auth_retry');
                return redirect(302, url.pathname + url.search);
            }

            const res = await resolve(e);
            console.log(`[Hooks] ${e.request.method} ${pathname} -> ${res.status}`);
            return res;
        },
    });
}

// ---------------------------------------------------------------------------
// Helper: inject provider-specific data into event.locals
// ---------------------------------------------------------------------------

async function addToLocalsFromAuthProvider(
    pathname: string,
    event: Parameters<typeof handle>[0]['event'],
    provider: AuthProvider,
    user: AuthenticatedUser | undefined
): Promise<void> {
    if (!provider.addValueToLocalsForRoute) return;
    // Strip base prefix and trailing slash for consistent matching
    let normalizedPath = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
    if (normalizedPath.endsWith('/') && normalizedPath.length > 1) {
        normalizedPath = normalizedPath.slice(0, -1);
    }
    const extra = await provider.addValueToLocalsForRoute(normalizedPath, event, user);
    if (extra) {
        console.log(`[Hooks] addValueToLocalsForRoute injected customData for ${normalizedPath}:`, Object.keys(extra));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (event.locals as any).customData = extra;
    }
}
