# Phase 4B UAT Access And Indexing

Date: 2026-07-13

## Required Access Protection

Preferred controls:

- Cloudflare Access.
- Coolify-supported basic authentication or reverse-proxy protection.
- Application-level UAT allowlist only if implemented with server-side checks.

## Required Presentation

- Visible UAT banner.
- `noindex, nofollow`.
- Synthetic-data disclosure.
- Restricted account creation.
- No public links from production/marketing.
- No production analytics contamination.

## Current Repo State

No environment-driven UAT banner or noindex metadata was implemented in Phase 4B. This is a blocker before public UAT exposure unless Coolify/reverse-proxy controls provide equivalent access restriction and indexing protection.
