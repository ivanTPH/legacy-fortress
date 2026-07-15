# Hosted Staging Readiness, Deployment Safety, and Canonical Contact Plan

Date: 2026-07-04
Status: Partially ready for hosted staging UAT, with named blockers
Scope: staging deployment readiness, migration safety, hosted browser/RLS proof plan, and canonical contact architecture.
Related docs: [BUILD_AND_RELEASE.md](./BUILD_AND_RELEASE.md), [UAT_REMEDIATION_TODO.md](./UAT_REMEDIATION_TODO.md), [KNOWN_TECH_DEBT.md](./KNOWN_TECH_DEBT.md), [ADMIN_BACKOFFICE_DELIVERY_PLAN.md](./ADMIN_BACKOFFICE_DELIVERY_PLAN.md), [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md), [ATTACHMENT_AND_DOCUMENT_ARCHITECTURE.md](./ATTACHMENT_AND_DOCUMENT_ARCHITECTURE.md).

## Executive Summary

Legacy Fortress has enough local evidence to continue controlled internal UAT, but hosted staging is not yet proven. No hosted staging deployment, hosted migration, hosted browser test, hosted Supabase access, Vercel access, Stripe access, production data access, live-user access, commit, push or deployment was performed for this phase.

The hosted staging release gate remains blocked until a separate staging Supabase/Vercel environment is supplied through secure local configuration, verified as isolated from production, backed up, migrated in order, and independently re-proven with synthetic accounts.

| Environment | Current decision | Reason |
|---|---|---|
| Local internal UAT | Suitable for controlled internal UAT | Local browser, API, RLS, lint and build proof exists for the current remediation stack. |
| Hosted staging | Partially ready, with named blockers | Documentation, packaging guidance and migration plan are ready; no hosted staging target was available or tested in this phase. |
| External pilot | Not ready | Requires hosted staging proof, rollback owner, security review and synthetic hosted UAT evidence. |
| Production | Not ready | Requires staging pass, production release gate, rollback plan, privacy/security review and explicit deployment approval. |

## Hosted Staging Prerequisites Register

| Area | Required before staging UAT | Current repository evidence | Status |
|---|---|---|---|
| Package manager | Use npm and `package-lock.json`; do not switch package managers. | `package.json`, `package-lock.json`. | Ready |
| Framework/build | Next.js app; use `npm run build` and `npm run lint`. | `package.json` scripts use `next build --webpack` and `eslint`. | Ready |
| Hosted environment | Separate staging Vercel project or Preview deployment, never production. | No hosted target contacted in this phase. | Blocked |
| Supabase project | Separate staging Supabase project with distinct API URL, database, storage and auth. | Local config uses isolated UAT ports; hosted values must come from secure env only. | Blocked |
| Environment files | Commit only safe templates; put secrets in `.env.staging.local` or platform env store. | `.env.staging.example` is safe template only. `.env*` secret files remain ignored. | Ready with discipline |
| Supabase public client | `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must point to staging. | Names documented; values must not be committed or printed. | Awaiting secure values |
| Server admin key | `SUPABASE_SERVICE_ROLE_KEY` must be staging-only and server-only. | Server code expects service-role access for health/admin routes. | Awaiting secure value |
| App URL/redirects | `NEXT_PUBLIC_APP_URL`, auth callback and reset URLs must use exact staging origin. | Local config contains local and production redirect examples; staging redirects must be configured separately. | Blocked |
| CSP | Production/Preview CSP must not allow arbitrary HTTP origins. Staging Supabase HTTPS origin is covered by `connect-src https:`. | Local-only `127.0.0.1:55421` allowance is development-only. | Ready, verify after deploy |
| Email | Sign-up and password-reset emails must work in staging with synthetic users. | Local Mailpit proof exists; hosted provider/rate limits not proven. | Blocked |
| Storage | Private `vault-docs` and avatar storage must exist with signed access only. | Local storage proof exists; hosted buckets/policies must be checked after migrations/config. | Blocked |
| Stripe | No live Stripe keys or billing mutation unless a separate billing phase approves it. | Billing code exists but this scope does not require Stripe. | Exclude unless approved |
| Admin roles | Synthetic staging admin users only; no real admin users. | Local Phase 1/2B roles proven. | Requires hosted seed |
| Backup | Staging DB backup/checkpoint and restore procedure must be documented before migration. | Not available in this phase. | Blocked |
| Rollback owner | Named rollback approver and action owner must be recorded. | Not available in this phase. | Blocked |
| Synthetic data | Only `staging-*` synthetic accounts and fictional records. | Local conventions exist from Phases 1-4. | Ready |

## Deployment Safety Findings

Production-safe candidate areas for a future staging branch, after normal review of the dirty tree:

- Application code under `app/`, `components/`, `lib/`, `proxy.ts`, and `next.config.ts` that implements approved auth, record, attachment, contacts, admin foundation, probate and linked-access fixes.
- Automated tests under `tests/` that use synthetic accounts and configurable `PLAYWRIGHT_BASE_URL`.
- Documentation under `docs/`.
- Ordered Supabase migrations required for the tested feature set.
- Safe environment templates such as `.env.example` and `.env.staging.example`.

Files and patterns requiring exclusion or separate review:

| File/pattern | Required treatment | Reason |
|---|---|---|
| `.env*` except approved examples | Never commit | May contain hosted URLs, keys, tokens or local-only secrets. |
| `.env.staging.local` | Never commit | Staging secret file. |
| `supabase/config.toml` | Exclude unless separately reviewed | Current dirty file contains isolated local UAT project id, local ports, local site URL, local mail settings and local redirect behaviour. |
| `tsconfig.json` | Review before staging commit | Prior audit flagged formatting/generated include drift. |
| `test-results/`, screenshots, traces | Never commit | Generated artifacts and possible sensitive browser output. |
| `.next/`, build output, caches | Never commit | Generated local artifacts. |
| Local seed scripts or generated seed data | Do not deploy as production data | Synthetic UAT data must remain local or staging-only. |
| Storage objects/dumps/backups | Never commit | Could contain documents or sensitive metadata. |

The current local UAT setup uses local Supabase and mail ports only. Those values must not be copied into Vercel or hosted Supabase configuration.

## Migration Readiness Checklist

Before applying any hosted migration:

1. Verify the target Supabase project id and API URL are staging, not production.
2. Capture current hosted migration history.
3. Confirm backup/checkpoint exists and restore procedure is documented.
4. Confirm rollback owner and approval path.
5. Apply only the reviewed missing migrations in timestamp order.
6. Run schema/RLS/storage checks immediately after each security-sensitive migration.
7. Stop and rollback or restore if unrelated owner data becomes readable, revoked access persists, audit append-only protections fail, owner access regresses, or admin access regresses.

| Migration | Purpose | Hosted staging notes | Rollback approach |
|---|---|---|---|
| `20260304092034_init_schema.sql` / `20260304142711_init_schema.sql` | Initial schema foundation | Fresh staging only; verify existing hosted history before applying. | Restore checkpoint. |
| `20260304143200_create_profile_trigger.sql` | Profile trigger | Verify profile creation after sign-up. | Restore checkpoint or disable trigger with approval. |
| `20260306191500_safe_schema_hardening.sql` | Baseline schema hardening | Verify no app route regressions. | Restore checkpoint. |
| `20260306233000_add_vault_tables_property_business_digital_profile.sql` through `20260315171000_normalize_financial_provider_logo_paths.sql` | Vault categories, universal record pattern, canonical wallet/asset/document model | Required for current customer-vault flows. | Restore checkpoint; no ad hoc partial revert. |
| `20260321123000_fix_asset_payload_pgcrypto_schema_qualification.sql` and `20260323153000_ensure_asset_payload_pgcrypto_runtime.sql` | Runtime asset payload crypto compatibility | Required before canonical asset writes. | Restore checkpoint. |
| `20260323183000_canonical_contacts_phase1.sql` | Canonical `contacts`, `contact_links`, indexes and RLS | Required contact foundation. Verify owner-only contact writes and no cross-owner reads. | Restore checkpoint. |
| `20260323191500_backfill_canonical_contacts_phase2.sql` | Backfill legacy record contacts/invitations to canonical contacts | Review row counts before/after on staging. | Restore checkpoint; preserve pre-migration export. |
| `20260323201500_contacts_user_id_compat.sql` | Compatibility `user_id` support | Keep until legacy reads are retired. | Restore checkpoint. |
| `20260324103000_contact_invitation_view_only_access.sql` | Linked account grants and initial linked-read policies | Required but later tightened by `20260703153000`. Verify it is followed by scope enforcement before pilot. | Restore checkpoint. |
| `20260324112000_fix_public_contact_invitation_profile_join.sql` and `20260324114000_fix_accept_contact_invitation_function.sql` | Invitation acceptance fixes | Verify email invite acceptance with synthetic staging users. | Restore checkpoint. |
| `20260324162000_admin_ops_access.sql` | Initial admin user table | Required before Phase 1 admin foundation. Seed only synthetic admins. | Restore checkpoint. |
| `20260324175500_linked_profile_contact_address_read.sql` | Linked profile/contact address read compatibility | Verify it does not expose unrelated profile data. | Restore checkpoint. |
| `20260324190000_owner_plan_framework.sql` | Owner plan framework | Billing/payment remains out of scope. | Restore checkpoint. |
| `20260328143000_add_vault_preferences_to_user_profiles.sql`, `20260328184500_contact_validation_overrides.sql`, `20260329091500_add_accessibility_preferences_to_user_profiles.sql` | Profile preferences, contact validation and accessibility support | Verify settings/profile smoke. | Restore checkpoint. |
| `20260630170000_admin_phase1_foundation.sql` | Admin roles and append-only audit events | Verify `audit_events` RLS, indexes, insert allowed, update/delete rejected. | Restore checkpoint; do not delete audit evidence without approval. |
| `20260701193000_admin_phase2b_probate_cases.sql` | Probate cases and case evidence | Verify role denial, evidence signed access and audit timeline. | Restore checkpoint. |
| `20260703153000_linked_access_scope_enforcement.sql` | Tight scoped linked-access RLS for records/documents/storage | Security-critical. Must be applied before hosted linked-access UAT or pilot. | Restore checkpoint immediately if unrelated owner data is visible or revoked access persists. |

## Hosted Browser, API, and RLS UAT Plan

Run these tests with synthetic staging users only. Do not use Ivan's account, production users, real customer data, real documents or live payment details.

| ID | Workflow | Required proof |
|---|---|---|
| AUTH-01 | Sign-up, email confirmation, sign-in, sign-out, password reset | Browser proof and staging email receipt/link proof. |
| AUTH-02 | Session persistence and protected deep links | Refresh and re-login return to requested route without indefinite loading. |
| DASH-01 | Dashboard counts/search | Baseline, create/edit/delete record, refresh/re-login, expected counts and search results. |
| CRUD-01 | Legal, finance, property, business, personal, cars, employment, identity documents | create -> visible retrieval -> refresh -> search -> edit -> delete/archive. |
| ATT-01 | Attachments | PDF/image/DOCX upload, card, preview/download/print/fallback, replace, remove, refresh/re-login. |
| CONTACT-01 | Canonical contacts | create, search, edit, role group, invite, remove/revoke without stale grouped values. |
| EXEC-01 | Executor/trusted contact linked access | invitation acceptance, scoped view-only access, unrelated data denial. |
| ADMIN-01 | Phase 1 admin foundation | non-admin denial, role-specific allowed/denied actions, audit append-only proof. |
| PROBATE-01 | Phase 2B probate | request info, review, approve with reason, access grant, revoke, audit timeline. |
| RLS-01 | Direct API/RLS proof | linked user cannot query unrelated owner records, documents, storage, search or dashboard metadata. |
| REVOCATION-01 | Revocation | denied after refresh, direct URL, fresh session, API request and browser back navigation. |
| MOBILE-01 | Mobile smoke | sign-in, dashboard, one canonical flow, one legacy/section flow, contact, attachment, navigation. |

The hosted staging gate passes only when browser proof, direct API/RLS proof, lint, build, relevant automated tests, schema health and rollback evidence all pass.

## Canonical Contact Architecture Plan

The repository already has a canonical contact direction:

- `public.contacts` stores owner-scoped people/contact records.
- `public.contact_links` links contacts to records, invitations or compatibility contexts.
- `public.record_contacts` and `public.contact_invitations` contain legacy and invitation-specific relationship data but now link toward `contacts`.
- `public.role_assignments`, `public.account_access_grants`, `public.verification_requests` and `public.probate_cases` represent executor/access/probate state.
- Legacy flows and some seeded compatibility contexts still exist, especially where `section_entries` or older invitation flows do not yet have a full canonical link.

Use one owner-scoped canonical person/contact identity and attach roles or workflow states to that identity. Do not create page-specific contact tables.

| Concern | Canonical location |
|---|---|
| Person/contact profile | `contacts` |
| Contact linked to a record or context | `contact_links` and, where still required, `record_contacts` compatibility rows |
| Invitation lifecycle | `contact_invitations` linked to `contacts` |
| Executor/trusted role assignment | `role_assignments` linked to `contacts` or invitation/contact context |
| Linked-access permission | `account_access_grants` linked to owner, linked user, contact and approved scope |
| Probate workflow | `probate_cases` linked to contact, invitation, role assignment, verification request and access grant |
| Evidence/document attachment | canonical `documents` plus shared `AttachmentGallery`, never public URLs |
| Audit | append-only `audit_events` |

One contact may be a trusted contact, executor, next of kin, beneficiary, professional advisor, requester, reviewer context or emergency contact. The architecture should support multiple roles without duplicating the person:

1. Keep `contacts` as the single person row per owner and normalized email where possible.
2. Store contextual role links in `contact_links`, `record_contacts`, `role_assignments` and `probate_cases` rather than cloning the contact.
3. If a future migration adds a dedicated `contact_roles` table, make it an owner-scoped canonical extension, not a page-specific model.
4. Keep legacy compatibility reads until every route has browser proof on the canonical path.

Duplicate prevention and merge policy:

- Deduplicate only within the same owner workspace.
- Prefer exact normalized email match; otherwise require a safe manual review signal for name/phone/address similarity.
- Never merge contacts across different owners.
- Preserve source metadata and old ids in audit metadata or compatibility links.
- Contact merge/split actions must be audited before release.

RLS and permission model:

- Owners can read/write their own contacts.
- Linked users can read only contacts explicitly associated with their approved access grant/scope.
- Reviewers/admin users access contact data only through server-side capability-checked APIs.
- Storage/document access must remain signed, scoped and audited.
- No client-side-only permission checks.

Migration and backfill path:

1. Inventory all existing contact-like sources: `contacts`, `contact_links`, `record_contacts`, `contact_invitations`, `role_assignments`, `verification_requests`, `probate_cases`, `section_entries.details`, and any page-specific contact fields.
2. Create a read-only reconciliation report before writing data.
3. Backfill missing canonical contacts owner-by-owner with synthetic/staging proof first.
4. Attach legacy rows to canonical contact ids through existing compatibility columns.
5. Add browser proof that contacts, trusted contacts, executors, invitations, probate cases and linked-access grants all show the same edited name after refresh/re-login.
6. Only then plan retirement of obsolete compatibility reads.

Canonical contact release acceptance criteria:

- A contact edit updates contacts search, trusted contacts, executor groups, invitations and probate/access views without contradictory names.
- Deleting/removing a contact archives or detaches role contexts safely without orphaning audit or evidence.
- A linked executor sees only approved contact/context data.
- All contact mutations emit audit events where operationally relevant.
- Tests cover create, search, edit, role assignment, invitation, grant, revoke and remove.

## Known Hosted Staging Blockers

1. No secure hosted staging environment values were available in this phase.
2. No hosted migration history was inspected in this phase.
3. No hosted backup/checkpoint or rollback owner was confirmed in this phase.
4. No hosted auth/email/storage proof was run in this phase.
5. `supabase/config.toml` remains local-UAT-specific and must not be used as hosted staging configuration without review.
6. `tsconfig.json` remains review-sensitive from prior packaging audit.
7. External pilot and production remain blocked until hosted staging passes the UAT matrix above.

## Rollback Requirements

Hosted staging rollback must include:

- Vercel rollback to the previous Preview/staging deployment.
- Supabase database restore from pre-migration checkpoint for failed schema/security migrations.
- Storage cleanup of synthetic staging files if safe and approved.
- Audit preservation unless a full staging restore is approved.
- Explicit incident note when rollback is triggered by access-control or privacy failure.

## Current Evidence

Local evidence exists in [UAT_REMEDIATION_TODO.md](./UAT_REMEDIATION_TODO.md) for Phases 1-4 and local release package review. This document does not claim hosted evidence. Hosted staging must be independently proven.

2026-07-04 documentation/readiness verification:

| Check | Result |
|---|---|
| Focused node suite for auth, dashboard, contacts, admin, probate, linked access, attachments and architecture | Passed 44/44 |
| `npm run test:stabilisation` | Passed 34/34 |
| `npm run lint` | Passed |
| `npm run build` | Passed |
| Local `/api/health/schema` | Passed with `ok: true` |
| Auth/session/linked-access Playwright gate with ignored local env wrapper | Passed 8/8 |
| Focused executor/legal/attachment/mobile Playwright checks | Passed 4/4 in the grouped run |
| Dashboard count Playwright check | One grouped run saw a local count mismatch, then passed 1/1 in isolated one-worker rerun |

The Playwright runs used the ignored local environment wrapper and `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012`. No hosted target was contacted by these checks.
