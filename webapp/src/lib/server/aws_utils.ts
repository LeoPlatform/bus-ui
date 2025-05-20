import { AWS_REGION } from '$env/static/private';
import type {AwsCreds} from '$lib/types';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';


export function createAwsClient<T>(ClientClass: new (config: any) => T, creds: AwsCreds): T {
    // const session = page.data.session;

    // if (!session?.aws_credentials) {
    //     console.error('No AWS credentials available in session');
    //     return null;
    // }

    return new ClientClass({
        region: AWS_REGION,
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