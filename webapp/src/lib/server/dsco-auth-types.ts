/**
 * DSCO-specific auth types for bus-ui.
 * Mirrors the relevant subset of ai-bot's custom-shared-types.ts.
 */

export interface DscoAuthData extends Record<string, unknown> {
    token: string;
    identityId: string;
    /** ISO timestamp of last server-side validation */
    lastValidated: string;
    /** Unique session ID generated at login */
    sessionId: string;
    /** SHA-256 fingerprint of the browser's stable request headers */
    deviceFingerprint: string;
    /** Client IP at session creation (updated on every request) */
    ipAddress: string;
    /** Incremented when session data format changes — triggers migration */
    sessionVersion: string;
    /** ISO timestamp when the session was created */
    createdAt: string;
    /** ISO timestamp of the last authenticated request */
    lastActivity: string;
    /** ISO timestamp of last LEO_AUTH table refresh (optional) */
    lastFreshDataCheck?: string;
}

export interface LeoAuthUser {
    identity_id: string;
    context: {
        user_id: number | string;
        retailer_ids?: number[];
        supplier_ids?: number[];
        account_id?: number;
        full_name?: string;
        email?: string;
        first_name?: string;
        last_name?: string;
    };
    identities: string[];
}

// ---------------------------------------------------------------------------
// Session timeouts
// ---------------------------------------------------------------------------

/** Idle timeout: force re-auth if no activity for 2 hours */
export const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;

/** Absolute timeout: force re-auth after 4 hours regardless of activity */
export const ABSOLUTE_TIMEOUT_MS = 4 * 60 * 60 * 1000;

/** Refresh interval for LEO_AUTH data: every 10 minutes */
export const FRESH_DATA_CHECK_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Current session version.
 * Increment when making breaking changes to DscoAuthData structure.
 */
export const CURRENT_SESSION_VERSION = '1';
