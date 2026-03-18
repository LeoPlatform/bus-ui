/**
 * Handle chain: run @auth/sveltekit first, then set locals.user from session or bu cookie.
 */

import { redirect } from '@sveltejs/kit';
import { handle as authHandle } from './auth.js';
import { getAuthConfig, loadAuthProvider } from '$lib/server/auth/index.js';
import { OAuthAuthProvider } from '$lib/server/auth/oauth-provider.js';
import type { SessionWithTokens } from '$lib/server/auth/oauth-provider.js';
import { getBusUserFromCookie, setBusUserCookie, clearBusUserCookie } from '$lib/server/cookies.js';

let authProvider: Awaited<ReturnType<typeof loadAuthProvider>> | null = null;

async function getProvider() {
	if (authProvider) return authProvider;
	const config = await getAuthConfig();
	authProvider = await loadAuthProvider(config);
	return authProvider;
}

export async function handle({ event, resolve }) {
	return authHandle({
		event,
		resolve: async (e) => {
			const provider = await getProvider();
			e.locals.authProvider = provider;

			const session = (await e.locals.auth()) as SessionWithTokens | null;

			if (session?.user?.sub) {
				const oauth = provider as OAuthAuthProvider;
				if (typeof oauth.buildBusUserFromSession === 'function') {
					const user = oauth.buildBusUserFromSession(session);
					await setBusUserCookie(user, { cookies: e.cookies });
					e.locals.user = user;
				}
				const res = await resolve(e);
				console.log(`[Hooks] ${e.request.method} ${e.url.pathname} -> ${res.status} (from session)`);
				return res;
			}

			const user = await getBusUserFromCookie({ cookies: e.cookies });
			if (user) {
				try {
					const updated = await provider.validateUser?.(e, user);
					if (updated) {
						await setBusUserCookie(updated, { cookies: e.cookies });
						e.locals.user = updated;
					} else {
						e.locals.user = user;
					}
				} catch {
					clearBusUserCookie({ cookies: e.cookies });
					// fall through to redirect
				}
				if (e.locals.user) {
					const res = await resolve(e);
					console.log(`[Hooks] ${e.request.method} ${e.url.pathname} -> ${res.status} (from cookie)`);
					return res;
				}
			}

			const path = e.url.pathname;
			if (path === '/signin' || path.startsWith('/auth/') || path === '/signout' || path.startsWith('/api/auth/')) {
				const res = await resolve(e);
				console.log(`[Hooks] ${e.request.method} ${e.url.pathname} -> ${res.status} (bypassed)`);
				return res;
			}

			// Try to authenticate via the provider (useful for DefaultAuthProvider)
			try {
				const result = await provider.authenticate(e);
				if (result.user) {
					await setBusUserCookie(result.user, { cookies: e.cookies });
					e.locals.user = result.user;
					const res = await resolve(e);
					console.log(`[Hooks] ${e.request.method} ${e.url.pathname} -> ${res.status} (from provider)`);
					return res;
				} else if (result.redirectTo) {
					console.log(`[Hooks] ${e.request.method} ${e.url.pathname} -> Redirecting via provider`);
					return result.redirectTo;
				}
			} catch (err) {
				// Not authenticated, fall through to redirect
			}

			console.log(`[Hooks] ${e.request.method} ${e.url.pathname} -> Redirecting to signin`);
			throw redirect(303, `/signin?redirectTo=${encodeURIComponent(e.url.pathname + e.url.search)}`);
		},
	});
}
