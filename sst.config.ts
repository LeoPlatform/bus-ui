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
 * Resources REFERENCED from external stacks (leosdk):
 *   - LeoCron, LeoEvent, LeoStream, LeoSystem DynamoDB tables
 *   - LeoS3 bucket
 *   - LeoAuth / LeoAuthUser tables (DSCO auth)
 *   These are passed via environment variables.
 *
 * Usage:
 *   npx sst deploy --stage alpha
 *   npx sst dev
 *   npx sst remove --stage alpha
 *
 * See webapp/DEPLOYMENT.md for full docs and CDK migration path.
 */

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
    //
    // LeoBotmonRole: Lambda execution + leosdk policy + LeoStats write
    // LeoBotmonSnsRole: Lambda execution + leosdk + leoauth policy + SNS
    //
    // Note: The old stack imports leosdk-Policy and leoauth-Policy via
    // Fn::ImportValue. Here we define the permissions inline since SST
    // manages the Lambda role separately. These roles are available for
    // any additional Lambdas that need the same access pattern.
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
      // Auth
      AUTH_SECRET: process.env.AUTH_SECRET ?? "",
      AUTH_CONFIG_SOURCE: process.env.AUTH_CONFIG_SOURCE ?? "",
      LOCAL: process.env.LOCAL ?? "false",
      STAGE: process.env.STAGE ?? $app.stage,
      DEBUG_AUTH: process.env.DEBUG_AUTH ?? "false",

      // Owned resource — LeoStats table name injected from the resource
      LEO_STATS_TABLE: leoStats.name,

      // External tables from leosdk stack (env vars)
      LEO_CRON_TABLE: process.env.LEO_CRON_TABLE ?? "",
      LEO_EVENT_TABLE: process.env.LEO_EVENT_TABLE ?? "",
      LEO_STREAM_TABLE: process.env.LEO_STREAM_TABLE ?? "",
      LEO_SYSTEM_TABLE: process.env.LEO_SYSTEM_TABLE ?? "",
      LEO_S3: process.env.LEO_S3 ?? "",

      // DSCO auth (only needed for DSCO deployments)
      LEO_AUTH_USER_TABLE_NAME: process.env.LEO_AUTH_USER_TABLE_NAME ?? "",

      // AWS region for DynamoDB/Cognito SDK calls
      AWS_REGION: process.env.AWS_REGION ?? "us-east-1",

      // SNS topic ARN for health checks
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
      //   name: `botmon-${$app.stage}.your-domain.com`,
      //   redirects: [`www.botmon-${$app.stage}.your-domain.com`],
      // },
      server: {
        memory: "1024 MB",
        architecture: "arm64",
        timeout: "30 seconds",
      },
    });

    return {
      url: site.url,
      leoStatsTable: leoStats.name,
      healthCheckSnsTopic: healthCheckSns.arn,
      leoBotmonRoleArn: leoBotmonRole.arn,
      leoBotmonSnsRoleArn: leoBotmonSnsRole.arn,
    };
  },
});
