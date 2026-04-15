import { fromIni } from "@aws-sdk/credential-provider-ini";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { CloudFormationClient, DescribeStackResourceCommand } from "@aws-sdk/client-cloudformation";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { execSync } from "child_process";
import { writeFileSync, existsSync, readFileSync } from "fs";
import yargs from "yargs";

/**
 * Generates `.env.local` by fetching Leo Bus resource names from AWS Secrets Manager
 * and the LeoStats table name from the Botmon CloudFormation stack.
 *
 * This replaces the old approach of reading from `leo.config.json` (a hardcoded
 * multi-environment config file checked into the repo).
 *
 * Secret naming convention:  rstreams-{Env}{BusSuffix}Bus
 * Stack naming convention:   {Env}{BusSuffix}Botmon
 *
 * Examples:
 *   --env staging --bus cup    → secret: rstreams-StagingBus,    stack: StagingBotmon
 *   --env prod    --bus chub   → secret: rstreams-ProdChubBus,   stack: ProdChubBotmon
 *   --env test    --bus stream → secret: rstreams-TestStreamBus, stack: TestStreamBotmon
 */

interface BusSecret {
    LeoStream: string;
    LeoCron: string;
    LeoSettings: string;
    LeoEvent: string;
    LeoSystem: string;
    LeoS3: string;
    LeoKinesisStream: string;
    LeoFirehoseStream: string;
    Region: string;
}

const REGION = "us-east-1";

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Map (env, bus) → the suffix used in AWS resource names. "cup" is the default bus (no suffix). */
function busSuffix(bus: string): string {
    return bus === "cup" ? "" : capitalize(bus);
}

function secretName(env: string, bus: string): string {
    return `rstreams-${capitalize(env)}${busSuffix(bus)}Bus`;
}

function botmonStackName(env: string, bus: string): string {
    return `${capitalize(env)}${busSuffix(bus)}Botmon`;
}

async function fetchBusSecret(client: SecretsManagerClient, name: string): Promise<BusSecret> {
    const result = await client.send(new GetSecretValueCommand({ SecretId: name }));
    if (!result.SecretString) {
        throw new Error(`Secret ${name} has no string value`);
    }
    return JSON.parse(result.SecretString) as BusSecret;
}

async function fetchLeoStats(client: CloudFormationClient, stackName: string): Promise<string> {
    try {
        const result = await client.send(
            new DescribeStackResourceCommand({
                StackName: stackName,
                LogicalResourceId: "LeoStats",
            }),
        );
        return result.StackResourceDetail?.PhysicalResourceId ?? "";
    } catch (e: any) {
        console.warn(`⚠ Could not fetch LeoStats from stack ${stackName}: ${e.message}`);
        return "";
    }
}

async function fetchLeoAuthUserTableName(ssmClient: SSMClient, env: string): Promise<string> {
    const paramName = `/mcd/${env}/rstreams/main_bus/leo_auth_user_table_name`;
    try {
        const result = await ssmClient.send(new GetParameterCommand({ Name: paramName }));
        return result.Parameter?.Value ?? "";
    } catch (e: any) {
        console.warn(`⚠ Could not fetch LEO_AUTH_USER_TABLE_NAME from SSM (${paramName}): ${e.message}`);
        return "";
    }
}

function readExistingEnvFile(path: string): Record<string, string> {
    const map: Record<string, string> = {};
    if (existsSync(path)) {
        const data = readFileSync(path, { encoding: "utf-8" });
        if (data && data.trim().length > 0) {
            for (const line of data.split("\n")) {
                if (line.trim().length === 0) continue;
                const idx = line.indexOf("=");
                if (idx === -1) {
                    throw new Error(`Did not find = sign in line: ${line}`);
                }
                map[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
            }
        }
    }
    return map;
}

async function main(): Promise<void> {
    const argv = yargs(process.argv.slice(2))
        .options({
            configLocation: {
                type: "string",
                demandOption: false,
                describe: "Path to the auth providers config file",
            },
            env: {
                type: "string",
                demandOption: false,
                describe: "Target environment",
                choices: ["test", "staging", "prod"] as const,
                default: "test" as const,
            },
            bus: {
                type: "string",
                demandOption: false,
                describe: "Target bus",
                choices: ["cup", "chub", "stream"] as const,
                default: "cup" as const,
            },
            auth: {
                type: "boolean",
                demandOption: false,
                describe: "Enable DSCO auth (disables LOCAL mode, fetches LEO_AUTH table name from SSM)",
                default: false,
            },
        })
        .help()
        .parseSync();

    const envPath = "./.env.local";
    const existing = readExistingEnvFile(envPath);

    if (!argv.configLocation && !existing["AUTH_CONFIG_SOURCE"]) {
        throw new Error(
            "No auth config location provided in args (--configLocation) or existing .env.local",
        );
    }

    // --- AWS credentials (from default profile, same as before) ---
    const creds = await fromIni({ profile: "default" })();
    if (!creds.sessionToken) {
        throw new Error("No session token — STS credentials are required for local dev");
    }

    const awsConfig = { region: REGION, credentials: creds };

    // --- Fetch Bus resources from Secrets Manager ---
    const secret = secretName(argv.env, argv.bus);
    console.log(`Fetching Bus config from secret: ${secret}`);
    const smClient = new SecretsManagerClient(awsConfig);
    const busConfig = await fetchBusSecret(smClient, secret);

    // --- Fetch LeoStats from Botmon CloudFormation stack ---
    const stack = botmonStackName(argv.env, argv.bus);
    console.log(`Fetching LeoStats from stack: ${stack}`);
    const cfnClient = new CloudFormationClient(awsConfig);
    const leoStats = await fetchLeoStats(cfnClient, stack);
    if (leoStats) {
        console.log(`  LeoStats: ${leoStats}`);
    }

    // --- Fetch LEO_AUTH table name from SSM (only when --auth is set) ---
    let leoAuthUserTable = "";
    if (argv.auth) {
        console.log(`Fetching LEO_AUTH_USER_TABLE_NAME from SSM for stage: ${argv.env}`);
        const ssmClient = new SSMClient(awsConfig);
        leoAuthUserTable = await fetchLeoAuthUserTableName(ssmClient, argv.env);
        if (leoAuthUserTable) {
            console.log(`  LEO_AUTH_USER_TABLE_NAME: ${leoAuthUserTable}`);
        } else {
            console.warn(`⚠ Could not find LEO_AUTH_USER_TABLE_NAME — set it manually in .env.local`);
        }
    }

    // --- Generate AUTH_SECRET if not already present ---
    let authSecret = existing["AUTH_SECRET"] ?? "";
    if (!authSecret) {
        try {
            authSecret = execSync("npx auth secret --raw", { encoding: "utf-8" }).trimEnd();
        } catch (error) {
            console.error("Error generating auth secret:", error);
        }
    }

    // --- Build .env.local ---
    const useAuth = argv.auth;

    const envProps: Record<string, string | boolean> = {
        AWS_ACCESS_KEY_ID: creds.accessKeyId,
        AWS_SECRET_ACCESS_KEY: creds.secretAccessKey,
        AWS_SESSION_TOKEN: creds.sessionToken,
        AWS_REGION: busConfig.Region || REGION,
        ENVIRONMENT: argv.env,

        // Leo Bus resources (from Secrets Manager)
        LEO_CRON_TABLE: busConfig.LeoCron,
        LEO_EVENT_TABLE: busConfig.LeoEvent,
        LEO_STREAM_TABLE: busConfig.LeoStream,
        LEO_SYSTEM_TABLE: busConfig.LeoSystem,
        LEO_S3: busConfig.LeoS3,

        // Botmon resource (from CloudFormation)
        ...(leoStats ? { LEO_STATS_TABLE: leoStats } : {}),

        // Auth mode: --auth enables DSCO auth, otherwise local mock
        LOCAL: !useAuth,
        ...(useAuth ? { STAGE: argv.env } : {}),
        ...(useAuth && leoAuthUserTable ? { LEO_AUTH_USER_TABLE_NAME: leoAuthUserTable } : {}),

        // App settings
        AUTH_CONFIG_SOURCE:
            argv.configLocation ?? existing["AUTH_CONFIG_SOURCE"] ?? "./providers.config.json",
        AUTH_SECRET: authSecret,
        DEBUG_AUTH: false,

        // Performance timing (set to 1 to enable server-side [perf] logs)
        PERF_TIMING: existing["PERF_TIMING"] ?? "0",
    };

    const lines = Object.entries(envProps).map(([key, val]) => `${key}=${val}`);
    writeFileSync(envPath, lines.join("\n") + "\n");
    const mode = useAuth ? "DSCO auth" : "local mock (LOCAL=true)";
    console.log(`\n✔ Wrote ${envPath} (${argv.env}/${argv.bus}, ${mode})`);
}

(async () => {
    try {
        await main();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
