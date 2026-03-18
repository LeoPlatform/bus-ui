import type {AwsCreds} from '$lib/types';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { env } from '$env/dynamic/private';

const AWS_REGION = () => env.AWS_REGION ?? process.env.AWS_REGION ?? 'us-east-1';

export function createAwsClient<T>(ClientClass: new (config: any) => T, creds: AwsCreds): T {
    return new ClientClass({
        region: AWS_REGION(),
        credentials: {
            accessKeyId: creds.accessKeyId,
            secretAccessKey: creds.secretAccessKey,
            sessionToken: creds.sessionToken
        }
    });
}

export function createDynamoClient(creds: AwsCreds): DynamoDBClient {
    return createAwsClient(DynamoDBClient, creds);
}

// export function createS3Client(creds: AwsCreds): S3Client {
//     return createAwsClient(S3Client, creds);
// }