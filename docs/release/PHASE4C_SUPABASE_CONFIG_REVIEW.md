# Phase 4C Supabase Config Review

Date: 2026-07-13

## File Reviewed

`supabase/config.toml`

## Classification

The current dirty changes are local-UAT configuration and should not be committed or deployed without separate approval.

## Changed Categories

- Local project identity changed to an isolated Legacy Fortress UAT identity.
- Local API, database, shadow database, pooler, Studio, Inbucket/Mailpit and analytics ports moved to the `554xx` range.
- Local auth site URL changed from the production URL to the local app URL.
- Local auth redirect URLs now include `127.0.0.1:3012` and `localhost:3012`.
- Edge runtime is disabled locally.
- Analytics is disabled locally.

## Why They Exist

These changes allow Legacy Fortress to run beside other local Supabase projects and avoid collision with another local stack.

## Git Guidance

Do not include this file in a general release commit. If a team wants a committable local Supabase profile, create a reviewed template or document the local override pattern separately.

## Hosted UAT Implications

Hosted UAT must configure equivalent categories in the hosted Supabase/Coolify environments, not by reusing this local config:

- UAT auth redirect URLs.
- UAT email capture or allowlist settings.
- UAT storage buckets.
- UAT database project.
- UAT app URL.

## Production Risk

Committing this file as-is risks local-only ports, localhost auth redirects, local site URL, disabled runtime services and local project identity leaking into shared setup expectations.
