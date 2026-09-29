# Legacy Fortress Staging Operations

This is the supported path for deploying and accepting the Legacy Fortress staging application. It is deliberately limited to the known staging resources:

- Application: `https://test.mylegacyfortress.com`
- Supabase: `https://supabase-test.mylegacyfortress.com`
- Coolify application UUID: `yka9huzmm56hjpz1gno448fb`
- Branch: `hosted-uat-preparation-20260715`

## Architecture

`.github/workflows/staging-release.yml` is a manually dispatched GitHub Actions workflow protected by the `legacy-fortress-staging` environment. It checks out the requested commit, installs dependencies, requests deployment through the Coolify API, waits for the public staging `/api/version` endpoint to report the exact SHA, and then runs `npm run staging:acceptance:idv`.

The repository script `scripts/staging/operations.mjs` is the single allowlisted entry point. It refuses other application UUIDs, branches, origins, production-looking control-plane URLs, non-staging environment markers, and SHA mismatches. Deployment additionally requires the workflow approval gate `STAGING_DEPLOY_APPROVED=true`.

The Coolify API token is used only in memory for the fixed staging application. Acceptance credentials are supplied as protected GitHub environment secrets and are passed to the harness process; they are never written to the repository or printed. The service-role key is not fetched from Coolify by this workflow.

## Required protected secrets

Configure these in the GitHub `legacy-fortress-staging` environment, not as repository files:

- `COOLIFY_BASE_URL`
- `COOLIFY_API_TOKEN`, scoped to the staging application if the Coolify installation supports application-level tokens
- `STAGING_SUPABASE_ANON_KEY`
- `STAGING_SUPABASE_SERVICE_ROLE_KEY`

The owner must verify that both Supabase keys belong to `supabase-test.mylegacyfortress.com`. Do not use `.env.local`, `.env.phase1.local`, production values, or the unrelated external Supabase Cloud project.

Enable required reviewers for the environment. Do not expose secret values in workflow logs, issue comments, artifacts or chat. Rotate/revoke the Coolify token and GitHub environment secrets through their respective control planes if access is suspected to be compromised.

## Normal operation

From GitHub Actions, choose **Legacy Fortress staging release**, enter the exact pushed commit SHA, and approve the protected environment. The workflow performs:

1. exact checkout verification;
2. dependency installation;
3. staging-only Coolify deployment;
4. exact live SHA/environment verification;
5. hosted IDV acceptance and synthetic cleanup.

For read-only status from a trusted environment with the protected Coolify variables loaded:

```bash
EXPECTED_STAGING_SHA=<commit> npm run staging:ops -- status
```

For verification without deployment:

```bash
EXPECTED_STAGING_SHA=<commit> npm run staging:ops -- verify
```

The workflow is preferred because it keeps acceptance secrets in GitHub's protected environment. Local operators should not copy those secrets into a developer terminal.

## Failure and rollback

The workflow fails closed when Coolify identity, branch, staging origin, environment markers, or live SHA do not match. It never restarts Docker, prunes resources, touches Supabase services, or deploys production.

If the new staging build is unhealthy, stop acceptance. Use the Coolify staging application's existing deployment history to roll back only that application to the last known-good staging commit, then run the workflow again with that exact rollback SHA. Do not delete images/volumes or use host-wide recovery commands.

## Explicit production boundary

This mechanism has no production UUID, domain, credential or deployment command. Production remains read-only and out of scope. A token or secret that cannot be proven staging-only must not be used.
