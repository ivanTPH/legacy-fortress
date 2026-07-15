# Phase 4D Dependency Audit Resolution

Date: 2026-07-14

## Original Failure

`npm run release:check` failed at the dependency audit stage because `npm audit --audit-level=moderate` found transitive dependency advisories.

## Resolution Summary

The remediation used package overrides and a consistent lockfile/install refresh. No `npm audit fix --force` was used.

| Package | Installed Before | Fixed Version | Direct/Transitive | Runtime/Dev | Severity | Advisory | Resolution | Regression Risk |
| --- | ---: | ---: | --- | --- | --- | --- | --- | --- |
| `@babel/core` | `7.29.0` | `7.29.7` | Transitive via `eslint-config-next` / `eslint-plugin-react-hooks` | Development/build tooling | Low | `GHSA-4x5r-pxfx-6jf8` | Override to patched 7.x line | Low; build/lint/type checks cover React/Next tooling |
| `js-yaml` | `4.1.1` | `4.3.0` | Transitive via `eslint` / `@eslint/eslintrc` | Development tooling | Moderate | `GHSA-h67p-54hq-rp68` | Override to patched 4.x line | Low; lint/release gate covers ESLint config parsing |
| `ws` | `8.20.1` | `8.21.0` | Transitive via `@supabase/supabase-js` / `@supabase/realtime-js` | Runtime dependency | High | `GHSA-96hv-2xvq-fx4p` | Override to patched 8.x line | Medium-low; Supabase realtime path is runtime-adjacent and must stay in release checks |

## Current Evidence

- `npm ls @babel/core js-yaml ws` resolves to `@babel/core@7.29.7`, `js-yaml@4.3.0`, and `ws@8.21.0`.
- `npm audit --json` reports zero vulnerabilities.
- `tests/uat-environment-validation.test.mjs` passes after adding extra UAT isolation checks.

## Risk Acceptance

No risk acceptance is requested for these dependency advisories because the audit issues are fixed.

## Files

- `package.json`
- `package-lock.json`
- `scripts/validate-uat-environment.mjs`
- `tests/uat-environment-validation.test.mjs`
