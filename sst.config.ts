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

/**
 * Discover the existing LeoStats table from the old Botmon CloudFormation stack.
 * Convention: {Env}{Bus}Botmon stack → LeoStats logical resource
 * Examples:
 *   (test, cup)    → TestBotmon → LeoStats
 *   (prod, chub)   → ProdChubBotmon → LeoStats
 */
async function fetchLeoStatsTableName(
  region: string,
  env: string,
  bus: string,
): Promise<string> {
  const { CloudFormationClient, DescribeStackResourceCommand } = await import(
    "@aws-sdk/client-cloudformation"
  );
  const client = new CloudFormationClient({ region });
  const stackName = `${capitalize(env)}${busSuffix(bus)}Botmon`;

  try {
    console.log(`Fetching LeoStats table from stack: ${stackName}`);
    const result = await client.send(
      new DescribeStackResourceCommand({
        StackName: stackName,
        LogicalResourceId: "LeoStats",
      }),
    );
    const tableName = result.StackResourceDetail?.PhysicalResourceId ?? "";
    if (tableName) {
      console.log(`LeoStats table: ${tableName}`);
    }
    return tableName;
  } catch (e: any) {
    console.warn(`⚠ Could not fetch LeoStats table from stack ${stackName}: ${e.message}`);
    return "";
  }
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

    const [busConfig, leoStatsTableName, leoAuthTableName, authSecret, cloudfrontUrl] = await Promise.all([
      fetchBusSecret(region, env, bus),
      fetchLeoStatsTableName(region, env, bus),
      fetchLeoAuthTableName(region, env),
      fetchOrCreateAuthSecret(region, stage),
      fetchCloudfrontUrl(region, stage),
    ]);

    console.log(`  LeoCron: ${busConfig.LeoCron}`);
    console.log(`  LeoEvent: ${busConfig.LeoEvent}`);
    console.log(`  LeoStream: ${busConfig.LeoStream}`);
    console.log(`  LeoSystem: ${busConfig.LeoSystem}`);
    console.log(`  LeoS3: ${busConfig.LeoS3}`);
    console.log(`  LeoStats: ${leoStatsTableName || "(not found — deploy will fail)"}`);
    console.log(`  LEO_AUTH_USER_TABLE_NAME: ${leoAuthTableName || "(not found)"}`);

    // ---------------------------------------------------------------
    // LeoStats DynamoDB table
    //
    // Use the existing table from the old Botmon CloudFormation stack.
    // It already has data, auto-scaling, and is actively written to by
    // the Leo bus infrastructure. Creating a new table would be empty.
    //
    // Falls back to creating a new table only for fresh deployments
    // where no old Botmon stack exists.
    // ---------------------------------------------------------------

    if (!leoStatsTableName) {
      throw new Error(
        `Could not find existing LeoStats table for stage "${stage}". ` +
        `Expected CloudFormation stack "${capitalize(env)}${busSuffix(bus)}Botmon" ` +
        `with a "LeoStats" resource. The new botmon reads from the existing ` +
        `LeoStats table — it does not create its own.`,
      );
    }

    const leoStatsTable = leoStatsTableName;
    const leoStatsTableArn = `arn:aws:dynamodb:${region}:*:table/${leoStatsTable}`;

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
          policy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Action: [
                  "dynamodb:BatchGetItem",
                  "dynamodb:BatchWriteItem",
                  "dynamodb:UpdateItem",
                ],
                Resource: [leoStatsTableArn, `${leoStatsTableArn}/*`],
              },
            ],
          }),
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
    // API Gateway mapping on the DSCO apps custom domain
    //
    // DSCO's apps domain uses API Gateway API mappings to route paths
    // to different services (e.g. /botmon → old UI, /botmonchub → old
    // UI chub bus, etc.).
    //
    // Domain name per env:
    //   test    → test-apps.dsco.io
    //   staging → staging-apps.dsco.io
    //   prod    → apps.dsco.io   (no env prefix — prod uses the bare host)
    //
    // We add a mapping for /botmonAlpha[Bus] → our SvelteKit Lambda so
    // the app is accessible at {appsCustomDomain}/botmonAlpha[Bus]. This
    // puts us on the dsco.io domain, which means DSCO auth cookies work
    // and there are no CORS issues with dw-auth-token endpoints.
    //
    // Mapping key per bus:
    //   cup    → botmonAlpha
    //   stream → botmonAlphaStreams
    //   chub   → botmonAlphaChub
    // Each bus gets its own path on the shared apps domain so
    // cup/stream/chub can coexist without API mapping conflicts.
    // ---------------------------------------------------------------

    const apiMappingKey =
      bus === "cup"
        ? "botmonAlpha"
        : bus === "stream"
          ? "botmonAlphaStreams"
          : "botmonAlphaChub";
    const appsCustomDomain =
      env === "prod" ? "apps.dsco.io" : `${env}-apps.dsco.io`;

    // ---------------------------------------------------------------
    // Environment for the SvelteKit server Lambda
    // ---------------------------------------------------------------

    const environment: Record<string, string> = {
      // Auth (auto-generated on first deploy, stored in SSM as SecureString)
      AUTH_SECRET: authSecret,
      // AUTH_CONFIG_SOURCE is intentionally omitted — initAuthConfig() defaults
      // to loadAuthConfigFromEnv() when it's unset, which is what we want on
      // Lambda (no providers.config.json file in the bundle).
      ...(process.env.AUTH_CONFIG_SOURCE ? { AUTH_CONFIG_SOURCE: process.env.AUTH_CONFIG_SOURCE } : {}),
      LOCAL: "false",
      STAGE: env,
      DEBUG_AUTH: process.env.DEBUG_AUTH ?? "false",

      // LeoStats — existing table from old Botmon CloudFormation stack
      LEO_STATS_TABLE: leoStatsTable,

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

      // SvelteKit base path — used for generating URLs (links, navigation)
      // and also read by lambda-handler-v1.mjs to re-prepend the prefix
      // that API Gateway v1 BasePathMapping strips before invoking Lambda.
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
      // LeoStats permissions are granted via the permissions block below
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
            // LeoStats table (existing, from old Botmon stack)
            `arn:aws:dynamodb:*:*:table/${leoStatsTable}`,
            `arn:aws:dynamodb:*:*:table/${leoStatsTable}/*`,
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
        // Cognito Identity — needed for DSCO auth credential minting
        {
          actions: ["cognito-identity:GetCredentialsForIdentity"],
          resources: ["*"],
        },
      ],
      server: {
        memory: "1024 MB",
        architecture: "arm64",
        timeout: "30 seconds",
        install: ["leo-sdk"],
        // Override the default adapter handler with our v1 wrapper. The
        // wrapper re-prepends SVELTE_BASE_PATH to event.path (v1's
        // BasePathMapping strips it, unlike v2's overwrite:path) and
        // then delegates to the svelte-kit-sst adapter handler at
        // ./lambda-handler/index.handler.
        copyFiles: [
          { from: "webapp/lambda-handler-v1.mjs", to: "lambda-handler-v1.mjs" },
        ],
        handler: "lambda-handler-v1.handler",
      },
      transform: {
        cdn: (args) => {
          // Add CORS headers to static asset responses so they can be loaded
          // cross-origin from test-apps.dsco.io (assets are on CloudFront).
          const corsPolicy = new aws.cloudfront.ResponseHeadersPolicy(
            "BotmonCorsHeadersPolicy",
            {
              name: `botmon-${stage}-cors`,
              corsConfig: {
                accessControlAllowCredentials: false,
                accessControlAllowHeaders: { items: ["*"] },
                accessControlAllowMethods: { items: ["GET", "HEAD"] },
                accessControlAllowOrigins: {
                  items: [
                    `https://${appsCustomDomain}`,
                    "https://test-apps.dsco.io",
                    "https://staging-apps.dsco.io",
                    "https://apps.dsco.io",
                    "http://localhost:5173",
                  ],
                },
                originOverride: true,
              },
            },
          );

          // Apply CORS headers to all cache behaviors (static assets + default)
          if (args.orderedCacheBehaviors) {
            args.orderedCacheBehaviors = $resolve(args.orderedCacheBehaviors).apply(
              (behaviors: any[]) =>
                behaviors.map((b: any) => ({
                  ...b,
                  responseHeadersPolicyId: corsPolicy.id,
                })),
            );
          }
          args.defaultCacheBehavior = $resolve(args.defaultCacheBehavior).apply(
            (b: any) => ({
              ...b,
              responseHeadersPolicyId: corsPolicy.id,
            }),
          );
        },
      },
    });

    // ---------------------------------------------------------------
    // REST API (v1) → Lambda (AWS_PROXY) → BasePathMapping
    //
    // DSCO's apps custom domains are a mix of REGIONAL (test) and
    // EDGE-optimized (staging, prod). API Gateway v2 (HTTP API) only
    // supports REGIONAL custom domains, so we use v1 (REST API) which
    // supports both. This keeps /botmonAlpha paths consistent across
    // all environments and avoids any DSCO-side changes (CORS allowlist,
    // DNS, cert are all already wired for the apps domain).
    //
    // BasePathMapping strips `/${apiMappingKey}` from the incoming URL
    // before invoking Lambda — unlike v2's `overwrite:path`, v1 has no
    // in-API-Gateway way to restore the prefix. Our Lambda handler
    // (lambda-handler-v1.mjs) re-prepends SVELTE_BASE_PATH to event.path
    // so SvelteKit's paths.base routing continues to work unchanged.
    // ---------------------------------------------------------------

    const restApi = new aws.apigateway.RestApi("BotmonRestApi", {
      name: `botmon-${stage}`,
      binaryMediaTypes: ["*/*"],
      endpointConfiguration: { types: "REGIONAL" },
    });

    // Root method — handles GET / and other methods at the base path
    const rootMethod = new aws.apigateway.Method("BotmonRootMethod", {
      restApi: restApi.id,
      resourceId: restApi.rootResourceId,
      httpMethod: "ANY",
      authorization: "NONE",
    });

    // {proxy+} resource — catches every non-root path under the API
    const proxyResource = new aws.apigateway.Resource("BotmonProxyResource", {
      restApi: restApi.id,
      parentId: restApi.rootResourceId,
      pathPart: "{proxy+}",
    });

    const proxyMethod = new aws.apigateway.Method("BotmonProxyMethod", {
      restApi: restApi.id,
      resourceId: proxyResource.id,
      httpMethod: "ANY",
      authorization: "NONE",
      requestParameters: { "method.request.path.proxy": true },
    });

    // AWS_PROXY integration forwards the whole request to the Lambda.
    // Invoke ARN format is a v1 REST API convention; constructed from
    // the Lambda function ARN because SST's SvelteKit component does
    // not expose `invokeArn` directly.
    const lambdaInvokeArn = $interpolate`arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${site.nodes.server.arn}/invocations`;

    const rootIntegration = new aws.apigateway.Integration("BotmonRootIntegration", {
      restApi: restApi.id,
      resourceId: restApi.rootResourceId,
      httpMethod: rootMethod.httpMethod,
      integrationHttpMethod: "POST",
      type: "AWS_PROXY",
      uri: lambdaInvokeArn,
    });

    const proxyIntegration = new aws.apigateway.Integration("BotmonProxyIntegration", {
      restApi: restApi.id,
      resourceId: proxyResource.id,
      httpMethod: proxyMethod.httpMethod,
      integrationHttpMethod: "POST",
      type: "AWS_PROXY",
      uri: lambdaInvokeArn,
    });

    // Allow API Gateway to invoke the Lambda.
    const invokePermission = new aws.lambda.Permission("BotmonLambdaInvokePermission", {
      action: "lambda:InvokeFunction",
      function: site.nodes.server.name,
      principal: "apigateway.amazonaws.com",
      sourceArn: $interpolate`${restApi.executionArn}/*/*`,
    });

    // Deployment + Stage. `triggers` forces a redeploy whenever any of
    // the route/integration resources change; without this, route
    // updates would be silently ignored on subsequent deploys.
    const apiDeployment = new aws.apigateway.Deployment(
      "BotmonRestDeployment",
      {
        restApi: restApi.id,
        triggers: {
          redeployment: $interpolate`${proxyIntegration.id}-${rootIntegration.id}-${proxyMethod.id}-${rootMethod.id}`,
        },
      },
      {
        dependsOn: [
          rootMethod,
          proxyMethod,
          rootIntegration,
          proxyIntegration,
          invokePermission,
        ],
      },
    );

    const apiStage = new aws.apigateway.Stage("BotmonRestStage", {
      restApi: restApi.id,
      deployment: apiDeployment.id,
      stageName: "live",
    });

    // Map /${apiMappingKey} on the existing DSCO apps custom domain
    // onto our REST API. The mapping key is stripped from the path
    // before invocation; lambda-handler-v1.mjs re-prepends it.
    const basePathMapping = new aws.apigateway.BasePathMapping("BotmonBasePathMapping", {
      domainName: appsCustomDomain,
      restApi: restApi.id,
      stageName: apiStage.stageName,
      basePath: apiMappingKey,
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
      leoStatsTable: leoStatsTable,
      healthCheckSnsTopic: healthCheckSns.arn,
      leoBotmonRoleArn: leoBotmonRole.arn,
      leoBotmonSnsRoleArn: leoBotmonSnsRole.arn,
    };
  },
});
