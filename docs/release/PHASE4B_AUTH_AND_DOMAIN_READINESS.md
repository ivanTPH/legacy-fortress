# Phase 4B Auth And Domain Readiness

Date: 2026-07-13

## Required UAT Auth Settings

- Supabase Site URL must be the UAT application URL.
- Allowed redirect URLs must include:
  - `https://uat.legacyfortress.co.uk/auth/callback`
  - `https://uat.legacyfortress.co.uk/reset-password`
  - `https://uat.legacyfortress.co.uk/sign-in`
- Confirmation, reset and invitation links must return to UAT only.
- OAuth callbacks must use UAT OAuth applications or remain disabled.
- UAT and production must not share auth users or cookies.

## Cookie And Domain Notes

Supabase browser sessions are origin-scoped. UAT should use `https://uat.legacyfortress.co.uk` only, not the production domain. Do not set broad cookie domains that include both UAT and production.

## Current Repo Readiness

- Local auth redirects are configured in `supabase/config.toml`; this file is local-only and not deployable UAT config.
- Vercel production/preview redirects exist in local config but do not prove Coolify UAT readiness.
- No UAT domain or UAT auth configuration is proven in repo truth.
- No UAT banner/noindex implementation was found.

## Required Proof

- Sign-up confirmation link returns to UAT.
- Password-reset link returns to UAT.
- Invitation/linked-access link returns to UAT.
- A production session does not authenticate against UAT.
- A UAT session does not authenticate against production.
