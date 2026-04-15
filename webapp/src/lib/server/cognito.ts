/**
 * Mint AWS credentials from a Cognito Identity.
 * Used by getSession() and /api/aws-creds when the DSCO auth provider
 * returns a Cognito identity (identityId + openId token).
 */

import { CognitoIdentityClient, GetCredentialsForIdentityCommand } from '@aws-sdk/client-cognito-identity';
import type { UserCognitoIdentity, UserAwsCredentials } from './auth/types.js';

let client: CognitoIdentityClient | undefined;

function getClient(): CognitoIdentityClient {
    if (!client) {
        client = new CognitoIdentityClient({
            region: process.env.AWS_REGION ?? 'us-east-1',
        });
    }
    return client;
}

export async function getAwsCredentials(identity: UserCognitoIdentity): Promise<UserAwsCredentials> {
    const command = new GetCredentialsForIdentityCommand({
        IdentityId: identity.cognitoIdentityId,
        Logins: {
            'cognito-identity.amazonaws.com': identity.cognitoAccessToken,
        },
    });

    const response = await getClient().send(command);
    const c = response.Credentials;

    if (!c?.AccessKeyId || !c?.SecretKey || !c?.SessionToken || !c?.Expiration) {
        throw new Error('[Cognito] GetCredentialsForIdentity returned incomplete credentials');
    }

    return {
        accessKeyId: c.AccessKeyId,
        secretKey: c.SecretKey,
        sessionToken: c.SessionToken,
        expiration: c.Expiration.toISOString(),
    };
}
