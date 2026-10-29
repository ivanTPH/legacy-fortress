# AI Project State

Last reviewed: 2026-07-10 15:03 BST.

## Project Purpose

Legacy Fortress is an estate-record vault for storing personal, legal, finance, property, business, digital, possession, document, contact, executor, and linked-access information. Admin/probate/support capabilities exist, but are a separate operational release track and are not yet production-ready.

## Architecture Overview

- Framework: Next.js App Router with React and TypeScript.
- Backend/data: Supabase Auth, Postgres, Storage, RLS, local Supabase CLI configuration.
- Main UI pattern: shared dashboard/category workspaces, canonical asset services, shared attachment gallery, canonical contacts with compatibility surfaces.
- Styling: global CSS in `app/globals.css` plus inline component styles.
- Inferred: npm is the package manager. There is no package manager field or lockfile detected in this checkout.

## Technology Stack

- `next`, `react`, `react-dom`
- `@supabase/supabase-js`
- TypeScript
- ESLint with `eslint-config-next`
- Playwright for browser tests
- Node `--test` for focused integration/static tests

## Important Directories

- `app/`: Next.js routes, route handlers, layouts, auth pages, dashboard pages.
- `components/`: shared UI/workspace/admin/contact/document/record components.
- `lib/`: Supabase clients, auth/session, assets, contacts, admin, backend contracts, validation and utility modules.
- `supabase/`: local Supabase config and migrations.
- `tests/`: Node tests and Playwright specs.
- `docs/`: UAT, release, staging, architecture and remediation notes.
- `scripts/`: smoke, route, release and validation scripts.

## Principal Routes And Workflows

- Public/auth: `/`, `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/demo`, `/invite/accept`.
- Customer vault: `/dashboard`, `/finances`, `/finances/bank`, `/finances/pensions`, `/finances/investments`, `/finances/insurance`, `/finances/debts`, `/legal`, `/legal/[category]`, `/property`, `/business`, `/vault/digital`, `/vault/personal`, `/contacts`, `/access-requests`, `/profile`.
- Admin/prototype: `/internal/admin`, `/internal/admin/prototype/*`, plus internal admin APIs.

## Legal-Wills Workflow

Route: `/legal/wills`, add mode supported by `/legal/wills?add=1`.

Current design direction:

- Side menu `Legal` opens the legal dashboard.
- Legal dashboard card opens Wills or starts an add flow.
- Wills form captures will title, optional document upload, executor/contact name, email, phone and role.
- Email format validation exists for linked legal contacts.
- Contacts are persisted through canonical contact/link paths, with compatibility projections.
- Recent UI remediation made Wills layout more compact, added save confirmation, and displayed linked people without showing email/phone on the record card.

Known gap: general contact invitation and acceptance exists, but asset-specific Wills invitation sending, open/read tracking, and per-record invitation audit proof are not confirmed as complete.

## Data Model Summary

Canonical and compatibility surfaces include:

- `assets`, `documents`, storage-backed attachment metadata.
- `records`, `attachments`, `record_contacts` as compatibility/universal record surfaces.
- `contacts`, `contact_links`, `contact_invitations`.
- `access_grants`, role assignments and probate/admin tables in newer migrations.
- `audit_events` append-only admin audit foundation.
- `section_entries` remains a legacy compatibility surface and should not be extended without explicit approval.

## Authentication And Permissions

- Supabase Auth with PKCE browser sessions.
- Local email confirmation is enabled in `supabase/config.toml`; local email is expected via Inbucket/Mailpit.
- Admin capabilities use server-side checks and admin role/capability modules.
- Linked access uses scoped grants; do not weaken RLS or client/server guards.

## Integrations

- Supabase local stack for Auth, Postgres, Storage and local email capture.
- Vercel is used for hosted deployment but is out of scope unless explicitly approved.
- Stripe/billing readiness exists as placeholders or guarded server routes; do not use live payment services in local UAT.
- OAuth provider variables exist as placeholders; local testing should avoid real provider flows.

## Environment Structure

List variable names only; never copy values:

- Supabase browser: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Supabase admin: `SUPABASE_SERVICE_ROLE_KEY`
- Optional migration/checks: `SUPABASE_DB_URL`
- App/test URLs: `NEXT_PUBLIC_APP_URL`, `BASE_URL`, `PLAYWRIGHT_BASE_URL`, `PORT`
- Environment markers: `LEGACY_FORTRESS_ENV`, `VERCEL_ENV`, `NODE_ENV`
- Test controls: `NEXT_PUBLIC_ENABLE_TEST_PERSONAS`, `ENABLE_INTERNAL_TEST_LOGIN`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`, `SMOKE_*`
- Billing/providers: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CUSTOMER_PORTAL_URL`, `GOOGLE_CLIENT_ID`, `APPLE_CLIENT_ID`
- Supabase provider secrets referenced by config: `SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN`, `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET`

Known local mechanism: load ignored `.env.phase1.local` before `PORT=3012 npm run dev`. Plain `.env.local` has previously been documented as pointing to hosted Supabase and must not be assumed safe for local UAT.

## Local Development Procedure

1. Confirm branch and dirty state.
2. Confirm local Supabase is running for Legacy Fortress only.
3. Load the approved local env file without printing values.
4. Start app on port `3012`.
5. Test only `http://127.0.0.1:3012`.
6. Use synthetic local accounts and data only.

Expected local services:

- App: `http://127.0.0.1:3012`
- Supabase API: `http://127.0.0.1:55421`
- Supabase DB: local Postgres on port `55422`
- Studio: `http://127.0.0.1:55423`
- Local mail: `http://127.0.0.1:55424`

## Validation Commands

- `npm run lint`
- `npm run build`
- `npm run test:stabilisation`
- `npm run test:core`
- `npm run test:e2e`
- Targeted examples:
  - `node --test tests/legal-linked-contacts.test.mjs`
  - `node --test tests/category-dashboard-consistency.test.mjs`
  - `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 npx playwright test <spec> --project=desktop-chromium`

## Deployment Overview

Vercel production exists at `https://legacy-fortress.vercel.app`. Deployment, branch creation, commits, pushes, hosted migrations and production smoke tests require explicit user approval. Production URL references in docs/config do not grant permission to access or mutate production.

## Production-Safety Boundaries

- Do not use real user accounts, customer data, production databases, live email, SMS, Stripe, or production storage.
- Do not expose secrets or environment values.
- Do not apply migrations to hosted projects without a named approval, backup/checkpoint, rollback owner and target-isolation proof.
- Treat production as read-only unless a separate approved deployment task says otherwise.

## Coding Conventions

- Prefer shared/canonical components and services.
- Keep page-specific special cases small and justified.
- Use existing `Icon`, `AttachmentGallery`, canonical asset/contact helpers, and route/config patterns.
- Preserve RLS, server-side authorization and auditability.
- Avoid creating new legacy persistence paths or duplicate contact models.
- Add focused tests proportional to risk.

## Key Design Decisions

- Customer vault and operational admin/probate are separate release tracks.
- Category dashboards should provide consistent navigation into record lists/forms.
- Contacts should converge through canonical contacts/contact links/contact invitations.
- Attachments should use shared attachment/document architecture.
- Admin/prototype routes must be gated or labelled as non-operational until production-ready.

## Known Issues And Risks

- Large dirty working tree with many prior remediation files; review before staging or committing.
- `supabase/config.toml` is local-focused but contains production redirect URL references.
- Plain `.env.local` is not trusted for isolated local UAT.
- Wills/contact invitation UI does not yet prove asset-specific email sending, read tracking or audit-backed acceptance.
- Some admin/probate pages are prototype or partial unless documented otherwise.
- Compatibility surfaces (`section_entries`, `records`, `attachments`, `record_contacts`) remain active.

## Current UAT/Remediation Status

See `docs/UAT_REMEDIATION_TODO.md`, `docs/BUILD_AND_RELEASE.md`, `docs/KNOWN_TECH_DEBT.md`, and `docs/ADMIN_BACKOFFICE_DELIVERY_PLAN.md`.

Recent local work focused on auth/session, CSP/local Supabase, CRUD dashboards, contacts, attachments, admin Phase 1/2B foundations, linked-access revocation proof, staging readiness documentation, and UI polish for dashboard/category/Wills forms.

## Glossary

- Vault: a user estate-record workspace.
- Asset: canonical saved item such as bank account, property, will, document or possession.
- Record: legacy/universal saved item; may be compatibility-backed.
- Executor: person assigned estate responsibility.
- Linked access: scoped view-only access granted to another user/contact.
- Probate reviewer: operational role reviewing verification/probate requests.
- Audit event: append-only operational event record.
- UAT: user acceptance testing with synthetic local data.

