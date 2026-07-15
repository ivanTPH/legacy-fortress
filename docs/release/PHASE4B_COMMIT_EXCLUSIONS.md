# Phase 4B Commit Exclusions And Secret Review

Date: 2026-07-13

## Must Exclude

- `.env.local`, `.env.phase1.local`, `.env.phase1.local.raw`, `.env.staging.local`, `.env.production`, `.env.production.local`, and all secret-bearing `.env*` files.
- `.next/`, `.vercel/`, `node_modules/`, `test-results/`, `playwright-report/`, `blob-report/`, `tsconfig.tsbuildinfo`, `next-env.d.ts`.
- `supabase/.temp/`, `supabase/.branches/`, local storage objects, local database dumps, `*.dump`, `*.backup`, `*.local.sql`.
- Screenshots, browser traces, videos, temporary scripts and generated reports unless specifically approved as documentation evidence.
- `supabase/config.toml` unless separately approved, because it currently contains isolated local UAT project identity, local ports, local email/redirect behaviour and disabled local runtime features.
- Real credentials, real user fixtures, local synthetic passwords and any hosted service values.

## Gitignore Review

Current `.gitignore` excludes secret-bearing env files and generated/local artefacts, while allowing `.env.example` and `.env.staging.example` to be tracked as placeholder templates. This is the right direction. No further `.gitignore` change is required from Phase 4B unless a future tool creates another generated directory.

Observed behaviour:

- `.env.local`: ignored.
- `.env.phase1.local`: ignored.
- `.env.staging.local`: ignored.
- `.env.example`: not ignored.
- `.env.staging.example`: not ignored.

## Secret-Oriented Inspection

Commands used:

- `rg` for common live key, webhook, service-role, password and private-key patterns, excluding ignored env files and generated folders.
- `git check-ignore` for env files.
- `git show HEAD:docs/BUILD_AND_RELEASE.md` to determine whether a credential-like documentation example existed in HEAD.

Findings:

- No `.env` value was printed or copied into a report.
- No private key block, Stripe live-key pattern or webhook secret pattern was found in application code during the Phase 4B scan.
- Several scripts and tests reference secret variable names such as service-role, smoke-owner and test-password variables. These are expected categories, not values.
- `docs/BUILD_AND_RELEASE.md` contained a credential-like example in HEAD and in the dirty working tree. Phase 4B redacted the working-tree copy to placeholders. Because the old value exists in Git history, owner review is required to decide whether any account password rotation or history remediation is needed.
- `supabase/migrations/20260713150000_enable_rls_vault_asset_tables.sql` contains a comment referencing prior cloud application context. Treat as review-sensitive and remove or neutralise before commit if it exposes environment detail.

## Remediation Required Before Commit

1. Keep the Phase 4B redaction in `docs/BUILD_AND_RELEASE.md`.
2. Review whether the historical credential-like value represented a real account password. If yes, rotate that account and consider history remediation.
3. Review and neutralise hosted-context comments in `20260713150000_enable_rls_vault_asset_tables.sql` before including it.
4. Confirm no ignored env file is staged.
5. Stage with explicit file lists only, never `git add .`.
