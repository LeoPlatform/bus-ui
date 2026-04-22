import { env } from '$env/dynamic/private';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createS3Client } from '$lib/server/aws_utils';
import type { AwsCreds } from '$lib/types';
import { queueSystemReplaceRegex } from '$lib/utils';

const LEO_S3 = () => env.LEO_S3 ?? process.env.LEO_S3 ?? '';

function queueSchemaKey(queueId: string): string {
    const normalized = queueId.replace(queueSystemReplaceRegex, '');
    return `files/bus_internal/queue_schemas/${normalized}.json`;
}

export async function getQueueSchema(creds: AwsCreds, queueId: string): Promise<Record<string, any> | null> {
    const s3 = createS3Client(creds);
    const bucket = LEO_S3();

    const result = await s3.send(new GetObjectCommand({
        Bucket: bucket,
        Key: queueSchemaKey(queueId),
    }));

    const body = await result.Body?.transformToString();
    if (!body) return null;
    return JSON.parse(body);
}

export async function saveQueueSchema(creds: AwsCreds, queueId: string, schema: Record<string, any>): Promise<void> {
    const s3 = createS3Client(creds);
    const bucket = LEO_S3();

    await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: queueSchemaKey(queueId),
        Body: JSON.stringify(schema, null, 2),
        ContentType: 'application/json',
    }));
}
