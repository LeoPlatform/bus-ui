/// <reference path="./.sst/platform/config.d.ts" />

/**
 * SST v3 deployment configuration for the Botmon SvelteKit webapp.
 *
 * Deploys as: Lambda (SSR) + CloudFront (CDN) + S3 (static assets).
 * Each stage gets its own CloudFormation stack (e.g., "alpha", "staging", "prod").
 *
 * Resources CREATED by this stack (mirrors old_ui/cloudformation/):
 *   - LeoStats DynamoDB table with auto-scaling (dynamodb.js)
 *   - Auto-scaling IAM role + targets + policies (dynamodb.js, roles.js)
 *   - Health check SNS topic (sns.js)
 *   - LeoBotmonRole — Lambda execution role with leosdk + LeoStats access (roles.js)
 *   - LeoBotmonSnsRole — Lambda role with leosdk + leoauth + SNS access (roles.js)
 *   - SvelteKit Lambda + CloudFront + S3 (new — replaces old ShowPages Lambda + API Gateway)
 *
 * External resource discovery:
 *   Leo Bus table names (LeoCron, LeoEvent, etc.) are fetched automatically from
 *   AWS Secrets Manager using the same naming convention as create-env.ts:
 *     Secret: rstreams-{Stage}{Bus}Bus  (e.g., rstreams-TestBus, rstreams-ProdChubBus)
 *   LEO_AUTH table name is fetched from SSM Parameter Store.
 *
 * AUTH_SECRET is auto-generated on first deploy and stored in SSM as a SecureString.
 *
 * Usage:
 *   npx sst deploy --stage alpha                  # defaults to bus=cup
 *   BUS=chub npx sst deploy --stage staging       # deploy for chub bus
 *   npx sst dev                                   # local dev with live Lambda
 *   npx sst remove --stage alpha                  # tear down stack
 *
 * No manual setup needed — just deploy.
 *
 * See webapp/DEPLOYMENT.md for full docs and CDK migration path.
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import {
  SSMClient,
  GetParameterCommand,
  PutParameterCommand,
  ParameterNotFound,
} from "@aws-sdk/client-ssm";
import { randomBytes } from "node:crypto";

// ---------------------------------------------------------------
// Resource discovery helpers (same logic as webapp/scripts/create-env.ts)
// ---------------------------------------------------------------

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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function busSuffix(bus: string): string {
  return bus === "cup" ? "" : capitalize(bus);
}

/**
 * Map (stage, bus) to the Secrets Manager secret name.
 * Convention: rstreams-{Stage}{Bus}Bus
 * Examples:
 *   (test, cup)    → rstreams-TestBus
 *   (prod, chub)   → rstreams-ProdChubBus
 *   (test, stream) → rstreams-TestStreamBus
 */
function secretName(stage: string, bus: string): string {
  return `rstreams-${capitalize(stage)}${busSuffix(bus)}Bus`;
}

async function fetchBusSecret(
  region: string,
  stage: string,
  bus: string,
): Promise<BusSecret> {
  const client = new SecretsManagerClient({ region });
  const name = secretName(stage, bus);
  console.log(`Fetching Bus config from secret: ${name}`);
  const result = await client.send(
    new GetSecretValueCommand({ SecretId: name }),
  );
  if (!result.SecretString) {
    throw new Error(`Secret ${name} has no string value`);
  }
  return JSON.parse(result.SecretString) as BusSecret;
}

async function fetchLeoAuthTableName(
  region: string,
  stage: string,
): Promise<string> {
  const client = new SSMClient({ region });
  const paramName = `/mcd/${stage}/rstreams/main_bus/leo_auth_user_table_name`;
  try {
    console.log(`Fetching LEO_AUTH_USER_TABLE_NAME from SSM: ${paramName}`);
    const result = await client.send(
      new GetParameterCommand({ Name: paramName }),
    );
    return result.Parameter?.Value ?? "";
  } catch (e: any) {
    console.warn(
      `⚠ Could not fetch LEO_AUTH_USER_TABLE_NAME from SSM: ${e.message}`,
    );
    return "";
  }
}

/**
 * Fetch or create the AUTH_SECRET for cookie encryption.
 * Stored in SSM Parameter Store as a SecureString at /botmon/{stage}/auth-secret.
 * On first deploy, a random 32-byte hex secret is generated and stored.
 * Subsequent deploys reuse the stored value so cookies remain valid.
 */
async function fetchOrCreateAuthSecret(
  region: string,
  stage: string,
): Promise<string> {
  const client = new SSMClient({ region });
  const paramName = `/botmon/${stage}/auth-secret`;

  try {
    const result = await client.send(
      new GetParameterCommand({ Name: paramName, WithDecryption: true }),
    );
    if (result.Parameter?.Value) {
      console.log(`AUTH_SECRET loaded from SSM: ${paramName}`);
      return result.Parameter.Value;
    }
  } catch (e: any) {
    if (e.name !== "ParameterNotFound") {
      console.warn(`⚠ Error reading AUTH_SECRET from SSM: ${e.message}`);
    }
  }

  // First deploy for this stage — generate and store a new secret
  const secret = randomBytes(32).toString("hex");
  console.log(`AUTH_SECRET not found — generating and storing in SSM: ${paramName}`);
  await client.send(
    new PutParameterCommand({
      Name: paramName,
      Value: secret,
      Type: "SecureString",
      Description: `Botmon AUTH_SECRET for stage ${stage} (auto-generated)`,
    }),
  );
  return secret;
}

// ---------------------------------------------------------------
// SST config
// ---------------------------------------------------------------

export default $config({
  app(input) {
    return {
      name: "botmon",
      removal: input?.stage === "prod" ? "retain" : "remove",
      protect: ["prod"].includes(input?.stage ?? ""),
      home: "aws",
      providers: {
        aws: {
          region: "us-east-1",
          // Use a specific profile per stage if needed:
          // profile: input?.stage === "prod" ? "prod" : "default",
        },
      },
    };
  },
  async run() {
    // ---------------------------------------------------------------
    // Resolve stage and bus from environment
    //
    // SST stage maps to the AWS environment (test, staging, prod).
    // BUS selects which Leo Bus to connect to (cup, chub, stream).
    // The stage→env mapping normalizes SST stage names to the env
    // names used in Secrets Manager and SSM.
    // ---------------------------------------------------------------

    const stage = $app.stage;
    const bus = process.env.BUS ?? "cup";

    // Map SST stage name to the environment name used in AWS resources.
    // "alpha", "dev", "test" all point to the "test" environment.
    // Add mappings here as new stages are created.
    const stageToEnv: Record<string, string> = {
      alpha: "test",
      dev: "test",
      test: "test",
      staging: "staging",
      prod: "prod",
    };
    const env = stageToEnv[stage] ?? stage;
    const region = "us-east-1";

    console.log(
      `Deploying stage=${stage} (env=${env}, bus=${bus}, region=${region})`,
    );

    // ---------------------------------------------------------------
    // Fetch external resource names from Secrets Manager + SSM
    // ---------------------------------------------------------------

    const [busConfig, leoAuthTableName, authSecret] = await Promise.all([
      fetchBusSecret(region, env, bus),
      fetchLeoAuthTableName(region, env),
      fetchOrCreateAuthSecret(region, stage),
    ]);

    console.log(`  LeoCron: ${busConfig.LeoCron}`);
    console.log(`  LeoEvent: ${busConfig.LeoEvent}`);
    console.log(`  LeoStream: ${busConfig.LeoStream}`);
    console.log(`  LeoSystem: ${busConfig.LeoSystem}`);
    console.log(`  LeoS3: ${busConfig.LeoS3}`);
    console.log(`  LEO_AUTH_USER_TABLE_NAME: ${leoAuthTableName || "(not found)"}`);

    // ---------------------------------------------------------------
    // LeoStats DynamoDB table (old_ui/cloudformation/dynamodb.js)
    // ---------------------------------------------------------------

    const leoStats = new sst.aws.Dynamo("LeoStats", {
      fields: {
        id: "string",
        bucket: "string",
        period: "string",
        time: "number",
      },
      primaryIndex: { hashKey: "id", rangeKey: "bucket" },
      globalIndexes: {
        "period-time-index": {
          hashKey: "period",
          rangeKey: "time",
          projection: ["current"],
        },
      },
      stream: "new-and-old-images",
      transform: {
        table: (args) => {
          args.billingMode = "PROVISIONED";
          args.readCapacity = 20;
          args.writeCapacity = 20;
        },
      },
    });

    // ---------------------------------------------------------------
    // Auto-scaling IAM role (old_ui/cloudformation/dynamodb.js + roles.js)
    // ---------------------------------------------------------------

    const autoScalingRole = new aws.iam.Role("AutoScalingRole", {
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: {
              Service: "application-autoscaling.amazonaws.com",
            },
            Action: "sts:AssumeRole",
          },
        ],
      }),
      inlinePolicies: [
        {
          name: "root",
          policy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Action: [
                  "dynamodb:DescribeTable",
                  "dynamodb:UpdateTable",
                  "cloudwatch:PutMetricAlarm",
                  "cloudwatch:DescribeAlarms",
                  "cloudwatch:GetMetricStatistics",
                  "cloudwatch:SetAlarmState",
                  "cloudwatch:DeleteAlarms",
                ],
                Resource: "*",
              },
            ],
          }),
        },
      ],
    });

    // ---------------------------------------------------------------
    // LeoStats auto-scaling targets + policies
    // Read: min 20, max 600, target 70% utilization
    // Write: min 20, max 60, target 70% utilization
    // ---------------------------------------------------------------

    const readTarget = new aws.appautoscaling.Target(
      "LeoStatsReadCapacityScalableTarget",
      {
        maxCapacity: 600,
        minCapacity: 20,
        resourceId: $interpolate`table/${leoStats.name}`,
        roleArn: autoScalingRole.arn,
        scalableDimension: "dynamodb:table:ReadCapacityUnits",
        serviceNamespace: "dynamodb",
      },
    );

    new aws.appautoscaling.Policy("LeoStatsReadAutoScalingPolicy", {
      policyType: "TargetTrackingScaling",
      resourceId: readTarget.resourceId,
      scalableDimension: readTarget.scalableDimension,
      serviceNamespace: readTarget.serviceNamespace,
      targetTrackingScalingPolicyConfiguration: {
        targetValue: 70,
        predefinedMetricSpecification: {
          predefinedMetricType: "DynamoDBReadCapacityUtilization",
        },
      },
    });

    const writeTarget = new aws.appautoscaling.Target(
      "LeoStatsWriteCapacityScalableTarget",
      {
        maxCapacity: 60,
        minCapacity: 20,
        resourceId: $interpolate`table/${leoStats.name}`,
        roleArn: autoScalingRole.arn,
        scalableDimension: "dynamodb:table:WriteCapacityUnits",
        serviceNamespace: "dynamodb",
      },
    );

    new aws.appautoscaling.Policy("LeoStatsWriteAutoScalingPolicy", {
      policyType: "TargetTrackingScaling",
      resourceId: writeTarget.resourceId,
      scalableDimension: writeTarget.scalableDimension,
      serviceNamespace: writeTarget.serviceNamespace,
      targetTrackingScalingPolicyConfiguration: {
        targetValue: 70,
        predefinedMetricSpecification: {
          predefinedMetricType: "DynamoDBWriteCapacityUtilization",
        },
      },
    });

    // ---------------------------------------------------------------
    // Health check SNS topic (old_ui/cloudformation/sns.js)
    // ---------------------------------------------------------------

    const healthCheckSns = new sst.aws.SnsTopic("HealthCheckSNS");

    // ---------------------------------------------------------------
    // IAM roles (old_ui/cloudformation/roles.js)
    // ---------------------------------------------------------------

    const leoBotmonRole = new aws.iam.Role("LeoBotmonRole", {
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: {
              Service: "lambda.amazonaws.com",
            },
            Action: "sts:AssumeRole",
          },
        ],
      }),
      managedPolicyArns: [
        "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
      ],
      inlinePolicies: [
        {
          name: "Leo_micro_logging_to_analytics",
          policy: $interpolate`${leoStats.arn}`.apply((arn) =>
            JSON.stringify({
              Version: "2012-10-17",
              Statement: [
                {
                  Effect: "Allow",
                  Action: [
                    "dynamodb:BatchGetItem",
                    "dynamodb:BatchWriteItem",
                    "dynamodb:UpdateItem",
                  ],
                  Resource: [arn],
                },
              ],
            }),
          ),
        },
      ],
    });

    const leoBotmonSnsRole = new aws.iam.Role("LeoBotmonSnsRole", {
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: {
              Service: "lambda.amazonaws.com",
            },
            Action: "sts:AssumeRole",
          },
        ],
      }),
      managedPolicyArns: [
        "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
      ],
      inlinePolicies: [
        {
          name: "Leo_Sns",
          policy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Action: [
                  "sns:ListTopics",
                  "sns:ListSubscriptionsByTopic",
                  "sns:GetTopicAttributes",
                  "sns:CreateTopic",
                  "sns:Subscribe",
                  "sns:Unsubscribe",
                ],
                Resource: "*",
              },
            ],
          }),
        },
      ],
    });

    // ---------------------------------------------------------------
    // Environment for the SvelteKit server Lambda
    // ---------------------------------------------------------------

    const environment: Record<string, string> = {
      // Auth (auto-generated on first deploy, stored in SSM as SecureString)
      AUTH_SECRET: authSecret,
      AUTH_CONFIG_SOURCE: process.env.AUTH_CONFIG_SOURCE ?? "./providers.config.json",
      LOCAL: "false",
      STAGE: env,
      DEBUG_AUTH: process.env.DEBUG_AUTH ?? "false",

      // Owned resource — table name from the resource we created
      LEO_STATS_TABLE: leoStats.name,

      // External tables — fetched from Secrets Manager
      LEO_CRON_TABLE: busConfig.LeoCron,
      LEO_EVENT_TABLE: busConfig.LeoEvent,
      LEO_STREAM_TABLE: busConfig.LeoStream,
      LEO_SYSTEM_TABLE: busConfig.LeoSystem,
      LEO_S3: busConfig.LeoS3,

      // DSCO auth — fetched from SSM
      LEO_AUTH_USER_TABLE_NAME: leoAuthTableName,

      // AWS
      AWS_REGION: busConfig.Region || region,

      // SNS
      HEALTH_CHECK_SNS_TOPIC_ARN: healthCheckSns.arn,

      // Performance timing (0 = off, 1 = on)
      PERF_TIMING: process.env.PERF_TIMING ?? "0",
    };

    // ---------------------------------------------------------------
    // SvelteKit webapp
    // ---------------------------------------------------------------

    const site = new sst.aws.SvelteKit("BotmonWeb", {
      path: "webapp/",
      link: [leoStats],
      environment,
      // Uncomment when a custom domain is ready:
      // domain: {
      //   name: `botmon-${stage}.your-domain.com`,
      //   redirects: [`www.botmon-${stage}.your-domain.com`],
      // },
      server: {
        memory: "1024 MB",
        architecture: "arm64",
        timeout: "30 seconds",
      },
    });

    return {
      url: site.url,
      stage,
      env,
      bus,
      leoStatsTable: leoStats.name,
      healthCheckSnsTopic: healthCheckSns.arn,
      leoBotmonRoleArn: leoBotmonRole.arn,
      leoBotmonSnsRoleArn: leoBotmonSnsRole.arn,
    };
  },
});
