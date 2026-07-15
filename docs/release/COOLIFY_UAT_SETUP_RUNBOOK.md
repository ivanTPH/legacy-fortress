# Coolify UAT Setup Runbook

Date: 2026-07-13

Operator checklist. Do not include secret values in this document.

1. Create a second Coolify application resource.
2. Select the Legacy Fortress repository.
3. Select branch `uat-remediation-preview`.
4. Use Node/NPM build method.
5. Set Node version 20.
6. Set install command: `npm ci`.
7. Set build command: `npm run build`.
8. Set start command: `npm run start`.
9. Configure platform `PORT` and verify Next listens on it.
10. Add domain `uat.legacyfortress.co.uk` only after DNS is ready.
11. Enable HTTPS.
12. Configure UAT-only environment variables from `PHASE4B_ENVIRONMENT_VARIABLE_MATRIX.md`.
13. Configure separate UAT Supabase, storage, auth redirects and service-role secret.
14. Configure health check `/api/health`.
15. Configure deployment timeout suitable for `next build`.
16. Do not configure persistent storage unless a specific runtime need is identified.
17. Configure database backups/checkpoints before migrations.
18. Configure log retention.
19. Disable automatic deployment initially.
20. Add access protection and prove the Phase 4C UAT banner/noindex controls from `PHASE4C_UAT_PRESENTATION_CONTROLS.md`.
21. Perform first deployment.
22. Run migration history check.
23. Apply approved migrations only after backup and rollback owner approval.
24. Run hosted UAT test plan.
25. Record commit SHA, deployment timestamp and rollback target.

Owner/operator actions not proven from repo truth: Coolify DNS setup, HTTPS certificate state, UAT Supabase credentials, hosted email capture, billing disable/test-mode settings and access protection.

## Phase 4C Gate Additions

- Run `scripts/validate-uat-environment.mjs` with UAT-only environment variables loaded before deployment.
- Confirm the live/current Coolify application repository, branch, commit SHA and auto-deploy setting before creating a second UAT app.
- Use a second Coolify application for UAT; do not repoint the current live application.
- Confirm the UAT app displays `UAT / TEST ENVIRONMENT` and emits noindex/nofollow metadata.
- Confirm `/api/health` and `/api/health/schema` pass after production start.
- Confirm owner access to `/admin` using synthetic admin users only.

## Phase 4D Pre-Push Additions

- Complete `PHASE4D_LIVE_COOLIFY_OWNER_VERIFICATION.md` before any push.
- Run `npm run uat:validate` with UAT-only variables loaded; it must pass without printing values.
- Exclude `supabase/config.toml` unless separately approved in `PHASE4D_SUPABASE_CONFIG_DISPOSITION.md`.
- Resolve the potential credential-history issue in `PHASE4D_CREDENTIAL_REMEDIATION_DECISION.md` before push.
- Review `PHASE4D_UPGRADE_PATH_MIGRATION_EVIDENCE.md` and rerun any blocked DB-level post-query verification before deployment.
