# Coolify UAT Environment Specification

Date: 2026-07-13

## Production

Production must remain unchanged in Phase 4B:

- Live domain: `https://legacy-fortress.vercel.app` is documented; any Coolify live domain/branch is not proven from repo truth.
- Production branch: `main` is documented for Vercel.
- Production Supabase, storage, email, billing, secrets and logs: do not inspect, copy or modify in Phase 4B.

## UAT

Recommended target:

- Separate Coolify application resource.
- Branch: `uat-remediation-preview`.
- Preferred domain: `uat.legacyfortress.co.uk`.
- Separate Supabase project or otherwise isolated database.
- Separate auth users.
- Separate storage buckets.
- Separate email capture or restricted sender/recipient allowlist.
- Stripe test mode only or billing disabled.
- UAT-only app URL, redirect URLs, secrets, logs and backups.
- Synthetic users/data only.
- Public access protection and no indexing.

A subdomain alone does not provide data isolation. UAT isolation is only proven when database, auth, storage, email, billing and secrets are all separate from production.

## Local

- App: `http://127.0.0.1:3012`.
- Local Supabase category: isolated local stack at `127.0.0.1:55421`.
- Local env category: `.env.phase1.local`.
- Local data: synthetic only.

## Required Owner Inputs

- Confirm DNS/subdomain ownership and setup.
- Confirm UAT Supabase target and storage bucket isolation.
- Confirm UAT email strategy.
- Confirm billing disabled or test-mode credentials.
- Confirm backup owner and rollback decision-maker.
