# Authentication

The webapp ships three auth modes behind a pluggable `AuthProvider` abstraction. The same codebase runs in all three:

| Mode | Auth data source | AWS credentials | When used |
|---|---|---|---|
| **LOCAL** (mock) | Hardcoded test user | Your `~/.aws/credentials` `default` profile | Local dev; default when `LOCAL=true` |
| **OAuth** | `@auth/sveltekit` (Cognito / Google / GitHub / 50+ built-ins) | Minted via Cognito Identity Pool from the ID token | OSS / non-DSCO deployments |
| **DSCO** | DSCO `dw-auth-token` → LEO_AUTH table lookup | Minted via Cognito Identity Pool from the LEO_AUTH token | All deployed bus-ui stages |

## Contents

- [The AuthProvider pattern](#the-authprovider-pattern)
- [Request lifecycle](#request-lifecycle)
- [Cookies](#cookies)
- [AWS credentials on demand](#aws-credentials-on-demand)
- [LOCAL mode](#local-mode)
- [OAuth mode](#oauth-mode)
- [DSCO mode](#dsco-mode)
- [Extending with other OAuth providers](#extending-with-other-oauth-providers)
- [Troubleshooting](#troubleshooting)

---

## The AuthProvider pattern

The core abstraction is [`AuthProvider`](./src/lib/server/auth/types.ts) — an abstract class with three lifecycle hooks:

```ts
abstract class AuthProvider {
  // Called when no session cookie exists yet.
  // Returns { authenticatedUser }, { redirectTo }, or throws NotAuthenticatedError.
  abstract authenticate(event): Promise<AuthenticateResult>;

  // Called on every request that has a session. Can refresh tokens,
  // check idle/absolute timeouts, verify device fingerprint / IP.
  // Throws ForceUserToReauthenticateError to force re-login.
  validateUser?(event, user): Promise<AuthenticatedUser | undefined>;

  // Mints fresh AWS creds on demand (for /api/aws-creds).
  getAwsCredentials?(user): Promise<{ accessKeyId, secretAccessKey, sessionToken, expiration }>;

  // Optional: inject per-route data into event.locals (e.g. DSCO token URLs
  // to pass to the client-auth page).
  addValueToLocalsForRoute?(pathName, event, user): Promise<Record<string, unknown> | undefined>;

  // Optional: return a redirect URL for signout.
  logout?(event, user): Promise<string | undefined>;
}
```

Provider loading happens once per process in [`src/lib/server/auth/index.ts`](./src/lib/server/auth/index.ts):

```
1. LOCAL=true        → DefaultAuthProvider (mock)
2. dynamic import ../auth-provider.js  → custom DSCO provider (or any impl)
3. fallback          → DefaultAuthProvider
```

> **OSS users:** replace [`src/lib/server/auth-provider.ts`](./src/lib/server/auth-provider.ts) (the placeholder `export default undefined`) with your own `AuthProvider` subclass. The file is deliberately ungitignored so forks can drop in custom flows without merge conflicts.

## Request lifecycle

Every request goes through [`hooks.server.ts`](./src/hooks.server.ts) in this order:

```
┌─ @auth/sveltekit handle (OAuth sign-in / callback routes only)
│
└─ Our handle
   ├─ 1. Public path? (/signin, /signout, /health, /auth/*, /api/auth/*)
   │     → let addValueToLocalsForRoute inject custom data → resolve → return
   │
   ├─ 2. /force-reauth? → clear cookies → 302 return_url
   │
   ├─ 3. Try restore user from @auth/sveltekit session (OAuth)
   │     → if session.user.sub: build BusUser → serialize to bu cookie
   │
   ├─ 4. Else: deserialize user from encrypted bu cookie
   │
   ├─ 5. If user found:
   │     → provider.validateUser(user)
   │       → undefined: session still valid
   │       → AuthenticatedUser: refreshed; re-serialize cookie
   │       → throws ForceUserToReauthenticateError (allowRetry=true):
   │         → clear cookies, 302 to self with ?auth_retry=1
   │         → if already retried: 302 /signin
   │       → throws ForceUserToReauthenticateError (allowRetry=false):
   │         → clear cookies, fall through to authenticate()
   │
   ├─ 6. If still no user:
   │     → provider.authenticate(event)
   │       → { authenticatedUser }: serialize cookie, continue
   │       → { redirectTo: Response }: return that Response (OAuth / client-auth)
   │       → throws NotAuthenticatedError: 302 /signin
   │
   ├─ 7. Populate event.locals.user and event.locals.authProvider
   │
   └─ 8. resolve(event) → log status
```

## Cookies

All auth cookies are `httpOnly`, `secure`, `SameSite=Lax`, 4-hour `maxAge`, and written with a `v1:` version prefix so future key rotations can detect legacy cookies.

| Cookie | Contents | Purpose |
|---|---|---|
| `bu` | AES-256-GCM encrypted `AuthenticatedUser` JSON | Primary session cookie; source of `locals.user` |
| `das` | DSCO-only: fingerprint hash | Session integrity check (DSCO provider) |
| `did` | DSCO-only: device ID | Device binding (DSCO provider) |

The encryption key is `SHA-256(AUTH_SECRET)`. `AUTH_SECRET` is 32 random bytes, generated once per stage and stored in SSM SecureString at deploy time (or in `.env.local` for dev). Rotating it invalidates all active sessions.

Implementation: [`src/lib/server/cookies.ts`](./src/lib/server/cookies.ts).

## AWS credentials on demand

The webapp does **not** mint Cognito Identity Pool credentials during SSR. Instead, the client calls [`GET /api/aws-creds`](./src/routes/api/aws-creds/+server.ts) when it needs fresh credentials:

```
GET /api/aws-creds
  → hooks.server.ts populates locals.user
  → aws-creds endpoint calls getSession(locals)
  → getSession calls provider.getAwsCredentials(locals.user)
  → returns { accessKeyId, secretAccessKey, sessionToken, expiration }
```

This avoids the old Botmon anti-pattern of minting credentials on every server render. Clients cache the returned creds until `expiration`.

API routes that already need AWS access (e.g. stats endpoints) call `getSession(locals)` themselves:

```ts
const { aws_credentials } = await getSession(locals);
```

## LOCAL mode

**When:** `LOCAL=true` in env. Default when running `npm run create-env-*` without `--auth`.

**What it does:**

- `DefaultAuthProvider` always returns the hardcoded user `{ userId: 'local-dev', firstName: 'Local', lastName: 'Developer', userType: 'internal-user' }`
- `getAwsCredentials()` reads from `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` env vars (your `default` AWS profile)
- **Skips entirely**: OAuth provider config, DSCO token exchange, LEO_AUTH lookup, Cognito Identity Pool minting, session validation, fingerprinting
- Still issues a `bu` cookie so SSR + client state behave the same as deployed

**SECURITY:** Never deploy with `LOCAL=true`. Every request auto-authenticates as the same user.

## OAuth mode

**When:** `LOCAL=false` and `AUTH_*_ENABLED=true` for at least one provider in `.env.local` or `providers.config.json`.

**What it does:**

- `OAuthAuthProvider` wraps `@auth/sveltekit`
- Sign-in: the `/signin` page lists providers returned by `/api/auth/providers`; user clicks → `@auth/sveltekit` handles the OAuth dance → session is established
- `hooks.server.ts` detects the session in step 3 of the request lifecycle, builds `BusUser` from the ID token, and writes the `bu` cookie
- `getAwsCredentials()` uses `fromCognitoIdentityPool()` with the OAuth ID token as the login
- Session expires based on ID token lifetime; refresh tokens are stored on the `@auth/sveltekit` session and picked up by `buildBusUserFromSession`

**Supported providers (out of the box):** Cognito, Google, GitHub. Any of the 50+ `@auth/sveltekit` built-ins can be added — see [extending](#extending-with-other-oauth-providers).

**Required env vars (Cognito example):**

```
AUTH_COGNITO_ENABLED=true
AUTH_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
AUTH_COGNITO_ID=<client-id>
AUTH_COGNITO_SECRET=<client-secret>
AWS_REGION=us-east-1
AUTH_SECRET=<32-byte-base64>
```

## DSCO mode

**When:** `LOCAL=false`, no OAuth provider enabled, and `src/lib/server/auth-provider.ts` exports a DSCO provider class. This is the mode that runs in every deployed bus-ui stage.

**Flow:**

```
Browser (dsco.io subdomain)
  │
  │  GET /botmonAlpha/
  │
  ▼
Lambda (hooks.server.ts)
  │
  │  1. No bu cookie found
  │  2. DscoAuthProvider.authenticate() called
  │  3. Returns a redirect to /botmonAlpha/auth/client-auth
  │
  ▼
/auth/client-auth (public path)
  │
  │  Client-side JS:
  │   a. Reads dw-auth-token cookie (set by *-core.dsco.io login)
  │   b. POSTs token to /botmonAlpha/auth/exchange
  │
  ▼
/auth/exchange (server)
  │
  │  1. Verifies dw-auth-token with DSCO token endpoint
  │  2. Looks up user in LEO_AUTH DynamoDB table
  │  3. Derives device fingerprint (user agent + IP hash)
  │  4. Mints Cognito Identity Pool creds
  │  5. Builds AuthenticatedUser with authData = { dscoToken, cognitoIdentityId, ... }
  │  6. Sets bu, das, did cookies
  │  7. 302 back to original path
  │
  ▼
Original request now succeeds
```

**Session validation** runs on every request via `DscoAuthProvider.validateUser()`:

- **Idle timeout** — session expires after N minutes of inactivity
- **Absolute timeout** — session expires N hours after initial login regardless
- **Fingerprint check** — `das` cookie must match `SHA-256(userAgent + ipBucket)`; mismatch = `ForceUserToReauthenticateError(allowRetry: false)`
- **IP binding** — stored IP must match current request IP (with a /24 tolerance for CGNAT); mismatch = force reauth

**Why DSCO auth can't be tested locally:**

`*-core.dsco.io` (where the `dw-auth-token` is issued) uses a strict CORS allowlist. Only `*-apps.dsco.io` origins can exchange tokens. `localhost` is rejected. Options:

1. Deploy to a test stage and test there (recommended)
2. Use `USE_LOCAL_COGNITO_IDENTITY=true` with `LOCAL_COGNITO_IDENTITY_ID` and `LOCAL_COGNITO_IDENTITY_TOKEN` to bypass the DSCO token fetch but still exercise cred minting
3. Use a tunnel (ngrok / Cloudflare Tunnel) with a DSCO-allowlisted origin — requires DSCO team coordination

**Env vars:**

```
LOCAL=false
STAGE=test                      # test | staging | prod — affects DSCO endpoints
LEO_AUTH_USER_TABLE_NAME=TestAuth-LeoAuthUser-OZ7R6RHZIPDY
AWS_REGION=us-west-2            # Cognito Identity Pool region
AUTH_SECRET=<32-byte-base64>
```

Cognito Identity Pool IDs are stage-specific and hardcoded in the DSCO provider (e.g. test pool: `us-west-2:aa1428e4-3b13-4dc2-ac73-e2f8c9e5a3b4`).

## Extending with other OAuth providers

Add a new `@auth/sveltekit` provider in two edits:

1. **`src/auth.ts`** — import the provider and add it to the `providers` array conditionally:

    ```ts
    import Okta from '@auth/sveltekit/providers/okta';
    // ...
    if (authConfig.providers.okta?.enabled) {
      providers.push(Okta({
        clientId: authConfig.providers.okta.id,
        clientSecret: authConfig.providers.okta.secret,
        issuer: authConfig.providers.okta.issuer,
      }));
    }
    ```

2. **`src/lib/auth/config.ts`** — add `'okta'` to `AvailableAuthProviders`:

    ```ts
    export const AvailableAuthProviders = ['cognito', 'google', 'github', 'okta'] as const;
    ```

Then enable it in `providers.config.json`:

```json
{
  "providers": {
    "okta": { "enabled": true, "id": "...", "secret": "...", "issuer": "https://..." }
  }
}
```

No changes to `hooks.server.ts`, cookies, or `/api/aws-creds` needed — `OAuthAuthProvider` handles any provider that emits an ID token usable as a Cognito Identity Pool login.

## Troubleshooting

**"Redirect loop to /signin"**
The `bu` cookie is being rejected. Check `AUTH_SECRET` matches what wrote the cookie (rotating the secret invalidates sessions). Also check your browser's SameSite cookie behavior if you're on a different subdomain.

**"NotAuthenticatedError thrown from authenticate()"**
The provider couldn't find any credentials to build a user. For DSCO: check that `dw-auth-token` cookie is present on the dsco.io parent. For OAuth: check that at least one provider has `enabled: true` in `providers.config.json`.

**"ForceUserToReauthenticateError: fingerprint mismatch"**
User agent or IP changed. Expected when VPN is toggled. `allowRetry=false` — user must sign in again.

**"getAwsCredentials returned undefined"**
LOCAL mode: `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` not set in env. DSCO mode: DSCO token expired or LEO_AUTH lookup failed (check `LEO_AUTH_USER_TABLE_NAME` env var matches the stage).

**"DEBUG_AUTH=true" output**
Enabling `DEBUG_AUTH=true` in `.env.local` logs every auth decision — cookie read/write, validation results, force-reauth reasons, cred minting. Paste the log prefix (`[Hooks]`, `[Auth]`, `[DscoAuth]`) when asking for help.

**Inspecting the `bu` cookie**
The cookie is AES-GCM encrypted with the version prefix `v1:`. Decrypt it with:

```js
// in a server-side route
import { deserializeUserFromCookies } from '$lib/server/cookies';
const user = await deserializeUserFromCookies(event);
console.log(user);
```

Don't try to decode it client-side — it's `httpOnly`.
