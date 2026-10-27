# Legacy Fortress development and protected TEST release

This document describes the current repository commands. It does not authorise a hosted database write or production deployment.

## Begin every session

From an isolated worktree, run `node scripts/dev/bootstrap.mjs` (or `--json`). It reads the one capability tracker, remote branch heads and public TEST version. Read the newest entry in `docs/CODEX_HANDOVER.md` and follow the next authorised task. Use `docs/AI_PROJECT_STATE.md` only for stable architecture background. The Personal Vault design authority is `design/Vault Master V5.2.dc.html`; Linked People/Vault Access use `design_handoff_legacy_fortress 5.21/` when available.

Run `node scripts/dev/preflight.mjs` before proposing a hosted change. It produces human output and an ignored, timestamped `.local-state/staging-preflight.json` report; `--json` prints the full machine-readable report. The first blocker is actionable. The cache is never accepted as write approval: the protected migration runner rechecks resource and cluster identity immediately before SQL.

## Local development

Use approved local env only, verify app `127.0.0.1:3012` and Supabase `127.0.0.1:55421` before auth/database tests. Start with `PORT=3012 npm run dev`. Use targeted `node --test` files, `npm run lint`, `npx tsc --noEmit`, and `npm run build` as appropriate. `npm run release:check -- --ci` is the mandatory local release gate. Avoid repeated browser suites for unchanged code.

## Review and TEST release sequence

1. Commit and push a coherent feature branch. Preserve unrelated work; reconcile and promote only a reviewed fast-forward or approved PR to `hosted-uat-preparation-20260715`.
2. If SQL is required, follow `docs/STAGING_DATABASE_MIGRATIONS.md` first. Verify the exact TEST resource, migration history, isolated recovery point, SQL checksum and separate owner approval. Apply one migration through the *separately protected* workflow only after it is reviewed and enabled. No app code depending on a new schema goes live first.
3. Run focused hosted database checks. The security correction must pass explicit grant scope, direct-ID/storage, revocation, locks, IDV and cross-owner cases. Release #93 additionally needs owner/linked-reader title access, original-file integrity and audit evidence. A schema-object check alone is insufficient acceptance.
4. Run `npm run release:check -- --ci` on the exact compatible app commit. Push staging and run `node scripts/staging/release-readiness.mjs <expected_sha> <required_migration_version>` to verify the committed ref and recorded schema. Dispatch the existing `.github/workflows/staging-release.yml` with that `expected_sha` through the approved GitHub Actions path (`npm run staging:release` is the existing guarded CLI). Do not call Coolify directly.
5. Confirm protected workflow success, including hosted IDV and Admin boundary checks, and compare `https://test.mylegacyfortress.com/api/version` with the approved SHA. Record release SHA, evidence and owner acceptance status in `docs/CODEX_HANDOVER.md` and `docs/CAPABILITY_BACKLOG.json` in a follow-up reviewed commit.

The application workflow remains unchanged. The proposed database workflow is disabled until the owner reviews it, configures a separate reviewer-protected TEST environment and approves the exact SQL/target. No production automation is included.
