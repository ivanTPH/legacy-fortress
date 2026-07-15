# Phase 4D Proposed Staging Commands

Date: 2026-07-14

These commands are proposed only. Phase 4D does not stage, commit, push or deploy.

## Pre-Stage Inspection

```bash
git status --short
git diff --stat
git diff --name-status
git diff --check
```

## Example Controlled Staging Pattern

Stage one reviewed group at a time:

```bash
git add -- package.json package-lock.json
git diff --cached --stat
git diff --cached
```

Then unstage and adjust if the diff contains unrelated changes:

```bash
git restore --staged -- package.json package-lock.json
```

## Suggested File Groups

### Dependency remediation

```bash
git add -- package.json package-lock.json
```

### UAT isolation validation

```bash
git add -- scripts/validate-uat-environment.mjs tests/uat-environment-validation.test.mjs
```

### Phase 4D documentation

```bash
git add -- docs/release/PHASE4D_LIVE_COOLIFY_OWNER_VERIFICATION.md docs/release/PHASE4D_DEPENDENCY_AUDIT_RESOLUTION.md docs/release/PHASE4D_CREDENTIAL_REMEDIATION_DECISION.md docs/release/PHASE4D_UPGRADE_PATH_MIGRATION_EVIDENCE.md docs/release/PHASE4D_SUPABASE_CONFIG_DISPOSITION.md docs/release/PHASE4D_HOSTED_UAT_ISOLATION_GATE.md docs/release/PHASE4D_FINAL_COMMIT_MANIFEST.md docs/release/PHASE4D_STAGING_COMMANDS.md
```

## Explicit Exclusions

Do not stage:

```bash
git add -- .env*
git add -- supabase/config.toml
git add -- test-results playwright-report screenshots .next node_modules
```

Do not use broad staging commands such as:

```bash
git add .
git add -A
```

## Required Review Before Any Commit

1. Confirm the staged diff contains no secrets or local-only configuration.
2. Confirm `supabase/config.toml` is absent unless separately approved.
3. Confirm `.env*` secret files are absent.
4. Run `npm run release:check`.
5. Get owner approval for the exact staged files.
