# Deployment

The SvelteKit webapp deploys to AWS as **Lambda (SSR) + CloudFront (CDN) + S3 (static assets)** via [SST v3](https://sst.dev/). All infrastructure is defined in [`sst.config.ts`](./sst.config.ts).

## Contents

- [Architecture](#architecture)
- [Stage naming](#stage-naming)
- [Live stages](#live-stages)
- [First deploy](#first-deploy)
- [Subsequent deploys](#subsequent-deploys)
- [Resource discovery](#resource-discovery)
- [API Gateway v1 REST API](#api-gateway-v1-rest-api)
- [Custom domains](#custom-domains)
- [Environment variables](#environment-variables)
- [Rollback](#rollback)
- [CI/CD](#cicd)
- [Appendix: SST → CDK migration](#appendix-sst--cdk-migration)

## Architecture

```
 Browser                                                   
   │                                                       
   │  https://{env}-apps.dsco.io/botmonAlpha[Bus]/...      
   ▼                                                       
 API Gateway v1 (REST)  ◄── mapped to *-apps.dsco.io       
   │  BasePathMapping strips /botmonAlpha                  
   ▼                                                       
 Lambda (SSR)                                              
   ├─ lambda-handler-v1.mjs  ◄── re-prepends SVELTE_BASE_PATH
   └─ svelte-kit-sst handler                               
   │                                                       
   │  Static asset paths absolute → CloudFront             
   ▼                                                       
 S3 (static assets) ◄─ CloudFront distribution             
```

**Resources the stack CREATES:**

- SvelteKit Lambda (`sst.aws.SvelteKit`) — `BotmonWeb`
- CloudFront distribution
- S3 assets bucket
- API Gateway v1 REST API + Resource + Methods + Integrations + Deployment + Stage
- `aws.apigateway.BasePathMapping` onto the existing DSCO apps custom domain
- `aws.lambda.Permission` for API Gateway invocation
- Health-check SNS topic
- IAM roles (`LeoBotmonRole`, `LeoBotmonSnsRole`)

**Resources the stack REFERENCES (does not create):**

- Leo Bus tables (`LeoCron`, `LeoEvent`, `LeoStream`, `LeoSystem`, `LeoS3`) — read from Secrets Manager `rstreams-{Env}{Bus}Bus`
- `LeoStats` DynamoDB table — read from the existing old-Botmon CloudFormation stack `{Env}{Bus}Botmon` (has live data + auto-scaling)
- `LEO_AUTH_USER_TABLE_NAME` — read from SSM `/mcd/{env}/rstreams/main_bus/leo_auth_user_table_name`
- Custom apps domain (`test-apps.dsco.io`, `staging-apps.dsco.io`, `apps.dsco.io`) — pre-existing EDGE-optimized API Gateway domain

If the `{Env}{Bus}Botmon` stack doesn't exist (no old-Botmon), the deploy fails hard — it won't create a new LeoStats. Create one out-of-band before first deploy.

## Stage naming

`{env}-{bus}` — matches the `create-env` npm scripts:

- `env` ∈ `test`, `staging`, `prod`
- `bus` ∈ `cup`, `chub`, `stream` (`cup` is the default bus; no suffix in AWS resource names)

Examples: `test-cup`, `staging-chub`, `prod-stream`.

The API Gateway base path also varies per bus:

| Bus | BasePathMapping key |
|---|---|
| cup | `botmonAlpha` |
| chub | `botmonAlphaChub` |
| stream | `botmonAlphaStreams` |

## Live stages

All nine stages are currently deployed:

| Stage | URL |
|---|---|
| test-cup | https://test-apps.dsco.io/botmonAlpha |
| test-chub | https://test-apps.dsco.io/botmonAlphaChub |
| test-stream | https://test-apps.dsco.io/botmonAlphaStreams |
| staging-cup | https://staging-apps.dsco.io/botmonAlpha |
| staging-chub | https://staging-apps.dsco.io/botmonAlphaChub |
| staging-stream | https://staging-apps.dsco.io/botmonAlphaStreams |
| prod-cup | https://apps.dsco.io/botmonAlpha |
| prod-chub | https://apps.dsco.io/botmonAlphaChub |
| prod-stream | https://apps.dsco.io/botmonAlphaStreams |

Note the prod domain is the bare `apps.dsco.io` (no env prefix).

## First deploy

```bash
cd webapp
npm install

# Ensure AWS credentials are active (default profile)
aws sts get-caller-identity

# Deploy — the wrapper handles the first-deploy CloudFront chicken-and-egg
./scripts/deploy.sh test-cup
# or: npm run deploy -- test-cup
```

**Why the wrapper**: SvelteKit bakes `paths.assets` (the absolute CloudFront URL) into the built HTML at **build time**. But the CloudFront distribution doesn't exist yet on the very first deploy. The wrapper detects a missing `/botmon/{stage}/cloudfront-url` SSM param and runs `sst deploy` twice:

1. **Pass 1** — creates the distribution, writes its URL to SSM
2. **Pass 2** — rebuilds with `SVELTE_ASSETS_URL` baked in

Subsequent deploys are single-pass. `scripts/deploy.sh` is idempotent.

The wrapper also runs `aws apigateway create-deployment --stage-name live` after every SST deploy. This works around a first-deploy race where Pulumi creates the v1 `aws.apigateway.Deployment` before Methods/Integrations are fully registered, leaving an empty routing snapshot → 404s on every path.

## Subsequent deploys

```bash
cd webapp
./scripts/deploy.sh <stage>
```

Single-pass. Fast (~2 min once the SST cache is warm).

## Resource discovery

Most environment variables are resolved **automatically at deploy time** — no manual env setup needed. The `{env}-{bus}` stage name tells SST which Secrets Manager secret and SSM parameters to fetch.

| Variable | Source |
|---|---|
| `LEO_CRON_TABLE`, `LEO_EVENT_TABLE`, `LEO_STREAM_TABLE`, `LEO_SYSTEM_TABLE`, `LEO_S3` | Secrets Manager: `rstreams-{Env}{Bus}Bus` |
| `LEO_STATS_TABLE` | CloudFormation: stack `{Env}{Bus}Botmon`, resource `LeoStats` |
| `LEO_AUTH_USER_TABLE_NAME` | SSM: `/mcd/{env}/rstreams/main_bus/leo_auth_user_table_name` |
| `AUTH_SECRET` | SSM SecureString `/botmon/{stage}/auth-secret` (auto-generated on first deploy) |
| `SVELTE_ASSETS_URL` | SSM `/botmon/{stage}/cloudfront-url` (written after pass 1) |
| `STAGE` | Parsed from `{env}` portion of stage name |
| `AWS_REGION` | From Bus secret or defaults to `us-east-1` |

If a value is missing (wrong region, stack not deployed, IAM missing), the deploy fails with a clear error. See [`sst.config.ts`](./sst.config.ts) resource-discovery helpers around lines 100-270.

## API Gateway v1 REST API

The stack uses **API Gateway v1 (REST API)**, not v2 (HTTP API). Required because the DSCO apps custom domains are EDGE-optimized, and EDGE domains only accept v1 `BasePathMapping`:

| Domain | Type | Supports v1 mapping | Supports v2 mapping |
|---|---|---|---|
| `test-apps.dsco.io` | REGIONAL | ✅ | ✅ |
| `staging-apps.dsco.io` | EDGE | ✅ | ❌ |
| `apps.dsco.io` | EDGE | ✅ | ❌ |

Using v1 uniformly across all stages keeps the architecture identical per environment.

### Lambda handler wrapper

API Gateway v1 `BasePathMapping` strips the base path before invoking Lambda. SvelteKit needs the full path (including `/botmonAlpha`) so its internal router matches. [`lambda-handler-v1.mjs`](./lambda-handler-v1.mjs) re-prepends `SVELTE_BASE_PATH` to `event.path` before delegating to the `svelte-kit-sst` adapter handler.

This wrapper is installed via SST's `server.copyFiles` + `server.handler`:

```ts
server: {
  copyFiles: [
    { from: "lambda-handler-v1.mjs", to: "lambda-handler-v1.mjs" },
  ],
  handler: "lambda-handler-v1.handler",
}
```

The wrapper is ~15 lines and is tested implicitly by the smoke tests (302 → 200 on every deployed stage).

## Custom domains

The apps custom domains (`test-apps.dsco.io`, `staging-apps.dsco.io`, `apps.dsco.io`) are shared with other DSCO services. Each webapp deploy adds a `BasePathMapping` for its bus-specific path (`botmonAlpha`, `botmonAlphaChub`, `botmonAlphaStreams`).

**Why not a dedicated botmon subdomain?** DSCO `*-core.dsco.io` uses a strict CORS allowlist. Only pre-approved origins (currently `*-apps.dsco.io`) can exchange `dw-auth-token`. Adding a new subdomain requires DSCO team coordination and a cert (`*.dsco.io` wildcard only covers single-level subdomains). Staying under the shared apps domain avoids these asks.

The wildcard cert `*.dsco.io` lives in our AWS account (220162591379, ACM us-east-1) but the parent `dsco.io` Route 53 zone does not.

## Environment variables

**Required in `webapp/.env.local` for local dev** (auto-populated by `npm run create-env-*`):

See [AUTH.md](./AUTH.md) and [README.md](./README.md#envlocal) for the full list.

**Required at deploy time** (auto-discovered — don't set these manually):

Listed in [Resource discovery](#resource-discovery). Injected into the Lambda environment via SST.

**Optional overrides** (can set in shell before `deploy.sh` or in SST CLI args):

| Variable | Default | Purpose |
|---|---|---|
| `AUTH_CONFIG_SOURCE` | (unset) | Path or URL to OAuth providers config; leave unset in deployed stages that use DSCO auth |
| `DEBUG_AUTH` | `false` | Verbose auth logging (`[Hooks]`, `[Auth]`, `[DscoAuth]` prefixes) |
| `PERF_TIMING` | `0` | Server-side performance timing logs |

## Rollback

Two options:

**Option 1 — teardown the stack** (fastest, full reset):

```bash
cd webapp
npx sst remove --stage <env>-<bus>
```

Destroys Lambda, CloudFront, S3, API Gateway resources. The old-Botmon stack at the repo root is **untouched** and continues to serve its existing paths. No Leo Bus data is migrated — LeoStats and bus tables are external.

**Option 2 — redeploy a previous git commit**:

```bash
git checkout <good-sha>
cd webapp
./scripts/deploy.sh <env>-<bus>
```

## CI/CD

No automated pipeline yet. To add GitHub Actions:

1. Create `.github/workflows/deploy.yml`
2. Set GitHub secrets for an AWS OIDC role with permissions matching `sst.config.ts`
3. Workflow should run `cd webapp && npm ci && ./scripts/deploy.sh <stage>`

Suggested trigger: manual dispatch with `stage` input, plus auto-deploy to `test-*` on merge to `main`.

---

## Appendix: SST → CDK migration

SST is maintained by a small company; CDK is AWS-first. If the team ever needs to move off SST, this is the migration path. The deployed AWS resources (Lambda + CloudFront + S3 + API Gateway v1) are functionally identical regardless of IaC tool — only the definition language changes.

**1. Swap the SvelteKit adapter**

```bash
npm uninstall svelte-kit-sst
npm install -D @sveltejs/adapter-node
```

Update `svelte.config.js`:

```js
import adapter from '@sveltejs/adapter-node';
```

This produces a standard Node.js server build in `build/`.

**2. Create a CDK stack** that replicates `sst.config.ts`:

```ts
// lib/botmon-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

export class BotmonStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const assetsBucket = new s3.Bucket(this, 'Assets', { /* ... */ });

    const handler = new lambda.Function(this, 'SSR', {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      handler: 'lambda-handler-v1.handler',
      code: lambda.Code.fromAsset('webapp/build'),
      environment: { /* same env vars as sst.config.ts */ },
    });

    const api = new apigateway.RestApi(this, 'BotmonRestApi', { /* ... */ });
    const proxy = api.root.addResource('{proxy+}');
    proxy.addMethod('ANY', new apigateway.LambdaIntegration(handler));
    api.root.addMethod('ANY', new apigateway.LambdaIntegration(handler));

    new apigateway.BasePathMapping(this, 'BotmonMapping', {
      domainName: apigateway.DomainName.fromDomainNameAttributes(this, 'AppsDomain', {
        domainName: 'test-apps.dsco.io',
        domainNameAliasHostedZoneId: '...',
        domainNameAliasTarget: '...',
      }),
      restApi: api,
      basePath: 'botmonAlpha',
    });

    const distribution = new cloudfront.Distribution(this, 'CDN', { /* ... */ });

    new s3deploy.BucketDeployment(this, 'DeployAssets', {
      sources: [s3deploy.Source.asset('webapp/build/client')],
      destinationBucket: assetsBucket,
      distribution,
      distributionPaths: ['/_app/*'],
    });
  }
}
```

**3. Deploy**

```bash
npx cdk deploy BotmonAlpha --context stage=test-cup
```

**4. Remove SST**

```bash
cd webapp
npx sst remove --stage <stage>   # for each stage
rm sst.config.ts lambda-handler-v1.mjs scripts/deploy.sh
rm -rf .sst/
npm uninstall svelte-kit-sst
```

**Key differences**

| Aspect | SST | CDK |
|---|---|---|
| Config file | `sst.config.ts` | `lib/botmon-stack.ts` + `bin/app.ts` |
| Adapter | `svelte-kit-sst` | `@sveltejs/adapter-node` |
| Deploy command | `./scripts/deploy.sh <stage>` | `npx cdk deploy --context stage=X` |
| State | Pulumi state (S3) | CloudFormation only |
| First-deploy CloudFront URL bake | Handled by `scripts/deploy.sh` | Would need a custom-resource or two-pass workflow |
| SvelteKit bundling | Automatic | Manual (build then package) |
