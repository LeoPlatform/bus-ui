/**
 * DscoAuthProvider — DSCO internal-user authentication for bus-ui.
 *
 * Auth flow:
 *   1. No `bu` cookie → authenticate() checks for `did` cookie (set by client-auth page)
 *   2. No `did` cookie → set `das` cookie with redirect URL, redirect to /auth/client-auth
 *   3. Client-auth page fetches DSCO dw-auth-token endpoints, sets `did` cookie, redirects back
 *   4. authenticate() reads `did`, looks up user in LEO_AUTH DynamoDB table, returns AuthenticatedUser
 *   5. hooks.server.ts encrypts user into `bu` cookie
 *   6. On every subsequent request, validateUser() checks timeouts, device fingerprint, IP
 */

import {
    ABSOLUTE_TIMEOUT_MS,
    CURRENT_SESSION_VERSION,
    FRESH_DATA_CHECK_INTERVAL_MS,
    IDLE_TIMEOUT_MS,
} from '$lib/server/dsco-auth-types.js';
import type { DscoAuthData, LeoAuthUser } from '$lib/server/dsco-auth-types.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import type { RequestEvent } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import crypto from 'crypto';
import https from 'https';
import {
    AuthProvider,
    ForceUserToReauthenticateError,
    NotAuthenticatedError,
} from '$lib/server/auth/types.js';
import type {
    AuthenticatedUser,
    AuthenticateResult,
    UserCognitoIdentity,
} from '$lib/server/auth/types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SecurityEventType =
    | 'migration_required'
    | 'session_timeout_idle'
    | 'session_timeout_absolute'
    | 'session_binding_failed'
    | 'suspicious_ip_change'
    | 'fresh_data_error'
    | 'auth_validation_failed';

// ---------------------------------------------------------------------------
// DscoAuthProvider
// ---------------------------------------------------------------------------

export default class DscoAuthProvider extends AuthProvider<DscoAuthData> {
    private ddbDocClient: DynamoDBDocument;

    constructor(stage: string) {
        super(stage);

        const ddbClient = new DynamoDBClient({
            region: process.env.AWS_REGION ?? 'us-east-1',
            maxAttempts: 5,
            requestHandler: new NodeHttpHandler({
                connectionTimeout: 2000,
                requestTimeout: 5000,
                httpsAgent: new https.Agent({ ciphers: 'ALL' }),
            }),
        });

        this.ddbDocClient = DynamoDBDocument.from(ddbClient, {
            marshallOptions: {
                convertEmptyValues: true,
                removeUndefinedValues: true,
            },
        });
    }

    // -----------------------------------------------------------------------
    // authenticate
    // -----------------------------------------------------------------------

    async authenticate(event: RequestEvent): Promise<AuthenticateResult<DscoAuthData>> {
        const dasCookieName = 'das';
        const didCookieName = 'did';

        const dasCookie = event.cookies.get(dasCookieName);
        const didCookie = event.cookies.get(didCookieName);

        console.log('[DSCO Auth] authenticate() called', {
            path: event.url.pathname,
            hasDas: !!dasCookie,
            hasDid: !!didCookie,
        });

        if (didCookie) {
            // Client-auth page completed — parse the identity and clean up flow cookies
            let token: string | undefined;
            let identityId: string | undefined;

            try {
                const parsed = JSON.parse(didCookie);
                if (parsed && typeof parsed === 'object' && 'token' in parsed && 'identityId' in parsed) {
                    token = parsed.token;
                    identityId = parsed.identityId;
                }
            } catch (e) {
                console.error('[DSCO Auth] Failed to parse did cookie:', e);
                return { redirectTo: redirect(302, '/signin') };
            }

            // Always remove the one-time-use cookies
            event.cookies.delete(didCookieName, { path: '/' });
            event.cookies.delete(dasCookieName, { path: '/' });

            if (!token || !identityId) {
                console.error('[DSCO Auth] did cookie missing token or identityId');
                return { redirectTo: redirect(302, '/signin') };
            }

            const dscoUser = await this.getDscoUserFromIdentityId(identityId);
            if (!dscoUser) {
                console.log('[DSCO Auth] User not found in LEO_AUTH table, identity:', identityId);
                return { redirectTo: redirect(302, '/signin') };
            }

            const authenticatedUser = this.createAuthenticatedUser(dscoUser, { token, identityId }, event);
            console.log('[DSCO Auth] Authentication successful for user:', authenticatedUser.userId);
            return { authenticatedUser };
        }

        // No did cookie — start / continue the client-auth flow
        if (!dasCookie) {
            // First time here: record where the user was trying to go
            const redirectUrl = event.url.pathname + event.url.search;
            event.cookies.set(dasCookieName, JSON.stringify({ redirectUrl }), {
                path: '/',
                secure: true,
                sameSite: 'lax',
                httpOnly: false, // Must be client-readable for the redirect
            });
            console.log('[DSCO Auth] Set das cookie, redirecting to client-auth. Return URL:', redirectUrl);
        } else {
            console.log('[DSCO Auth] das cookie already present, retrying client-auth');
        }

        return { redirectTo: redirect(302, '/auth/client-auth') };
    }

    // -----------------------------------------------------------------------
    // getUserCognitoIdentity
    // -----------------------------------------------------------------------

    async getUserCognitoIdentity(
        user: AuthenticatedUser<DscoAuthData>
    ): Promise<UserCognitoIdentity | undefined> {
        if (!user.authData?.identityId || !user.authData?.token) return undefined;
        return {
            cognitoIdentityId: user.authData.identityId,
            cognitoAccessToken: user.authData.token,
        };
    }

    // -----------------------------------------------------------------------
    // validateUser
    // -----------------------------------------------------------------------

    async validateUser(
        event: RequestEvent,
        user: AuthenticatedUser<DscoAuthData>
    ): Promise<AuthenticatedUser<DscoAuthData> | undefined> {
        if (!user.authData) {
            this.logSecurity('auth_validation_failed', 'error', 'User authData missing in validateUser', {}, user.userId);
            throw new ForceUserToReauthenticateError('No auth data found');
        }

        const now = Date.now();

        // 1. Session version migration
        if (!user.authData.sessionVersion || user.authData.sessionVersion !== CURRENT_SESSION_VERSION) {
            this.logSecurity('migration_required', 'info', 'Session migration required', {
                current: user.authData.sessionVersion ?? 'missing',
                required: CURRENT_SESSION_VERSION,
            }, user.userId);
            throw new ForceUserToReauthenticateError('Session migration required');
        }

        // 2. Absolute timeout
        const createdAt = new Date(user.authData.createdAt).getTime();
        if (now - createdAt > ABSOLUTE_TIMEOUT_MS) {
            this.logSecurity('session_timeout_absolute', 'info', 'Absolute session timeout exceeded', {
                ageMinutes: Math.floor((now - createdAt) / 60_000),
            }, user.userId);
            throw new ForceUserToReauthenticateError('Absolute session timeout exceeded');
        }

        // 3. Idle timeout
        const lastActivity = new Date(user.authData.lastActivity).getTime();
        if (now - lastActivity > IDLE_TIMEOUT_MS) {
            this.logSecurity('session_timeout_idle', 'info', 'Idle session timeout exceeded', {
                idleMinutes: Math.floor((now - lastActivity) / 60_000),
            }, user.userId);
            throw new ForceUserToReauthenticateError('Idle session timeout exceeded', { allowRetry: true });
        }

        // 4. Session binding (device fingerprint + IP)
        if (!this.validateSessionBinding(user, event)) {
            this.logSecurity('session_binding_failed', 'error', 'Session binding validation failed', {}, user.userId);
            throw new ForceUserToReauthenticateError('Session binding validation failed');
        }

        // 5. Periodic fresh data refresh from LEO_AUTH
        let updatedUser: AuthenticatedUser<DscoAuthData> = { ...user };
        let hasChanges = false;

        const lastFreshCheck = user.authData.lastFreshDataCheck
            ? new Date(user.authData.lastFreshDataCheck).getTime()
            : 0;

        if (now - lastFreshCheck > FRESH_DATA_CHECK_INTERVAL_MS) {
            try {
                const freshDscoUser = await this.getDscoUserFromIdentityId(user.authData.identityId);
                if (freshDscoUser) {
                    const { firstName, lastName } = this.parseUserData(freshDscoUser);
                    const finalFirst = firstName || user.firstName;
                    const finalLast = lastName || user.lastName;

                    if (user.firstName !== finalFirst || user.lastName !== finalLast) {
                        updatedUser = { ...updatedUser, firstName: finalFirst, lastName: finalLast };
                        hasChanges = true;
                    }
                }
            } catch (err) {
                this.logSecurity('fresh_data_error', 'error', 'Error during fresh data check', {
                    error: err instanceof Error ? err.message : String(err),
                }, user.userId);
            }

            updatedUser.authData = {
                ...updatedUser.authData,
                lastFreshDataCheck: new Date().toISOString(),
            } as DscoAuthData;
            hasChanges = true;
        }

        // 6. Always update activity timestamp and current IP
        updatedUser.authData = {
            ...updatedUser.authData,
            lastActivity: new Date().toISOString(),
            ipAddress: this.getClientIP(event),
        } as DscoAuthData;
        hasChanges = true;

        return hasChanges ? updatedUser : undefined;
    }

    // -----------------------------------------------------------------------
    // addValueToLocalsForRoute — pass DSCO endpoint URLs to client-auth page
    // -----------------------------------------------------------------------

    async addValueToLocalsForRoute(
        pathName: string,
        _event: RequestEvent,
        _user: AuthenticatedUser<DscoAuthData> | undefined
    ): Promise<Record<string, unknown> | undefined> {
        if (pathName === '/auth/client-auth') {
            const prefix = this.stage === 'prod' ? '' : `${this.stage}-`;
            const appPrefix = this.stage === 'prod' ? 'app' : this.stage;
            return {
                adminTokenUrl: `https://${prefix}core.dsco.io/tools/index/dw-auth-token`,
                tokenUrl: `https://${prefix}core.dsco.io/micro-service/dw-auth-token`,
                loginUrl: `https://${appPrefix}.dsco.io/tools`,
                adminLoginUrl: `https://${appPrefix}.dsco.io/tools`,
            };
        }
        return undefined;
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private async getDscoUserFromIdentityId(identityId: string): Promise<LeoAuthUser | undefined> {
        const tableName = process.env.LEO_AUTH_USER_TABLE_NAME;
        if (!tableName) {
            throw new Error('[DSCO Auth] LEO_AUTH_USER_TABLE_NAME env var is not set');
        }

        console.log(`[DSCO Auth] Looking up identity ${identityId} in table ${tableName}`);

        const result = await this.ddbDocClient.get({
            TableName: tableName,
            Key: { identity_id: identityId },
        });

        if (!result.Item) {
            throw new NotAuthenticatedError(`User not found in LEO_AUTH for identity ${identityId}`);
        }

        return result.Item as LeoAuthUser;
    }

    private parseUserData(dscoUser: LeoAuthUser): {
        userId: string;
        firstName: string | undefined;
        lastName: string | undefined;
        isInternal: boolean;
    } {
        let context = dscoUser.context;
        if (typeof context === 'string') {
            try { context = JSON.parse(context as unknown as string); } catch { /* keep as-is */ }
        }

        const isInternal = dscoUser.identities.includes('role/admin');

        let firstName: string | undefined = context.first_name || undefined;
        let lastName: string | undefined = context.last_name || undefined;

        // Fall back to splitting full_name if individual names are not present
        if (!firstName && !lastName && context.full_name) {
            const parts = context.full_name.trim().split(/\s+/);
            firstName = parts[0] || undefined;
            lastName = parts.slice(1).join(' ') || undefined;
        }

        return {
            userId: context.user_id.toString(),
            firstName,
            lastName,
            isInternal,
        };
    }

    private createAuthenticatedUser(
        dscoUser: LeoAuthUser,
        authTokens: { token: string; identityId: string },
        event: RequestEvent
    ): AuthenticatedUser<DscoAuthData> {
        const { userId, firstName, lastName, isInternal } = this.parseUserData(dscoUser);

        return {
            userId,
            firstName: firstName ?? '',
            lastName: lastName ?? '',
            userType: isInternal ? 'internal-user' : 'external-user',
            authData: {
                token: authTokens.token,
                identityId: authTokens.identityId,
                lastValidated: new Date().toISOString(),
                sessionId: crypto.randomUUID(),
                deviceFingerprint: this.generateDeviceFingerprint(event),
                ipAddress: this.getClientIP(event),
                sessionVersion: CURRENT_SESSION_VERSION,
                createdAt: new Date().toISOString(),
                lastActivity: new Date().toISOString(),
                lastFreshDataCheck: new Date().toISOString(),
            },
            customData: undefined,
            roles: [],
        };
    }

    private generateDeviceFingerprint(event: RequestEvent): string {
        const userAgent = event.request.headers.get('user-agent') ?? '';
        const acceptLanguage = event.request.headers.get('accept-language') ?? '';
        const acceptEncoding = event.request.headers.get('accept-encoding') ?? '';

        // Normalize User-Agent: strip patch version numbers to reduce churn from browser updates
        let stableUA = userAgent
            .replace(/Chrome\/(\d+\.\d+)\.\d+\.\d+/g, 'Chrome/$1')
            .replace(/Firefox\/(\d+\.\d+)\.\d+/g, 'Firefox/$1')
            .replace(/Safari\/(\d+)\.\d+\.\d+/g, 'Safari/$1')
            .replace(/Edg\/(\d+\.\d+)\.\d+\.\d+/g, 'Edg/$1');

        const input = [stableUA, acceptLanguage, acceptEncoding].filter(Boolean).join('|');
        return crypto.createHash('sha256').update(input).digest('hex');
    }

    private getClientIP(event: RequestEvent): string {
        const xff = event.request.headers.get('x-forwarded-for');
        if (xff) return xff.split(',')[0].trim();
        const xri = event.request.headers.get('x-real-ip');
        if (xri) return xri;
        return event.getClientAddress();
    }

    private isIPChangeReasonable(original: string, current: string): boolean {
        if (original === current) return true;
        try {
            const oParts = original.split('.');
            const cParts = current.split('.');
            if (oParts.length === 4 && cParts.length === 4) {
                // Same /24 subnet
                if (oParts.slice(0, 3).join('.') === cParts.slice(0, 3).join('.')) return true;
                // Same /16 subnet
                if (oParts.slice(0, 2).join('.') === cParts.slice(0, 2).join('.')) return true;
            }
        } catch { /* fall through */ }
        // Allow different subnets but log it
        console.warn('[DSCO Auth] IP change across subnets — allowing', { original, current });
        return true;
    }

    private validateSessionBinding(
        user: AuthenticatedUser<DscoAuthData>,
        event: RequestEvent
    ): boolean {
        if (!user.authData) return false;

        const currentFingerprint = this.generateDeviceFingerprint(event);
        const currentIP = this.getClientIP(event);

        if (user.authData.deviceFingerprint !== currentFingerprint) {
            this.logSecurity('session_binding_failed', 'error', 'Device fingerprint mismatch', {
                stored: user.authData.deviceFingerprint.slice(0, 16) + '...',
                current: currentFingerprint.slice(0, 16) + '...',
            }, user.userId);
            return false;
        }

        if (!this.isIPChangeReasonable(user.authData.ipAddress, currentIP)) {
            this.logSecurity('suspicious_ip_change', 'error', 'Unreasonable IP change', {
                original: user.authData.ipAddress,
                current: currentIP,
            }, user.userId);
            return false;
        }

        return true;
    }

    private logSecurity(
        eventType: SecurityEventType,
        severity: 'info' | 'warn' | 'error',
        message: string,
        context?: Record<string, unknown>,
        userId?: string
    ): void {
        const log = JSON.stringify({ eventType, severity, userId, message, context, timestamp: new Date().toISOString() });
        const msg = `[DSCO Auth Security] ${log}`;
        if (severity === 'error') console.error(msg);
        else if (severity === 'warn') console.warn(msg);
        else console.log(msg);
    }
}
