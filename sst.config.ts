/// <reference path="./.sst/platform/config.d.ts" />

/**
 * SST v3 deployment configuration for the Botmon SvelteKit webapp.
 *
 * Deploys as: Lambda (SSR) + CloudFront (CDN) + S3 (static assets).
 *
 * Stage naming convention: {env}-{bus}
 *   Matches the create-env npm scripts (e.g., create-env-test-cup).
 *   Valid envs: test, staging, prod
 *   Valid buses: cup, chub, stream
 *
 * Resources CREATED by this stack (mirrors old_ui/cloudformation/):
 *   - LeoStats DynamoDB table with auto-scaling
 *   - Auto-scaling IAM role + targets + policies
 *   - Health check SNS topic
 *   - LeoBotmonRole, LeoBotmonSnsRole IAM roles
 *   - SvelteKit Lambda + CloudFront + S3
 *
 * External resource discovery (automatic):
 *   - Leo Bus tables: Secrets Manager (rstreams-{Env}{Bus}Bus)
 *   - LEO_AUTH table: SSM Parameter Store
 *   - AUTH_SECRET: SSM SecureString (auto-generated on first deploy)
 *
 * Usage:
 *   npx sst deploy --stage test-cup        # test environment, cup bus
 *   npx sst deploy --stage staging-chub    # staging environment, chub bus
 *   npx sst deploy --stage prod-stream     # production, stream bus
 *   npx sst dev --stage test-cup           # local dev with live Lambda
 *   npx sst remove --stage test-cup        # tear down stack
 *
 * No manual setup needed — just deploy.
 *
 * See webapp/DEPLOYMENT.md for full docs and CDK migration path.
 */

// ---------------------------------------------------------------
// Stage parsing
// ---------------------------------------------------------------

const VALID_ENVS = ["test", "staging", "prod"] as const;
const VALID_BUSES = ["cup", "chub", "stream"] as const;

type Env = (typeof VALID_ENVS)[number];
type Bus = (typeof VALID_BUSES)[number];

function parseStage(stage: string): { env: Env; bus: Bus } {
  const parts = stage.split("-");
  if (parts.length !== 2) {
    throw new Error(
      `Invalid stage "${stage}". Expected format: {env}-{bus} (e.g., test-cup, staging-chub, prod-stream).\n` +
        `  Valid envs: ${VALID_ENVS.join(", ")}\n` +
        `  Valid buses: ${VALID_BUSES.join(", ")}`,
    );
  }
  const [env, bus] = parts;
  if (!VALID_ENVS.includes(env as Env)) {
    throw new Error(
      `Invalid environment "${env}" in stage "${stage}". Valid envs: ${VALID_ENVS.join(", ")}`,
    );
  }
  if (!VALID_BUSES.includes(bus as Bus)) {
    throw new Error(
      `Invalid bus "${bus}" in stage "${stage}". Valid buses: ${VALID_BUSES.join(", ")}`,
    );
  }
  return { env: env as Env, bus: bus as Bus };
}

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
 * Map (env, bus) to the Secrets Manager secret name.
 * Convention: rstreams-{Env}{Bus}Bus
 * Examples:
 *   (test, cup)    → rstreams-TestBus
 *   (prod, chub)   → rstreams-ProdChubBus
 *   (test, stream) → rstreams-TestStreamBus
 */
function secretName(env: string, bus: string): string {
  return `rstreams-${capitalize(env)}${busSuffix(bus)}Bus`;
}

async function fetchBusSecret(
  region: string,
  env: string,
  bus: string,
): Promise<BusSecret> {
  const { SecretsManagerClient, GetSecretValueCommand } = await import(
    "@aws-sdk/client-secrets-manager"
  );
  const client = new SecretsManagerClient({ region });
  const name = secretName(env, bus);
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
  env: string,
): Promise<string> {
  const { SSMClient, GetParameterCommand } = await import(
    "@aws-sdk/client-ssm"
  );
  const client = new SSMClient({ region });
  const paramName = `/mcd/${env}/rstreams/main_bus/leo_auth_user_table_name`;
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
  const { SSMClient, GetParameterCommand, PutParameterCommand } = await import(
    "@aws-sdk/client-ssm"
  );
  const { randomBytes } = await import("node:crypto");
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

/**
 * Fetch the CloudFront URL for this stage from SSM.
 * On the first deploy it won't exist — return empty string (assets use
 * relative paths, which won't work behind API GW but that's OK for
 * bootstrap). After deploy, storeCloudfrontUrl() saves it so the next
 * deploy bakes the absolute CDN URL into the build.
 */
async function fetchCloudfrontUrl(
  region: string,
  stage: string,
): Promise<string> {
  const { SSMClient, GetParameterCommand } = await import(
    "@aws-sdk/client-ssm"
  );
  const client = new SSMClient({ region });
  const paramName = `/botmon/${stage}/cloudfront-url`;
  try {
    const result = await client.send(
      new GetParameterCommand({ Name: paramName }),
    );
    const url = result.Parameter?.Value ?? "";
    if (url) console.log(`CloudFront URL loaded from SSM: ${url}`);
    return url;
  } catch {
    console.log(`CloudFront URL not yet stored in SSM (first deploy for ${stage})`);
    return "";
  }
}

async function storeCloudfrontUrl(
  region: string,
  stage: string,
  url: string,
): Promise<void> {
  const { SSMClient, PutParameterCommand } = await import(
    "@aws-sdk/client-ssm"
  );
  const client = new SSMClient({ region });
  await client.send(
    new PutParameterCommand({
      Name: `/botmon/${stage}/cloudfront-url`,
      Value: url,
      Type: "String",
      Overwrite: true,
      Description: `Botmon CloudFront URL for stage ${stage}`,
    }),
  );
}

// ---------------------------------------------------------------
// SST config
// ---------------------------------------------------------------

export default $config({
  app(input) {
    return {
      name: "botmon",
      removal: input?.stage?.startsWith("prod") ? "retain" : "remove",
      protect: input?.stage?.startsWith("prod") ?? false,
      home: "aws",
      providers: {
        aws: {
          region: "us-east-1",
          // Use a specific profile per stage if needed:
          // profile: input?.stage?.startsWith("prod") ? "prod" : "default",
        },
      },
    };
  },
  async run() {
    // ---------------------------------------------------------------
    // Parse stage into env + bus
    //
    // Stage format: {env}-{bus}  (e.g., test-cup, staging-chub, prod-stream)
    // Matches the create-env npm scripts in package.json.
    // ---------------------------------------------------------------

    const stage = $app.stage;
    const { env, bus } = parseStage(stage);
    const region = "us-east-1";

    console.log(`Deploying stage=${stage} (env=${env}, bus=${bus}, region=${region})`);

    // ---------------------------------------------------------------
    // Fetch external resource names from Secrets Manager + SSM
    // ---------------------------------------------------------------

    const [busConfig, leoAuthTableName, authSecret, cloudfrontUrl] = await Promise.all([
      fetchBusSecret(region, env, bus),
      fetchLeoAuthTableName(region, env),
      fetchOrCreateAuthSecret(region, stage),
      fetchCloudfrontUrl(region, stage),
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
          // GSI also needs provisioned throughput when billing mode is PROVISIONED
          if (args.globalSecondaryIndexes) {
            args.globalSecondaryIndexes = $resolve(args.globalSecondaryIndexes).apply(
              (indexes: any[]) =>
                indexes.map((idx: any) => ({
                  ...idx,
                  readCapacity: 20,
                  writeCapacity: 20,
                })),
            );
          }
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
    // API Gateway mapping on test-apps.dsco.io
    //
    // The existing DSCO custom domain at {env}-apps.dsco.io uses API
    // Gateway API mappings to route paths to different services (e.g.,
    // /botmon → old UI, /botmonchub → old UI chub bus, etc.).
    //
    // We add a mapping for /botmonAlpha → our SvelteKit Lambda so the
    // app is accessible at test-apps.dsco.io/botmonAlpha. This puts us
    // on the dsco.io domain, which means DSCO auth cookies work and
    // there are no CORS issues with dw-auth-token endpoints.
    // ---------------------------------------------------------------

    const apiMappingKey = "botmonAlpha";
    const appsCustomDomain = `${env}-apps.dsco.io`;

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

      // AWS_REGION is set automatically by Lambda — do not set it explicitly.
      // The app reads it from process.env.AWS_REGION which Lambda provides.

      // SNS
      HEALTH_CHECK_SNS_TOPIC_ARN: healthCheckSns.arn,

      // Performance timing (0 = off, 1 = on)
      PERF_TIMING: process.env.PERF_TIMING ?? "0",

      // SvelteKit base path — used for generating URLs (links, navigation).
      // The HTTP_PROXY integration restores the stripped prefix via
      // requestParameters, so SvelteKit receives the full path.
      SVELTE_BASE_PATH: `/${apiMappingKey}`,

      // Assets URL — absolute CloudFront URL so static files (JS, CSS)
      // load directly from CDN instead of through the API Gateway path.
      // Empty on first deploy; stored in SSM after first deploy completes.
      ...(cloudfrontUrl ? { SVELTE_ASSETS_URL: cloudfrontUrl } : {}),
    };

    // ---------------------------------------------------------------
    // SvelteKit webapp
    // ---------------------------------------------------------------

    const site = new sst.aws.SvelteKit("BotmonWeb", {
      path: "webapp/",
      link: [leoStats],
      environment,
      permissions: [
        // Grant access to all external Leo Bus DynamoDB tables and S3
        {
          actions: [
            "dynamodb:GetItem",
            "dynamodb:PutItem",
            "dynamodb:UpdateItem",
            "dynamodb:DeleteItem",
            "dynamodb:Query",
            "dynamodb:Scan",
            "dynamodb:BatchGetItem",
            "dynamodb:BatchWriteItem",
          ],
          resources: [
            // External tables from leosdk stack
            `arn:aws:dynamodb:*:*:table/${busConfig.LeoCron}`,
            `arn:aws:dynamodb:*:*:table/${busConfig.LeoCron}/*`,
            `arn:aws:dynamodb:*:*:table/${busConfig.LeoEvent}`,
            `arn:aws:dynamodb:*:*:table/${busConfig.LeoEvent}/*`,
            `arn:aws:dynamodb:*:*:table/${busConfig.LeoStream}`,
            `arn:aws:dynamodb:*:*:table/${busConfig.LeoStream}/*`,
            `arn:aws:dynamodb:*:*:table/${busConfig.LeoSystem}`,
            `arn:aws:dynamodb:*:*:table/${busConfig.LeoSystem}/*`,
            // LEO_AUTH table (DSCO auth user lookup)
            ...(leoAuthTableName
              ? [
                  `arn:aws:dynamodb:*:*:table/${leoAuthTableName}`,
                  `arn:aws:dynamodb:*:*:table/${leoAuthTableName}/*`,
                ]
              : []),
          ],
        },
        {
          actions: ["s3:GetObject", "s3:ListBucket"],
          resources: [
            `arn:aws:s3:::${busConfig.LeoS3}`,
            `arn:aws:s3:::${busConfig.LeoS3}/*`,
          ],
        },
      ],
      server: {
        memory: "1024 MB",
        architecture: "arm64",
        timeout: "30 seconds",
      },
    });

    // ---------------------------------------------------------------
    // HTTP API → Lambda Function URL (HTTP_PROXY) → API mapping
    //
    // API Gateway strips the mapping key prefix (/botmonAlpha) before
    // forwarding. We use HTTP_PROXY integration to the Lambda Function
    // URL with requestParameters to prepend the prefix back. This way
    // SvelteKit receives the full path and paths.base works correctly
    // for routes, assets, and redirects — no reroute hacks needed.
    // ---------------------------------------------------------------

    const httpApi = new aws.apigatewayv2.Api("BotmonHttpApi", {
      name: `botmon-${stage}`,
      protocolType: "HTTP",
    });

    const httpProxyIntegration = new aws.apigatewayv2.Integration(
      "BotmonHttpApiIntegration",
      {
        apiId: httpApi.id,
        integrationType: "HTTP_PROXY",
        integrationMethod: "ANY",
        integrationUri: site.nodes.server.url,
        payloadFormatVersion: "1.0",
        requestParameters: {
          // Restore the stripped mapping key prefix before proxying
          "overwrite:path": `/${apiMappingKey}$request.path`,
        },
      },
    );

    const defaultRoute = new aws.apigatewayv2.Route("BotmonHttpApiRoute", {
      apiId: httpApi.id,
      routeKey: "$default",
      target: $interpolate`integrations/${httpProxyIntegration.id}`,
    });

    const apiStage = new aws.apigatewayv2.Stage("BotmonHttpApiStage", {
      apiId: httpApi.id,
      name: "$default",
      autoDeploy: true,
    });

    // Map /botmonAlpha on the existing DSCO custom domain to our HTTP API
    const apiMapping = new aws.apigatewayv2.ApiMapping("BotmonApiMapping", {
      apiId: httpApi.id,
      domainName: appsCustomDomain,
      stage: apiStage.id,
      apiMappingKey,
    });

    // Store the CloudFront URL in SSM so the next deploy can bake it
    // into paths.assets at build time (solves first-deploy chicken-and-egg).
    site.url.apply(async (url: string) => {
      if (url && url !== cloudfrontUrl) {
        console.log(`Storing CloudFront URL in SSM: ${url}`);
        await storeCloudfrontUrl(region, stage, url);
      }
    });

    return {
      url: site.url,
      dscoUrl: `https://${appsCustomDomain}/${apiMappingKey}`,
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
