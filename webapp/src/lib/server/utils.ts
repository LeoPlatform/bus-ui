import { env } from '$env/dynamic/private';
import { getAwsCredentials as cognitoGetAwsCredentials } from './cognito.js';

export function getLeoCronTable(): string {
    const result = env.LEO_CRON_TABLE ?? process.env.LEO_CRON_TABLE;
    if (!result) {
        throw new Error('process.env.LEO_CRON_TABLE is not set');
    }
    return result;
}

/**
 * Resolve the authenticated user and AWS credentials for server-side API calls.
 *
 * Resolution order for AWS credentials:
 *  1. provider.getAwsCredentials(user) — DSCO flow (exchanges Cognito identity for STS creds)
 *  2. provider.getUserCognitoIdentity(user) → cognito.getAwsCredentials() — generic Cognito flow
 *  3. Session aws_credentials — OAuth local dev flow (env-var creds passed through session)
 *  4. Returns 401 if none of the above succeed
 */
export async function getSession(locals: App.Locals) {
    const user = locals.user;
    const provider = locals.authProvider;

    if (!user || !provider) {
        console.error('[getSession] Missing user or provider', {
            hasUser: !!user,
            hasProvider: !!provider,
        });
        return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
    }

    // 1. Provider has a direct getAwsCredentials() method (e.g. DefaultAuthProvider, OAuthAuthProvider)
    if (provider.getAwsCredentials) {
        const creds = await provider.getAwsCredentials(user);
        if (creds) {
            return { user, aws_credentials: creds };
        }
    }

    // 2. Provider has getUserCognitoIdentity() — use Cognito GetCredentialsForIdentity
    if (provider.getUserCognitoIdentity) {
        try {
            const identity = await provider.getUserCognitoIdentity(user);
            if (identity) {
                const raw = await cognitoGetAwsCredentials(identity);
                const creds = {
                    accessKeyId: raw.accessKeyId,
                    secretAccessKey: raw.secretKey,
                    sessionToken: raw.sessionToken,
                    expiration: new Date(raw.expiration),
                };
                return { user, aws_credentials: creds };
            }
        } catch (err) {
            console.error('[getSession] Cognito credential exchange failed:', err);
        }
    }

    // 3. OAuth session path — aws_credentials attached by auth.ts callback
    const session = typeof locals.auth === 'function' ? await locals.auth() : null;
    if (session?.aws_credentials) {
        return { user, aws_credentials: session.aws_credentials };
    }

    console.error('[getSession] No AWS credentials available for user', user.userId);
    return new Response(JSON.stringify({ error: 'no AWS credentials' }), { status: 401 });
}
