# Deployment

The SvelteKit webapp deploys to AWS as a Lambda function (SSR) behind CloudFront (CDN) with static assets on S3. Infrastructure is managed by [SST v3](https://sst.dev/).

## Architecture

```
Botmon Stack (created by SST)              External (leosdk stack)
─────────────────────────────              ────────────────────────
CloudFront Distribution                    LeoCron DynamoDB table
  ├── S3 Origin (static assets)            LeoEvent DynamoDB table
  └── Lambda Origin (SSR + API)            LeoStream DynamoDB table
LeoStats DynamoDB table                    LeoSystem DynamoDB table
Health Check SNS topic                     LeoS3 bucket
IAM roles                                  LeoAuth tables (DSCO)
```

Each deployment stage (alpha, staging, prod) gets its own isolated CloudFormation stack. The stack **creates** the resources it owns (LeoStats, SNS, Lambda, CloudFront, S3) and **references** external Leo Bus tables from the `leosdk` stack via environment variables. When deploying to a new region or account, the owned resources are created automatically; the external tables must already exist (from the `leosdk` stack).

## Prerequisites

- Node.js >= 20.11.0
- AWS credentials configured (`~/.aws/credentials` or environment variables)
- External Leo Bus tables deployed (from the `leosdk` stack) in the target region

## Quick Start

```bash
# From the repo root (where sst.config.ts lives)

# 1. Install dependencies
cd webapp && npm install && cd ..

# 2. Deploy (everything is auto-discovered — no manual env setup needed)
npx sst deploy --stage alpha

# The command outputs the CloudFront URL when complete
```

## Deployment Commands

| Command | Description |
|---------|-------------|
| `npx sst deploy --stage alpha` | Deploy to alpha (bus=cup by default) |
| `BUS=chub npx sst deploy --stage staging` | Deploy for a specific bus |
| `npx sst deploy --stage prod` | Deploy to production |
| `npx sst dev` | Start local dev with live Lambda (hot reload) |
| `npx sst remove --stage alpha` | Tear down the alpha stack completely |

## How Resource Discovery Works

Most environment variables are resolved **automatically at deploy time** — you don't need to set them manually.

**Stage → environment mapping:**
The SST stage name maps to the AWS environment used for Secrets Manager and SSM lookups:
- `alpha`, `dev`, `test` → `test`
- `staging` → `staging`
- `prod` → `prod`

**Bus selection:**
Set `BUS=cup|chub|stream` (defaults to `cup`). This selects which Leo Bus to connect to.

**Auto-discovered resources:**

| Variable | Source |
|----------|--------|
| `LEO_STATS_TABLE` | Created by this stack (`sst.aws.Dynamo`) |
| `HEALTH_CHECK_SNS_TOPIC_ARN` | Created by this stack (`sst.aws.SnsTopic`) |
| `LEO_CRON_TABLE` | Secrets Manager: `rstreams-{Env}{Bus}Bus` |
| `LEO_EVENT_TABLE` | Secrets Manager: `rstreams-{Env}{Bus}Bus` |
| `LEO_STREAM_TABLE` | Secrets Manager: `rstreams-{Env}{Bus}Bus` |
| `LEO_SYSTEM_TABLE` | Secrets Manager: `rstreams-{Env}{Bus}Bus` |
| `LEO_S3` | Secrets Manager: `rstreams-{Env}{Bus}Bus` |
| `LEO_AUTH_USER_TABLE_NAME` | SSM: `/mcd/{env}/rstreams/main_bus/leo_auth_user_table_name` |
| `AUTH_SECRET` | SSM SecureString `/botmon/{stage}/auth-secret` (auto-generated on first deploy) |
| `STAGE` | Derived from SST stage name |
| `AWS_REGION` | From Bus secret or defaults to `us-east-1` |

**Optional overrides** (via `.env.<stage>` or shell environment):

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_CONFIG_SOURCE` | `./providers.config.json` | Path or URL to auth providers config JSON |
| `DEBUG_AUTH` | `false` | Enable verbose auth logging |
| `PERF_TIMING` | `0` | Enable server-side performance timing logs |


## Custom Domain

Uncomment the `domain` block in `sst.config.ts` once DNS is configured:

```ts
domain: {
  name: "botmon-alpha.your-domain.com",
  redirects: ["www.botmon-alpha.your-domain.com"],
},
```

SST handles ACM certificate provisioning and Route 53 alias records automatically.

## CI/CD (GitHub Actions)

A workflow template is at `.github/workflows/deploy-alpha.yml` (to be created). It should:

1. Checkout code
2. Install dependencies (`cd webapp && npm ci`)
3. Configure AWS credentials (OIDC role assumption)
4. Run `npx sst deploy --stage <stage>`

All environment variables should be set as GitHub Secrets or fetched from AWS SSM at deploy time.

---

## SST Decision and CDK Migration Path

### Why SST Was Chosen

SST v3 was selected for initial deployment because:

1. **First-class SvelteKit support** — `sst.aws.SvelteKit` handles Lambda bundling, CloudFront setup, S3 asset upload, and routing in one component. CDK requires wiring these manually.
2. **Faster iteration** — `sst dev` provides live Lambda reload during development.
3. **Same underlying infrastructure** — SST deploys via CloudFormation (through Pulumi). The resulting AWS resources are standard Lambda + CloudFront + S3.
4. **Low migration risk** — The deployment target (Lambda + CloudFront) is the same regardless of IaC tool. Switching to CDK changes how you *define* the infrastructure, not what gets deployed.

### SST Risks

- SST is maintained by a small company (not AWS). If the project is abandoned, the deployed infrastructure still works, but the IaC tooling would need replacement.
- SST v3 uses Pulumi under the hood, which stores state differently than pure CloudFormation.
- SST changed architectures significantly between v2 (CDK-based) and v3 (Pulumi-based).

### How to Migrate from SST to CDK

If the team decides to move away from SST, here is the migration path:

#### 1. Switch the SvelteKit adapter

```bash
npm uninstall svelte-kit-sst
npm install -D @sveltejs/adapter-node
```

Update `svelte.config.js`:

```js
import adapter from '@sveltejs/adapter-node';
```

This produces a standard Node.js server build in `build/`.

#### 2. Create a CDK stack

Install CDK:

```bash
npm install -D aws-cdk aws-cdk-lib constructs
npx cdk init app --language typescript
```

Create a stack that replicates what SST deploys:

```ts
// lib/botmon-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

export class BotmonStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 bucket for static assets
    const assetsBucket = new s3.Bucket(this, 'Assets', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Lambda function for SSR
    const handler = new lambda.Function(this, 'SSR', {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      handler: 'index.handler',
      code: lambda.Code.fromAsset('webapp/build'), // adapter-node output
      environment: {
        // ... same env vars as sst.config.ts
      },
    });

    // Lambda Function URL (replaces API Gateway for simplicity)
    const fnUrl = handler.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    // CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'CDN', {
      defaultBehavior: {
        origin: new origins.FunctionUrlOrigin(fnUrl),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      },
      additionalBehaviors: {
        '/_app/*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(assetsBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
    });

    // Upload static assets to S3
    new s3deploy.BucketDeployment(this, 'DeployAssets', {
      sources: [s3deploy.Source.asset('webapp/build/client')],
      destinationBucket: assetsBucket,
      distribution,
      distributionPaths: ['/_app/*'],
    });

    new cdk.CfnOutput(this, 'URL', { value: `https://${distribution.distributionDomainName}` });
  }
}
```

#### 3. Deploy with CDK

```bash
npx cdk deploy BotmonAlpha --context stage=alpha
```

#### 4. Remove SST

```bash
# Tear down the SST-managed stack first
npx sst remove --stage alpha

# Remove SST files
rm sst.config.ts
rm -rf .sst/

# Remove SST dependencies
npm uninstall svelte-kit-sst sst
```

#### Key Differences


| Aspect             | SST                        | CDK                                  |
| ------------------ | -------------------------- | ------------------------------------ |
| Config file        | `sst.config.ts`            | `lib/botmon-stack.ts` + `bin/app.ts` |
| Adapter            | `svelte-kit-sst`           | `@sveltejs/adapter-node`             |
| Deploy command     | `npx sst deploy --stage X` | `npx cdk deploy --context stage=X`   |
| State              | Pulumi state (S3 bucket)   | CloudFormation only                  |
| SvelteKit bundling | Automatic                  | Manual (build then package)          |


The AWS resources (Lambda, CloudFront, S3) are functionally identical. The migration is about changing the tool that manages them, not the infrastructure itself.