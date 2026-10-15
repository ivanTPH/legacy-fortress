# Codex Handover

## Version 3 Phase 4 customer screens — 2026-10-15

- Work is isolated on `design/phase-4` in `/private/tmp/legacy-fortress-v3-phase4`; the owner's original tree and hosted environments remain untouched. Local UAT stays at 61 migrations. No new migration or deployment was made.
- Dashboard and Action Centre now share a Version 3 view backed by authorised, deduplicated live records, contacts and actions. Add to my Fortress, the six primary Vault overviews and People I Trust use the Phase 1–3 tokens/primitives. Existing record forms, invitations and persistence remain in place. Mixed-currency totals are labelled instead of summed.
- Assigned linked asset IDs now resolve their section through the caller's RLS-visible asset rows, so a verified linked user can open the assigned Property area. Legacy finance rows are filtered against record grants while canonical finance assets use asset grants. Linked Dashboard hides owner-only Add, Estate Readiness, people and other Vault areas; revoked and wrong-user reads remain denied. Synthetic authenticated browser proof passed in Chrome desktop 1440×900 and WebKit mobile 390×844, including invitation, linked activation/revocation, Action Centre review focus and admin-domain isolation. Representative actual-app screenshots are in `docs/design-implementation/screenshots/`; the full local capture set is under `/private/tmp/lf-phase4-v3-screens-20261015/`.
- Focused finance/viewer and affected source checks pass 45/45; stabilisation 81/81, TypeScript, lint (18 existing warnings) and build pass. Core is 53/54, with only the unchanged local `supabase/config.toml` `site_url` assertion. Post-test explicit local UAT read-only check: 61 ledger entries, 8 auth users, 1 wallet, and zero temporary browser users or assigned-property fixtures. The original owner tree and local UAT migration ledger were not changed.
- Remaining visual differences: the required local UAT banner and development overlay are present in captures; deeper record detail forms, the linked-context banner and some below-fold surfaces still use prior styling. Review Phase 4 screens at the owner checkpoint before any staging preview; do not merge or deploy.

## Version 3 Phase 4 local UAT migration checkpoint — 2026-10-15

- Owner-approved local-only 21 historical plus two corrective migrations were applied to explicit `127.0.0.1:55422/postgres` from `design/phase-4` base `ba9cce0`, after SHA/order, 38-ledger, fingerprints and fresh backup/clone-restore preflight. Final UAT ledger is 61 (hash `211777dddfd08a36dee58500292a9517`); no hosted/staging/production change. The original owner worktree remains untouched. Recovery archive, globals, focused logs and synthetic-only screenshots are restricted outside Git under `/private/tmp/lf-phase4-uat-migration-20261015/`.
- UAT rollback SQL: guard/RLS/identity/estate/admin 11 checks, invitation 7, privacy 4 all pass. Real local JWT anonymous/cross-user RPC denial passes. Chrome/WebKit owner, invitation, linked grant activation/revocation and admin-domain checks ran with temporary synthetic accounts, all cleaned up. Existing 8 auth users, 7 admins, 1 wallet and 134 pre-existing auth audit entries retain their fingerprints; no temporary records remain.
- Browser limitation: linked `/vault/property` redirected to `/dashboard` while the authenticated API correctly returned only the assigned property after Level 2 activation, and denied it after revocation. Positive linked-area rendering remains a Phase 4 screen acceptance item. Source checks: TypeScript, build, lint (18 existing warnings), stabilisation 81/81 pass; core 53/54 on the unchanged Supabase `site_url` assertion. Full checkpoint evidence is in `docs/design-implementation/PHASE4_SECURITY_REMEDIATION.md`.
- **Next:** owner review at this migration checkpoint, then prioritise Version 3 Dashboard, Add to my Fortress, Action Centre, six Vault areas, People I Trust and mobile. Reuse existing tokens/primitives and preserve linked security. Do not merge or deploy.

## Version 3 Phase 4 Stage A second clone-only security rehearsal — 2026-10-15

- Continued isolated `design/phase-4` from report SHA `954f5810a75de0290b16ffadbaf09dc6047416cb`; original owner worktree and hosted environments were untouched. Restored the checksum-verified local PG17.6 backup to disposable `lf_phase4_rehearsal2_20261015`, then replayed the exact final SQL from the same backup into fresh `lf_phase4_rehearsal3_20261015` after tightening the invitation exception. The final clone's 38-entry pre-migration ledger, roles, synthetic data counts and wrapper hash matched source. Original UAT is still `127.0.0.1:55422/postgres` at 38 migrations.
- Reproduced anonymous and authenticated cross-user `SECURITY DEFINER` disclosure and the `public.profiles` invitation preview failure after the first ten migrations. Applied the remaining eleven historical files in order, including the 24 August canonical `user_profiles` fix, then two new forward-only caller/grant guard migrations. Clone final ledger: 61 entries; original UAT ledger and critical row fingerprints remain unchanged.
- The corrections explicitly revoke `PUBLIC` and inherited `anon` execute on the three disclosed helpers, guard same-user/verified-linked/invitation/service-role calls, and guard indirect Level 3 presence. A second migration fixes the same grant/argument pattern discovered in later privacy helpers. Estate and retention application readers now fail closed on denied `NULL` states. No historical migration, data model or hosted service was changed.
- Three rollback-wrapped clone database suites pass: 11 guard/RLS/identity/estate/admin assertions, 7 invitation lifecycle assertions and 4 privacy assertions. The tests simulate SQL roles/JWT claims; the local API still points to source UAT, so real authenticated API/Playwright verification remains pending. Offline lockfile dependency install enabled source checks: stabilisation 81/81, TypeScript, lint (18 existing warnings) and build pass; core 53/54 on the unchanged Supabase `site_url` assertion.
- Full evidence, exact sequence, grants and residual risk are in `docs/design-implementation/PHASE4_SECURITY_REMEDIATION.md`. **Stop for owner review before any original-UAT migration.** If separately approved later, use explicit source target proof, a fresh backup and per-file ledger/object checks; only then run authenticated browser tests and resume Phase 4 screens.

## Version 3 Phase 4 Stage A clone-only rehearsal — 2026-10-15

- Verified `design/phase-4` at `99283e80e161a289fa6e616f7e5a39073538207f` and explicit local UAT source `127.0.0.1:55422/postgres`. A restricted PostgreSQL 17.6 backup of source data/schema/ledger and globals was restored to disposable database `lf_phase4_rehearsal_20261014` in the local container; the generated GraphQL wrapper ACL required one restore-only repair, which was checked against source. The original owner worktree was untouched.
- All ten owner-approved migrations applied to the clone in repository order, with 48 total clone ledger entries. Source UAT remains at 38 migrations with unchanged ledger, critical row counts and auth/admin/wallet fingerprints. No migration was applied to source; no later migration, hosted service, staging or production was touched.
- Rollback-wrapped synthetic role/RLS tests passed owner create/read, pending and unverified linked denial, verified assigned-only access, wrong-user denial and protective-lock read/write restrictions. A valid invitation preview failed because migration 8 references nonexistent `public.profiles`; the later `20260824143000` migration repairs this. Anonymous and authenticated callers can also use newly added `SECURITY DEFINER` helpers to learn another user's identity level and vault lock state despite direct row RLS. Focused source/unit tests passed 39/39, but authenticated API/browser tests did not target the clone.
- **Recommendation: requires corrections.** The ten-file candidate is not safe to apply to existing local UAT. Detailed evidence and the next clone-only correction checkpoint are in `docs/design-implementation/PHASE4_CLONE_REHEARSAL.md`. Stop before any UAT migration and request separate owner approval after corrected clone verification.

## Version 3 Phase 4 Stage A security checkpoint — 2026-10-14

- Verified remote `design/phase-3` at `49852838d60b156e38851e1de89141c4a9dadea5`; created isolated `/private/tmp/legacy-fortress-v3-phase4` on `design/phase-4`. The original owner tree and unrelated changes remain untouched.
- Read-only local audit: approved API/DB env hosts were verified as `127.0.0.1:55421`/`:55422`, local auth health was 200, TCP target and `supabase_db_legacy-fortress-web-uat` were identified. The worktree's committed `supabase/config.toml` instead points to another local stack on 54321/54322; its `supabase migration list --local` is **not** the UAT ledger. The UAT ledger has 38 repository migrations applied through `20260717120000` and 21 pending. The missing grant identity column comes from pending `20260820120000`; enterprise membership and invitation expiry are also pending.
- Proposed the smallest contiguous ten-file candidate through `20260821162000` for owner/linked/identity test readiness, conditional on a PostgreSQL 17.6 backup, verified disposable-clone restore and security rehearsal. The Mac's `pg_dump` is 16.13; the local DB container has 17.6. No migration, repair, reset, backup, synthetic user change, application-code edit or browser test was performed in Stage A. The local UAT database currently has 8 auth users, 7 admin users and 1 wallet, so reset is unacceptable.
- Product directions Q3/Q4/Q17 are recorded in `docs/design-implementation/QUESTIONS.md`. Preliminary Legal/Will source audit found Legal counts legacy `records` and canonical `assets`, while Dashboard counts `assets` and `documents`, with no shared deduplication. Support currently saves a `section_entries` row and has no verified human delivery. Full findings, affected objects, recovery/test plan and exact approval request are in `docs/design-implementation/PHASE4_SCHEMA_CHECKPOINT.md`.
- **Next:** owner approval or revision of the local-only migration plan. Stop before applying any migration, then resume Phase 4 screen implementation only after the schema dependency is resolved or explicitly isolated. No staging merge, deployment or hosted mutation occurred.

## Version 3 Phase 3 checkpoint — 2026-10-14

- Verified GitHub `design/phase-2` at `b2761c958090fab9f3bd49334adcda6d9a219e44` and created isolated `design/phase-3` worktree at `/private/tmp/legacy-fortress-v3-phase3`. The original owner tree, root `AGENTS.md`, all unrelated edits and three untracked owner tests were left intact.
- Implemented customer-only Version 3 shell: 264px sidebar, 60px desktop header, nine-dot brand, role-aware workspace chooser using the shared mobile Sheet, grouped six-area navigation, Support/Settings footer, search, account menu, nested parent-back, mobile Home title and four safe-area tabs. Added owner-only `/add` and `/actions` destinations linked to existing secure flows. Strengthened linked navigation filtering for owner actions, Access Requests and zero-scope areas. Confirmed `SIGNED_OUT` now redirects to sign-in; Supabase auth service, enterprise/admin branding and data operations were not changed.
- Actual authenticated local app captures in Chrome and WebKit at 1440×900 and 390×844, measured interaction results and visual differences are in `docs/design-implementation/PHASE3_COMPARISON.md`. Chrome shell checks had no page errors; WebKit interactions passed but local API/access-control and auth-lock errors mean its dashboard data result is not clean. The browser harness requires exact loopback app/Supabase URLs and a temporary synthetic password supplied only through the process environment.
- Colima and the local Supabase services were restored; auth health and isolated app schema health returned 200. The owner-approved local env URLs were verified loopback before synthetic user setup. Local schema drift blocked linked browser UAT: `account_access_grants.required_identity_level`, invitation expiry and enterprise membership objects are absent. No migrations were applied. Temporary config/env/password were removed before commit; the local stack remains running for later reviewed setup.
- Final checks: TypeScript and build passed; lint passed with 18 existing warnings; stabilisation 81/81; focused route/viewer/invitation/header/workspace 22/22; core 53/54 on the unchanged committed Supabase `site_url` mismatch (54/54 with the temporary approved local config). The unrelated empty Dashboard-card CSS assertion also fails on the Phase 2 base. No staging/production deployment or hosted mutation occurred. Phase 4 needs owner approval and Q3/Q4/Q17 direction; linked UAT needs a separate reviewed local migration plan.

## Version 3 Phase 2 checkpoint — 2026-10-14

- Verified remote `design/phase-1` at `b1a24d8` with `a4b4498` in history. Created isolated `design/phase-2` worktree at `/private/tmp/legacy-fortress-v3-phase2`; root owner changes and three untracked tests remain untouched.
- Implemented the Version 3 shared primitives in `components/ui/V3Primitives.tsx` with one dedicated stylesheet and small token additions. The set includes buttons, chips, rows, cards, page header, breadcrumb, switches, sheets, banners, toasts, empty/restricted states, linked-context banner/switcher, stepper and timeline. Existing `Icon` gained an accessible image label when titled. No application route, auth, permission, data, estate or hosted code changed.
- Actual Version 3 journey reference cards and Chrome component screenshots are in `docs/design-implementation/screenshots/`; comparison and measured checks are in `PHASE2_COMPARISON.md`. Hydrated Chrome/WebKit checks passed at 1440×900 and 390×844, including switch keyboard use, sheet focus trap/Escape/return, toast Undo, mobile context sheet, 44px targets, high contrast and enlarged text.
- TypeScript, lint, build, stabilisation (81/81), focused navigation/dashboard/admin-prototype (9/9) and admin foundation (9/9) passed. Lint reported 18 pre-existing warnings. Core tests still fail only on the base Supabase `site_url` local URL assertion.
- Colima is stopped, its Docker socket is unavailable, local Supabase health refuses connection, and the existing port 3012 process has not been proved isolated. Do not run authenticated UAT until local config, stack and app runtime are verified. No staging/production deployment or hosted mutation occurred. Phase 3 needs an owner checkpoint, especially Q1/Q2/Q19 shell decisions.

## Version 3 Phase 1 checkpoint — 2026-10-14

- Phase 1 was implemented in isolated branch/worktree `design/phase-1` at `/private/tmp/legacy-fortress-v3-phase1`; the owner working tree, root `AGENTS.md` and three untracked tests were not changed.
- Added Version 3 CSS tokens and system typography in `app/globals.css`, locally bundled verified Material Symbols Rounded with license/provenance, updated the shared icon foundation, and added a reusable nine-dot glyph. Existing shell geometry, routes, data operations and security code remain in place.
- Desktop/mobile Chrome reference captures and isolated foundation previews are in `docs/design-implementation/screenshots/`. The test/evidence limits and Phase 2 gate are in `docs/design-implementation/PLAN.md`; approval classifications are in `QUESTIONS.md`.
- Local Supabase auth on `127.0.0.1:55421` is unavailable because the Colima Docker socket is unavailable. The committed base Supabase config still has a hosted `site_url`; the owner's uncommitted local correction was preserved. Authenticated Playwright journeys remain pending local stack, config and app-runtime isolation proof. No staging deployment or hosted mutation occurred.

Updated: 2026-08-30 16:30 BST

## Latest Prompt 21 IDV Simulator Remediation

- Replaced the staging IDV page's required file upload and camera capture with explicit metadata-only synthetic document and live-person actions.
- Added deterministic scenario propagation from the staging UI to the server-side internal provider, including document failure, expiry, review, mismatch, liveness failure and provider error/timeout paths.
- Added server-side linked-access context validation: invitations/grants must belong to the authenticated user and terminal/revoked contexts are rejected; unbound linked-access URLs cannot start verification.
- Corrected successful-result copy so identity verification is clearly separate from invitation, authority and access-policy decisions.
- Added face-match metadata to the Platform verification queue/detail and included verified requests in the queue.
- No migration, RLS, production configuration or commercial provider changes were made.
- Focused Phase 7 tests, full `npm test`, TypeScript and build pass locally. Hosted staging UAT remains required after redeployment.

## Current Branch

`uat-remediation-preview`

## Working Tree Summary

The working tree was already dirty before this handover system was created. It contains many modified and untracked application, admin, Supabase migration, test and documentation files from prior local UAT/remediation work. Do not revert or overwrite them without explicit approval.

## Current Objective

Phase 4D final pre-push blocker resolution, dependency-audit remediation, upgrade-path replay evidence, UAT-isolation validator hardening and controlled commit planning.

## Latest Phase 4D Work

- Resolved the `npm run release:check` dependency audit blocker with package overrides for patched transitive versions of `@babel/core`, `js-yaml` and `ws`.
- Refreshed `package-lock.json` and installed dependencies so `npm ls @babel/core js-yaml ws` resolves to the patched versions and `npm audit --json` reports zero vulnerabilities.
- Added `npm run uat:validate` and hardened `scripts/validate-uat-environment.mjs` to fail closed for shared webhook/email fingerprints and missing UAT banner/noindex controls.
- Expanded `tests/uat-environment-validation.test.mjs` to cover valid isolation, shared database, shared storage, live Stripe/shared webhook, production app URL, missing UAT mode, production role harness and disabled UAT presentation controls.
- Added Phase 4D evidence docs under `docs/release/`.
- Completed an older-baseline disposable migration replay through the release-candidate migration range. A follow-up direct `psql` count/RLS query was blocked by the execution approval system and should be rerun before push/deploy.
- No staging, commit, push, deployment, hosted service access, production data access, history rewrite or credential rotation was performed.

## Current Phase 4D Blockers

- Owner has not verified the live Coolify application branch/commit/source.
- Historical credential-like value remains a potential exposed credential until owner decision/rotation/history action.
- Hosted UAT isolation is configuration-gated but not proven against real UAT resources.
- `supabase/config.toml` remains local-UAT-only and excluded unless separately approved.
- Controlled commit manifest is a draft; no staged files exist.

## Latest Phase 4C Work

- Fixed production-start schema health discrepancy by resolving server Supabase URL at runtime through `SUPABASE_URL` first and avoiding build-inlined public URL values in the admin/server health path.
- Added safe schema health diagnostic categories without exposing SQL, secrets or connection strings.
- Proved clean migration replay on a disposable local database with the full `supabase/migrations` chain.
- Added environment-controlled UAT banner and noindex/nofollow metadata.
- Added UAT environment isolation validator and tests.
- Added owner admin/enterprise review guide and Playwright proof for `/admin` using synthetic local users.
- Documented Supabase local config review, secret-history concern, live Coolify source uncertainty and controlled commit staging plan.
- Current blocker: repo truth still cannot prove the current live Coolify application branch/commit; owner/operator verification is required before push/deploy.

## Work Already Completed

- Safety inspection performed without printing environment values.
- Confirmed repository path: `/Users/ivan-imac/legacy-fortress-web`.
- Confirmed local review target: `http://127.0.0.1:3012`.
- Confirmed production URL is out of scope/read-only: `https://legacy-fortress.vercel.app`.
- Confirmed package scripts and local Supabase port configuration.
- Created/updated project guidance documents.
- Generalised the Wills-style inline document upload control through `UniversalRecordWorkspace`.
- Replaced single pending document state with multi-document pending upload state and removable pending-file chips.
- Applied the saved confirmation modal to all shared asset saves.
- Applied the Add notes reveal pattern to non-configured shared forms.
- Removed the duplicate bottom "Upload document" button path where the shared inline upload control is used.
- Tightened remaining manual finance branches with controlled dropdowns for currency, ownership, insurance type and debt type.
- Added focused regression coverage for shared asset form consistency.

## Files Changed By This Handover Task

- `AGENTS.md`
- `docs/AI_PROJECT_STATE.md`
- `docs/CODEX_HANDOVER.md`
- `docs/LOCAL_SAFETY_CHECKLIST.md`
- `.env.example`
- `.gitignore`

## Files Changed By Latest Asset-Form Pass

- `components/records/UniversalRecordWorkspace.tsx`
- `app/globals.css`
- `lib/legalCategories.ts`
- `tests/legal-linked-contacts.test.mjs`
- `tests/shared-asset-form-consistency.test.mjs`
- `tests/trusts-document-form.test.mjs`
- `docs/CODEX_HANDOVER.md`

## Latest Trusts/Form-Family Pass

- Added a named `AssetFormFamily` classification for shared forms: `document`, `financial`, and `asset`.
- Corrected Trusts to behave as a document-led legal record:
  - no Active/Archived value summary;
  - page helper text: "Store trust deeds, trustees and supporting legal documents securely. You can update this anytime.";
  - removed the repeated in-card "Securely stored in your vault. You can update this anytime." Trust helper;
  - first row now uses Document name, Document type, and shared upload in a three-column desktop layout that stacks on mobile;
  - bounded Trust document type dropdown with safe "Other" persistence;
  - controlled jurisdiction/country dropdown with UK, US, European countries and safe "Other" persistence;
  - optional trust metadata only for date created, jurisdiction/country and reference number;
  - removed Trust name, Status, Review date and standalone Solicitor/adviser fields from the Trust form;
  - Trust-only upload accept list: PDF, DOCX, JPG/JPEG and PNG;
  - no Add picture action;
  - notes hidden behind Add notes unless already present;
  - repeating trustee/related-person rows with full name, email, telephone and role dropdown, using the same add/remove icon-button treatment as Wills.
- Kept Trusts on the existing shared records/contact/attachment paths:
  - record metadata stores Trust-specific structured values;
  - shared `InlineDocumentUploadField` and `AttachmentGallery` remain the upload/view surfaces;
  - repeating legal contacts save through canonical contacts and compatibility `record_contacts` projection, replacing old rows first to avoid duplicate projections.
- Updated Trust linked-contact labels and roles in `lib/legalCategories.ts`, including Trustee, Settlor, Beneficiary, Protector, Solicitor, Adviser, Accountant and Other.

## Latest Trusts Collapsible-Form Pass

- Implemented the Trusts page add-record interaction in the shared `UniversalRecordWorkspace`.
- Root cause: the shared workspace rendered the create form whenever the page had no existing records, so Trusts showed the full Add new record panel by default instead of letting Existing records stay the main page focus.
- Added local create-form visibility state that defaults closed and is not derived from record count.
- Kept Existing records visible on Trusts even when empty, with the Add record button in the existing section header.
- Add record now controls one form region with `aria-expanded` and `aria-controls`.
- Opening the form sets a focus flag and moves focus to the first editable field after render.
- Cancel controls now close the Trusts create form in place; dirty forms ask `Discard this unsaved trust record?`, clean forms close immediately, and focus returns to Add record.
- Save success closes and clears the create form, reloads records, shows the saved record, and returns focus to the Existing records heading.
- Validation failures keep the form open, preserve entered data, and focus the first editable field.
- Normal refresh defaults the create form closed.
- Wills retains its established cancel-to-Legal behavior; Trusts does not route away on cancel.
- Added focused static/unit coverage in `tests/trusts-collapsible-form.test.mjs`.
- Added a local-only Playwright spec in `tests/e2e/trusts-collapsible-form.spec.ts`; it skips clearly when local Supabase is unreachable.

## Checks Run

- `git diff --check -- AGENTS.md docs/AI_PROJECT_STATE.md docs/CODEX_HANDOVER.md docs/LOCAL_SAFETY_CHECKLIST.md .env.example .gitignore` passed.
- Documented package scripts verified present by reading `package.json`: `dev`, `lint`, `build`, `test:core`, `test:stabilisation`, `test:e2e`, `release:check`.
- Secret-pattern scan over the new guidance files and `.env.example` found no matches.
- Local URL/port references were verified against `supabase/config.toml` and the new guidance files.
- `node --test tests/legal-linked-contacts.test.mjs tests/shared-asset-form-consistency.test.mjs tests/finance-type-selection.test.mjs tests/workspace-category-config.test.mjs` passed.
- `npx tsc --noEmit --pretty false` passed.
- `npm run lint` passed.
- `npm run build` passed. Next reported `.env.local` was loaded during build; no values were printed or modified, and no hosted services were contacted by this task.
- `node --test tests/trusts-document-form.test.mjs tests/shared-asset-form-consistency.test.mjs tests/legal-linked-contacts.test.mjs tests/finance-type-selection.test.mjs tests/workspace-category-config.test.mjs` passed.
- `npx tsc --noEmit --pretty false` passed after the Trusts pass.
- `npm run lint` passed after the Trusts pass.
- `npm run build` passed after the Trusts pass. Next reported `.env.local` was loaded during build; no values were printed or modified, and no hosted services were contacted by this task.
- `node --test tests/trusts-document-form.test.mjs tests/shared-asset-form-consistency.test.mjs tests/legal-linked-contacts.test.mjs tests/finance-type-selection.test.mjs tests/workspace-category-config.test.mjs` passed after the rigorous Trusts correction.
- `npx tsc --noEmit --pretty false` passed after the rigorous Trusts correction.
- `npm run lint` passed after the rigorous Trusts correction.
- `npm run build` passed after the rigorous Trusts correction. Next reported `.env.local` was loaded during build; no values were printed or modified, and no hosted services were contacted by this task.
- `node --test tests/trusts-collapsible-form.test.mjs tests/trusts-document-form.test.mjs tests/shared-asset-form-consistency.test.mjs tests/legal-linked-contacts.test.mjs` passed after the collapsible Trusts pass.
- `npx tsc --noEmit --pretty false` passed after the collapsible Trusts pass.
- `npm run lint` passed after the collapsible Trusts pass.
- `npm run build` passed after the collapsible Trusts pass. Next reported `.env.local` was loaded during build; no values were printed or modified, and no hosted services were contacted by this task.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 npx playwright test tests/e2e/trusts-collapsible-form.spec.ts --project=desktop-chromium` did not run browser UAT because isolated local Supabase was unavailable; the spec reported `1 skipped`.
- Local service blocker evidence:
  - `curl -I` to the configured local Supabase auth health URL could not connect to `127.0.0.1:55421`.
  - direct local DB connection to `127.0.0.1:55422` was refused.
  - `supabase status` could not connect to the Docker daemon at the local Colima socket.
  - No Docker/Colima restart or Supabase stack change was performed.

## Outstanding Tasks

- Review these documentation changes.
- Browser-review the Trusts collapsible-form behavior locally at `http://127.0.0.1:3012/legal/trusts` after the isolated local Supabase stack is running again.
- Review whether asset-specific invitation email tracking is a future workflow, because the current form UI displays contact invite states but this pass did not implement a new email-send/acceptance workflow. No Trust-specific invite sender or extraction-confirmation workflow was added.
- Before browser testing, prove the app is using local Supabase `127.0.0.1:55421`.

## Known Failures

Trusts browser UAT is currently blocked by the local Supabase/Docker stack being unavailable, not by a failing Trusts assertion. Re-run the local-only Playwright spec after restoring the isolated local Supabase stack.

## Latest Category/Asset-Type Integrity Pass

- Added a shared finance category/type registry in `lib/assets/categoryTypeIntegrity.mjs`.
- Finance legacy forms now use bounded category-specific dropdowns for investments, pensions, insurance and debts.
- Saving a finance record now validates the selected type against the current route category before persistence; pension-like values under Investments are blocked with a user-facing message directing the user to Pensions.
- Added local database trigger migration `supabase/migrations/20260711120000_category_type_integrity.sql` to reject direct `records` and `assets` writes with mismatched finance category/type metadata.
- Added `scripts/audit-category-type-integrity.mjs` to audit finance `records` and `assets` without printing secrets.
- Applied the migration only to the isolated local database and verified both triggers are enabled.
- Corrected one local synthetic Quilters row from `finances/investments` with `investment_type=Pension` to `finances/pensions` with `pension_type=personal_pension`, preserving the original record ID.
- Local audit now reports zero category/type findings, and a direct bad write test is rejected by the trigger.
- Focused tests passed: `node --test tests/category-type-integrity.test.mjs tests/finance-type-selection.test.mjs tests/finance-dashboard-rows.test.mjs tests/shared-asset-form-consistency.test.mjs tests/workspace-category-config.test.mjs`.
- `npm run lint` passed and `npm run build` passed.
- `npm run test:stabilisation` still has two unrelated UI assertion failures in `tests/dashboard-ui-consistency.test.mjs`; these pre-date this category/type pass and were not changed here.

## Latest Linked-Contact/Form-Flow UI Pass

- Shared record workspace create mode is now exclusive: when a route is opened with `?add=1` or the Add record action is used, the Existing records panel is hidden and only the add/edit form is shown.
- Updated linked legal contacts from bulky cards to a compact table with Name, Role, Invite status, Vault access and per-contact View/Edit/Delete icon actions.
- Preserved the current Trust-specific auto-invitation path:
  - Trust linked contacts with valid email addresses call the shared `sendContactInvite` helper on save.
  - The helper records `contact_invitations` and `invitation_events`, and uses Supabase OTP email delivery.
  - The Trust invitation remains locked by default through `requires_unlock_approval`; it does not grant document/vault access by accepting the role alone.
- Current limitation: this pass did not add linked-contact invitation fields to every finance/property/business/digital/possession form. Finance pension records still do not have a linked-contact UI or per-record invitation workflow unless that asset class is explicitly given one in a follow-up.
- Verification passed:
  - `node --test tests/trusts-collapsible-form.test.mjs tests/trust-linked-contact-role-card.test.mjs tests/trust-contact-auto-invitation.test.mjs tests/legal-linked-contacts.test.mjs tests/category-dashboard-consistency.test.mjs tests/finance-type-selection.test.mjs`
  - `npm run lint`
  - `npm run build`
- Browser/email delivery/access-control proof was not rerun in this pass. Use the local Supabase/Mailpit stack before claiming invite email delivery or scoped access is working end to end.

## Latest Admin / Application Dashboard Foundation Pass

- Implemented Phase 1 admin dashboard foundation only; no deploy, commit, push, hosted service access, production data, real users, Stripe, Vercel or Shure.Fund interaction.
- Added `/admin` as the canonical admin landing route and `/admin/access-denied` as the safe denial route.
- Added protected internal API `/api/internal/admin/dashboard-summary` for aggregate-only operational metrics.
- Added local-only role-testing harness API `/api/internal/admin/local-role-override`; it is local-runtime gated and restricted to super admins with `admin.roles.test`.
- Updated the admin capability model with canonical roles: `super_admin`, `support_agent`, `verification_reviewer`, `probate_reviewer`, `auditor` and `enterprise_admin`; `organisation_admin` is retained as a compatibility alias.
- Added `lib/admin/dashboardSummary.ts` for safe aggregate metrics; unavailable sources return unavailable states rather than false zeroes.
- Added admin documentation:
  - `docs/ADMIN_FOUNDATION.md`
  - `docs/ADMIN_ROLE_MATRIX.md`
  - `docs/ADMIN_DASHBOARD_METRICS.md`
  - `docs/ADMIN_UAT.md`
- Updated `docs/ADMIN_BACKOFFICE_DELIVERY_PLAN.md` and `docs/UAT_REMEDIATION_TODO.md` with evidence and remaining Phase 1 gates.
- Verification:
  - `node --test tests/admin-phase1-foundation.test.mjs tests/admin-phase2b-probate-cases.test.mjs tests/platform-architecture-stabilisation.test.mjs` passed 19/19.
  - `npm run lint` passed.
  - `npm run build` passed.
  - `curl -i http://127.0.0.1:3012/api/internal/admin/dashboard-summary` returned `401 Unauthorized` for missing bearer token and exposed no admin data.
  - Playwright local smoke rendered `/admin/access-denied` on desktop and mobile. `/admin` without a usable authenticated admin session stayed on the protected checking shell.
  - `npm run test:stabilisation` currently fails two older dashboard/onboarding UI assertions unrelated to the new admin foundation.
- Remaining Phase 1 gates:
  - Browser role-matrix proof with synthetic local accounts.
  - Dashboard aggregate count proof against known local data.
  - Authorised dashboard audit-event proof.
  - Review whether `/admin` should also have a server/edge route redirect guard in addition to the protected client/API flow.

## Latest Admin Role-Matrix Browser Proof

- Completed local-only role-matrix proof on 2026-07-12 against `http://127.0.0.1:3012` using `.env.phase1.local` and isolated local Supabase `127.0.0.1:55421`.
- Repaired the local-only service-role/admin key category in `.env.phase1.local` so the running app and Playwright setup use the local ES256-compatible Supabase auth keys. Values were not printed or committed.
- Added `tests/e2e/admin-role-matrix-local.spec.ts` for synthetic local users: super admin, support agent, probate reviewer, auditor, enterprise/admin alias, standard user, revoked admin, and invalid-role user.
- Focused browser/API proof passed: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 npx playwright test tests/e2e/admin-role-matrix-local.spec.ts --project=desktop-chromium --reporter=line` passed 13/13.
- Proven in that spec: `/admin` route access, direct admin API allow/deny, standard-user denial, revoked-admin denial, invalid role fails closed, dashboard aggregate count matching, payload redaction, super-admin local role harness, audit event creation, stale-session revocation on next request, and mobile viewport access/denial.
- Supporting checks passed: `npx tsc --noEmit --pretty false`, `node --test tests/admin-phase1-foundation.test.mjs`, `npm run lint`, `npm run build`, and local `/api/health/schema`.
- Remaining blockers to a full "all tests pass" gate:
  - `npm test` is not defined in `package.json`.
  - `npm run test:core` fails an existing `tests/auth-and-schema-guards.test.mjs` assertion because dirty local `supabase/config.toml` uses local auth URLs rather than the production site URL expected by the test.
  - `npm run test:stabilisation` fails two existing `tests/dashboard-ui-consistency.test.mjs` assertions after prior UI changes: dashboard avatar hydration signature and onboarding copy/structure.

## Assumptions

- Future local app review should use `PORT=3012 npm run dev` after the approved local env file is loaded.
- `.env.phase1.local` is the current ignored local-UAT env mechanism; values must never be printed.
- Production is read-only and must not be tested destructively.

## Recommended Next Action

Use `docs/LOCAL_UAT_REVIEW_ACCESS.md` to set a temporary local-only password for the synthetic review accounts, then perform owner manual review at `http://127.0.0.1:3012`.

## Latest Local Review Access / Dashboard Inventory Pass

- Added `scripts/prepare-local-uat-review-users.mjs` as a local-only credential provisioning helper for synthetic review accounts.
- The helper refuses non-local Supabase URLs, requires a strong `LOCAL_UAT_REVIEW_PASSWORD`, confirms local synthetic role accounts, and does not print passwords or Supabase keys.
- Added `docs/LOCAL_UAT_REVIEW_ACCESS.md` as the source guide for manual local review access:
  - startup commands for local Supabase and the app on `http://127.0.0.1:3012`;
  - synthetic review account emails and expected role landing pages;
  - safe local password-reset/provisioning method without committing credentials;
  - customer route inventory;
  - internal `/admin` dashboard inventory;
  - enterprise/licence verdict: no separate live enterprise dashboard yet; `/admin` shows enterprise/licence placeholders, while `/internal/admin/prototype/enterprise` and `/internal/admin/prototype/licences` are non-operational prototype/static pages.
- Updated `tests/e2e/admin-role-matrix-local.spec.ts` so the super-admin dashboard proof validates visible `/admin` metric cards against direct local aggregate truth, not just the API response.
- Added `tests/e2e/local-uat-review-access.spec.ts` to prove:
  - standard synthetic customer can sign in through the browser and load primary customer review routes;
  - super admin can open the real application command dashboard;
  - enterprise admin lands on `/admin` placeholders rather than a separate live licence dashboard.
- Added `tests/local-uat-review-access-doc.test.mjs` to guard the review-access doc and helper script against accidentally documenting secrets.
- Current local aggregate dashboard truth after the role-matrix fixture run:
  - total users: 165;
  - users without will: 155;
  - stale wills: 17;
  - old documents: 16;
  - users without executor: 147;
  - pending invitations: 13;
  - failed emails: 11;
  - pending probate reviews: 16.
- Verification passed:
  - `set -a; source .env.phase1.local; set +a; npx tsc --noEmit --pretty false`
  - `set -a; source .env.phase1.local; set +a; node --test tests/admin-phase1-foundation.test.mjs`
  - `set -a; source .env.phase1.local; set +a; node --test tests/local-uat-review-access-doc.test.mjs`
  - `set -a; source .env.phase1.local; set +a; npm run lint`
  - `set -a; source .env.phase1.local; set +a; npm run build`
  - `set -a; source .env.phase1.local; set +a; PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 npx playwright test tests/e2e/admin-role-matrix-local.spec.ts --project=desktop-chromium --reporter=line`
  - `set -a; source .env.phase1.local; set +a; PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 npx playwright test tests/e2e/local-uat-review-access.spec.ts --project=desktop-chromium --reporter=line`
  - `curl -sS http://127.0.0.1:3012/api/health/schema`
  - `curl -sS http://127.0.0.1:55421/auth/v1/health`
- Local app server remained running on `127.0.0.1:3012`; no hosted service, production data, Vercel, Stripe or Shure.Fund access was performed.

## Suggested Next Codex Prompt

Read `AGENTS.md` and `docs/CODEX_HANDOVER.md`. Work only in `/Users/ivan-imac/legacy-fortress-web`, use local URL `http://127.0.0.1:3012`, do not deploy or contact production, preserve existing dirty work, and continue with: <describe the next specific task>.

## Latest Phase 2 Repository Stabilisation Pass

- Phase 2 baseline identity captured on branch `uat-remediation-preview` at HEAD `edda0feaee839ea24aec2443ad86b94a1ace70f5`.
- Required pre-edit baseline commands were run: `git status --short`, `git status --porcelain=v2`, `git branch --show-current`, `git rev-parse HEAD`, `git diff --stat`, `git diff --name-status`, `git diff`, and `git ls-files --others --exclude-standard`.
- Added:
  - `docs/stabilisation/PHASE2_BASELINE_INVENTORY.md`
  - `docs/stabilisation/DIRTY_FILE_REGISTER.md`
- Updated:
  - `docs/PROJECT_STRUCTURE.md`
  - `docs/BUILD_AND_RELEASE.md`
  - `docs/KNOWN_TECH_DEBT.md`
  - `docs/CODEX_HANDOVER.md`
  - `package.json`
  - `tests/auth-and-schema-guards.test.mjs`
  - `tests/dashboard-ui-consistency.test.mjs`
- Added test hierarchy:
  - `npm test`
  - `npm run test:unit`
  - `npm run test:uat:local`
  - `npm run test:uat:admin`
- Reproduced and fixed Phase 2 test failures:
  - `npm run test:core` had a stale Supabase auth config assertion that expected local `supabase/config.toml` to use production `site_url`; corrected it to assert local `site_url` plus production redirect allow-list.
  - `npm run test:stabilisation` had stale profile-chip and onboarding assertions; corrected them to match current intended avatar/onboarding behavior.
- Passing in the completed Phase 2 check run:
  - `npm run test:core`
  - `npm run test:stabilisation`
  - `npm test`
  - `node --test tests/admin-phase1-foundation.test.mjs`
  - `npx tsc --noEmit --pretty false`
  - `npm run lint`
  - `npm run build`
  - `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 npx playwright test tests/e2e/admin-role-matrix-local.spec.ts --project=desktop-chromium --reporter=line`
  - `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 npx playwright test tests/e2e/local-uat-review-access.spec.ts --project=desktop-chromium --reporter=line`
  - `curl -sS http://127.0.0.1:3012/api/health/schema`
- Phase 2 browser proof note:
  - The two Playwright specs must be run serially while they share the same synthetic `uat.*@local.test` accounts.
  - A parallel run caused an expected fixture race where one suite reset the shared password during the other suite.
- No hosted service, production data, Vercel, Stripe, Shure.Fund, deploy, commit, push, reset, clean, or env-value exposure occurred.

## Latest Phase 3 Controlled Refinement Foundation Pass

- Added Phase 3 product and architecture source documents:
  - `docs/product/OWNER_REVIEW_BACKLOG.md`
  - `docs/product/DASHBOARD_BOUNDARIES_AND_PRIVACY.md`
  - `docs/architecture/DASHBOARD_COMPONENT_STANDARD.md`
  - `docs/product/PHASE3_SELECTED_SLICE.md`
- Selected one controlled implementation slice: shared customer category dashboard tile consistency.
- Refined `DashboardAssetSummaryCard` empty-state polish:
  - empty tiles keep one primary Add record action;
  - plus icon remains in the same top-right action position as populated-card Open icons;
  - empty Add record label is lighter so it does not compete with populated values;
  - tile helper text sits slightly closer to the card it describes.
- Added local-only deterministic fixture definition:
  - `tests/fixtures/phase3SyntheticFixturePack.mjs`
  - guarded by `tests/phase3-product-governance.test.mjs`
- Added `tests/phase3-product-governance.test.mjs` to `npm run test:core`.
- No new contact, invitation, attachment, admin, enterprise, migration or environment model was introduced in this pass.

## Latest Phase 4A Customer Dashboard Consistency Pass

Date: 2026-07-13.

- Baseline before Phase 4A edits:
  - branch: `uat-remediation-preview`;
  - local app URL: `http://127.0.0.1:3012`;
  - local Supabase category: `127.0.0.1:55421`;
  - local env category: `.env.phase1.local`;
  - `/api/health/schema`: OK;
  - Phase 3 dashboard Playwright proof: passed;
  - admin role-matrix Playwright proof: passed.
- Added route/data inventory:
  - [CUSTOMER_DASHBOARD_ROUTE_AND_DATA_INVENTORY.md](/Users/ivan-imac/legacy-fortress-web/docs/architecture/CUSTOMER_DASHBOARD_ROUTE_AND_DATA_INVENTORY.md)
- Added selected scope:
  - [PHASE4A_SELECTED_SCOPE.md](/Users/ivan-imac/legacy-fortress-web/docs/product/PHASE4A_SELECTED_SCOPE.md)
- Added shared customer overview loader:
  - [CanonicalAssetOverviewGrid.tsx](</Users/ivan-imac/legacy-fortress-web/app/(app)/components/dashboard/CanonicalAssetOverviewGrid.tsx>)
- Selected safe routes now read canonical customer `assets` and render count-only shared cards:
  - `/property`
  - `/business`
  - `/vault/digital`
  - `/vault/personal`
- Added tests/fixtures:
  - [phase4aSyntheticFixturePack.mjs](/Users/ivan-imac/legacy-fortress-web/tests/fixtures/phase4aSyntheticFixturePack.mjs)
  - [phase4a-customer-dashboard-data-proof.test.mjs](/Users/ivan-imac/legacy-fortress-web/tests/phase4a-customer-dashboard-data-proof.test.mjs)
  - [phase4a-customer-dashboard-consistency.spec.ts](/Users/ivan-imac/legacy-fortress-web/tests/e2e/phase4a-customer-dashboard-consistency.spec.ts)
- `npm run test:core` includes the new Phase 4A data-proof test.
- Historical note: the prompt-referenced files are now present in the canonical paths:
  - `README_PROJECT_OPERATING_RULES_SNIPPET.md`
  - `docs/specifications/Legacy_Fortress_Inclusion_Exclusion_Specification.docx`
  - `docs/specifications/Legacy_Fortress_UX_Data_Capture_Interaction_Standards.docx`
- No schema, migration, admin, probate, enterprise, hosted-service, deployment or Supabase config change was made in this pass.
- Final Phase 4A validation completed on 2026-07-13:
  - `npx tsc --noEmit --pretty false`: pass.
  - `npm test`: pass.
  - `npm run test:core`: pass.
  - `npm run test:stabilisation`: pass.
  - `npm run lint`: pass.
  - `npm run build`: pass.
  - `node --test tests/admin-phase1-foundation.test.mjs`: pass.
  - `node --test tests/category-dashboard-consistency.test.mjs`: pass.
  - `node --test tests/phase3-product-governance.test.mjs`: pass.
  - `node --test tests/phase4a-customer-dashboard-data-proof.test.mjs`: pass.
  - `curl -sS http://127.0.0.1:3012/api/health/schema`: pass.
  - `tests/e2e/phase3-dashboard-tile-consistency.spec.ts`: pass 2/2.
  - `tests/e2e/phase4a-customer-dashboard-consistency.spec.ts`: pass 7/7.
  - `tests/e2e/admin-role-matrix-local.spec.ts`: pass 13/13 when rerun serially.
- Note: one parallel admin role-matrix attempt timed out on a disabled sign-in button during shared local fixture setup. The same suite passed serially immediately after, so keep account-mutating browser suites serial for release gates.

## Latest Phase 6 canonical routing and release-readiness pass

Date: 2026-08-23.

- Phase 6 commit: `099bbdaa37d79f321f9f038bcf1b8685fc80dd85` on `hosted-uat-preparation-20260715`.
- Canonical entries added: `/access` for estate/access workflows and `/enterprise` for organisation operations. Existing `/access-requests`, `/contact-wallet` and `/application/enterprise` remain compatibility routes.
- Role-aware enterprise landing now resolves to `/enterprise`; consumer landing remains `/dashboard`; admin remains `/admin`.
- Added root governance sources:
  - `LEGACY_FORTRESS_LEGAL_POLICY_REQUIREMENTS.md`
  - `LEGACY_FORTRESS_PRODUCTION_READINESS_CHECKLIST.md`
  - expanded `LEGACY_FORTRESS_DATA_PROTECTION_GOVERNANCE.md` with route/data-domain/provider boundaries.
- Staging deployment through Coolify completed as deployment `ekpfcn8hcs804fy7ie5amup8`; public `/api/version` reports the Phase 6 commit.
- Read-only hosted smoke confirmed canonical public entries return HTTP 200 and unauthenticated admin/enterprise/privacy admin API requests are denied with HTTP 401 where applicable.
- `npm test`, `npx tsc --noEmit --pretty false`, `npm run build`, `npm run release:check`, `git diff --check` and focused Phase 6 tests passed. Release gate retains 12 pre-existing lint warnings and reports missing recommended local provider variables only.
- Pre-existing dirty/untracked admin, enterprise, local UAT and schema files were intentionally left unstaged.

## Latest Identity-Verified Access Vertical Slice

Date: 2026-09-27.

- Added explicit consent gating to the canonical identity-verification start and step-up boundaries.
- Retain the consent timestamp in verification request metadata and the `verification_started` audit event; consent does not grant identity, authority or access.
- Made identity decision, request, assurance, linked-access activation and evidence-cleanup writes fail closed when durable persistence reports an error.
- Added focused regression coverage for consent enforcement and durable-write failure handling.
- Existing provider behavior remains unchanged: `lf_internal_experimental_v1` is a staging/local simulator, not production-grade biometric verification.
- Focused IDV, TypeScript, build, route-audit, link-crawl and diff checks passed. No hosted deployment or production access was performed.
- Pre-existing dirty/untracked admin, enterprise, local UAT and schema files remain intentionally unstaged.

## Phase 3 Invitation-Bound Identity Verification Hardening

Date: 2026-09-28.

- Commit `7e8acf24f944944745abc38422a07ed89d890937` pushed to `hosted-uat-preparation-20260715`.
- Identity verification now rejects replayed camera challenges and checks all critical request, challenge, assurance, grant, role and cleanup persistence results.
- Added provider-readiness boundary documentation covering callback authenticity, idempotency, decision mapping, retention and legal/privacy review requirements.
- Corrected the existing security-page lint error without changing passkey behavior.
- Local tests, TypeScript, lint, build, route audit, link crawl and diff checks passed. Release check remains blocked by existing dependency advisories.
- Staging was confirmed at `0c214b4` before the push; post-push DNS resolution was unavailable, so deployment of `7e8acf2` remains unverified.
