#!/usr/bin/env bash
#
# deploy.sh — wrapper around `sst deploy` that handles the first-deploy
# chicken-and-egg around SVELTE_ASSETS_URL.
#
# SST creates the CloudFront distribution as part of the deploy, but
# SvelteKit's build must bake the absolute CloudFront URL into
# paths.assets *before* the distribution exists. The config writes the
# URL to SSM after each successful deploy so subsequent deploys have it
# — but first deploys produce assets with the wrong base path and every
# asset 404s until a second deploy runs.
#
# This wrapper detects the missing SSM parameter and runs `sst deploy`
# twice automatically. Subsequent deploys are single-pass.
#
# Usage:
#   scripts/deploy.sh <stage> [extra sst args...]
#
# Examples:
#   scripts/deploy.sh test-cup
#   scripts/deploy.sh staging-chub --verbose
#   scripts/deploy.sh prod-stream

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <stage> [extra sst deploy args]" >&2
  echo "   e.g. $0 staging-chub" >&2
  exit 2
fi

STAGE="$1"
shift

REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
SSM_PARAM="/botmon/${STAGE}/cloudfront-url"

echo "→ Checking SSM for cached CloudFront URL at ${SSM_PARAM}"

# Capture the parameter value. Missing parameter → aws exits non-zero;
# treat that as "empty". Suppress stderr so the error isn't alarming.
set +e
CF_URL=$(aws ssm get-parameter \
  --region "${REGION}" \
  --name "${SSM_PARAM}" \
  --query 'Parameter.Value' \
  --output text 2>/dev/null)
AWS_EXIT=$?
set -e

if [[ ${AWS_EXIT} -ne 0 ]] || [[ -z "${CF_URL}" ]] || [[ "${CF_URL}" == "None" ]]; then
  echo "⚠️  No CloudFront URL cached for stage '${STAGE}'."
  echo "   Running a two-pass deploy:"
  echo "     pass 1 — create CloudFront distribution, store URL in SSM"
  echo "     pass 2 — rebuild so SVELTE_ASSETS_URL is baked into paths.assets"
  echo ""
  echo "→ Pass 1 / 2"
  npx sst deploy --stage "${STAGE}" "$@"
  echo ""
  echo "→ Pass 2 / 2"
  npx sst deploy --stage "${STAGE}" "$@"
else
  echo "✓ CloudFront URL already cached: ${CF_URL}"
  echo "→ Single-pass deploy"
  npx sst deploy --stage "${STAGE}" "$@"
fi

# ---------------------------------------------------------------------
# Force a fresh API Gateway REST API deployment.
#
# The v1 REST API's initial `aws.apigateway.Deployment` resource can
# capture an empty snapshot on first creation — the deployment resource
# is created before API Gateway finishes propagating the methods and
# integrations, so the stage serves 404 "Not Found" until a second
# deployment is created. This also happens whenever SST updates
# method/integration properties but doesn't see a reason to recreate
# the Deployment resource.
#
# Calling create-deployment here is idempotent and cheap. It takes a
# fresh snapshot of current routes and points the `live` stage at it.
# Safe to run every time, even when not strictly needed.
# ---------------------------------------------------------------------

echo ""
echo "→ Forcing API Gateway REST API redeployment"
API_ID=$(aws apigateway get-rest-apis \
  --region "${REGION}" \
  --query "items[?name=='botmon-${STAGE}'].id" \
  --output text 2>/dev/null || true)

if [[ -n "${API_ID}" ]] && [[ "${API_ID}" != "None" ]]; then
  aws apigateway create-deployment \
    --region "${REGION}" \
    --rest-api-id "${API_ID}" \
    --stage-name live \
    --description "post-sst redeploy ($(date -u +%Y-%m-%dT%H:%M:%SZ))" \
    --query 'id' \
    --output text > /dev/null
  echo "✓ Fresh deployment created for REST API ${API_ID}"
else
  echo "⚠️  No REST API found named 'botmon-${STAGE}' — skipping redeploy"
fi
