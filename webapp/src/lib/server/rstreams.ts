/**
 * Creates an RStreams leo-stream instance configured from the webapp's environment
 * variables and the requesting user's AWS credentials.
 *
 * We import the internal stream factory and configuration modules directly rather
 * than the top-level `leo-sdk` default export.  The default export runs
 * `new SDK(false)` at require-time, which triggers the ConfigProviderChain and
 * fails when the repo's `leo.config.json` (multi-profile, no default) is found
 * but can't resolve to a single valid config.
 *
 * Resources required in env:
 *   LEO_STREAM_TABLE   — DynamoDB table with event data (hash: event, range: end)
 *   LEO_EVENT_TABLE    — DynamoDB table with queue metadata (hash: event)
 *   LEO_CRON_TABLE     — DynamoDB table with bot/cron definitions
 *   LEO_S3             — S3 bucket for event payload storage
 *
 * Optional:
 *   LEO_SYSTEM_TABLE   — (maps to LeoSettings)
 *   AWS_REGION          — (defaults to us-east-1)
 *
 * Note on naming: The SDK's `fromLeo` uses TWO DynamoDB tables:
 *   1. `resources.LeoEvent` — queue metadata (hash: event).  CF name: LeoEvent.
 *   2. `resources.LeoStream` — event data (hash: event, range: end).  CF name: LeoStream.
 *
 * Both must be configured correctly for `fromLeo` to work.
 *
 *   SDK resource     | CF resource   | Env var
 *   ─────────────────|───────────────|──────────────────
 *   LeoEvent         | LeoEvent      | LEO_EVENT_TABLE
 *   LeoStream        | LeoStream     | LEO_STREAM_TABLE
 */
import { env } from '$env/dynamic/private';
import type { AwsCreds } from '$lib/types';
import { createRequire } from 'node:module';

// Use createRequire to load CJS modules that can't be statically imported
// without triggering the default-instance side effect.
const require = createRequire(import.meta.url);

export interface RStreamsConfig {
    region: string;
    /** The event stream table (hash+range) — SDK calls this LeoEvent, CF calls it LeoStream */
    leoStream: string;
    /** The queue metadata table (hash only) — CF calls this LeoEvent */
    leoEvent: string;
    leoCron: string;
    leoS3: string;
    leoSettings: string;
}

/** Read Leo resource names from environment, throwing if required ones are missing. */
export function getRStreamsEnv(): RStreamsConfig {
    const region = env.AWS_REGION ?? process.env.AWS_REGION ?? 'us-east-1';
    const leoStream = env.LEO_STREAM_TABLE ?? process.env.LEO_STREAM_TABLE ?? '';
    const leoEvent = env.LEO_EVENT_TABLE ?? process.env.LEO_EVENT_TABLE ?? '';
    const leoCron = env.LEO_CRON_TABLE ?? process.env.LEO_CRON_TABLE ?? '';
    const leoS3 = env.LEO_S3 ?? process.env.LEO_S3 ?? '';
    const leoSettings = env.LEO_SYSTEM_TABLE ?? process.env.LEO_SYSTEM_TABLE ?? '';

    if (!leoStream || !leoCron || !leoS3) {
        throw new Error(
            'Missing required Leo resource env vars: LEO_STREAM_TABLE, LEO_CRON_TABLE, LEO_S3',
        );
    }

    return { region, leoStream, leoEvent, leoCron, leoS3, leoSettings };
}

/**
 * Build a LeoConfiguration object and the leo-stream factory for reading events.
 *
 * Returns `{ streams }` where `streams.fromLeo(botId, queue, opts)` creates a
 * readable Node.js stream of events from the given queue.
 */
export function createLeoStreams(creds: AwsCreds, rstreamsEnv?: RStreamsConfig) {
    const cfg = rstreamsEnv ?? getRStreamsEnv();

    // Import the configuration class and stream factory directly.
    // This avoids the default SDK instance creation that fails with
    // the multi-profile leo.config.json.
    const LeoConfiguration = require('leo-sdk/lib/configuration.js');
    const leoStreamFactory = require('leo-sdk/lib/stream/leo-stream.js');

    // The SDK's `fromLeo` uses both LeoEvent (queue metadata, hash-only) and
    // LeoStream (event data, hash+range).  Map them to the correct CF tables.
    const configuration = new LeoConfiguration({
        region: cfg.region,
        aws: { region: cfg.region },
        resources: {
            Region: cfg.region,
            LeoEvent: cfg.leoEvent,  // queue metadata (hash: event)
            LeoStream: cfg.leoStream, // event data (hash: event, range: end)
            LeoCron: cfg.leoCron,
            LeoS3: cfg.leoS3,
            LeoSettings: cfg.leoSettings || cfg.leoEvent,
            LeoKinesisStream: 'unused-for-reads',
            LeoFirehoseStream: 'unused-for-reads',
        },
        kinesis: 'unused-for-reads',
        firehose: 'unused-for-reads',
        s3: cfg.leoS3,
        credentials: {
            accessKeyId: creds.accessKeyId,
            secretAccessKey: creds.secretAccessKey,
            sessionToken: creds.sessionToken,
        },
    });

    // leoStreamFactory(configuration) returns the streams object with
    // fromLeo, toLeo, pipe, write, etc.
    const streams = leoStreamFactory(configuration);

    return { streams, configuration };
}
