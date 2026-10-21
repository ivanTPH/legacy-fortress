# Codex Handover

## 16 October 2026 — V3 review corrections

- On `fix/v3-recovery` after `ac338343`, People & Access now shows saved, individual record choices directly and provides clear save and revoke actions. Invitation, identity verification and record sharing are described separately; existing grant persistence and permission checks remain in place.
- The shared workspace selector uses a compact anchored menu on desktop and mobile, reserves header space while the session loads, and leaves navigation in place. Role-based choices and keyboard dismissal use the existing component.
- Local synthetic desktop Chrome and mobile WebKit owner journeys passed for workspace dismissal, contact edit, individual asset grant/revocation and persisted permission checks; the wrong-user test passed separately. Focused source tests, TypeScript, targeted lint and build passed. Hosted Jacqui-specific state still requires the outstanding read-only Coolify operator response; no hosted data was changed. Staging release is manual and requires owner approval.

## 16 October 2026 — People & Access V4 recovery package

- `fix/v3-recovery` retains the committed V3 workspace and contact fixes at `ad575d0` and adds one customer People & Access workspace. `/people-access` is canonical; owner `/contacts`, `/access`, and `/access-requests` entries lead into it. Linked requesters retain their guarded access-request view.
- People, invitation and identity states, selected record grants, and incoming requests use existing Supabase tables and canonical management services. Request approval records a decision without changing sharing; the owner can open the associated contact to manage access. No migration or hosted change is part of this package.
- Focused source tests (20/20), local synthetic Chrome/WebKit People & Access journeys (2/2), targeted lint and production build passed. `design:check` remains blocked by an unrelated pre-existing Finance selector assertion. Staging integration and release require separate verification.

## 16 October 2026 — V3 workspace and People I Trust recovery

- Isolated branch `fix/v3-recovery` starts at deployed staging SHA `952dccb177281080ba08e52467db497ba2e1919e`; the owner worktree and release worktree were not changed.
- Workspace menu fits the customer sidebar and mobile drawer, wraps identity text, closes on outside click, Escape and selection, and uses trusted app/admin role sources for visibility. Existing route and server authorisation remain in place.
- People I Trust presents contact details, invitation/identity status and named shared records separately. The existing contact, invitation and access services remain canonical; opening the drawer does not grant access.
- Local synthetic Chrome desktop and WebKit mobile journeys covered menu behavior, contact edit persistence, scoped asset selection, revocation and wrong-user denial. TypeScript, focused source tests and production build passed; synthetic fixtures were removed.
- No hosted database, deployment or staging branch was changed. Owner review is required before staging integration.

## 15 October 2026 — Version 3 staging-first integration

- Isolated worktree: `/private/tmp/legacy-fortress-v3-staging-preview`; branch `integration/v3-staging-preview`, based on staging SHA `e552b9d1608b8ccffe9b50d1c29ac98d85ee16ab`. The original owner tree and `design/phase-4` remain untouched.
- Selectively integrated the Version 3 customer design system, local Rounded icon font, shell branding, canonical `/add` and `/actions` aliases, Dashboard, Action Centre, Add, six Vault overviews, and People I Trust presentation. Staging auth, recovery, invitation, provider, redirect and email source paths were preserved.
- Corrected linked Property area routing using only RLS-visible assigned asset sections; linked navigation and Dashboard hide unassigned areas and owner action prompts. No hosted service was changed.
- Included the two previously rehearsed, forward-only security correction SQL files in source. They were **not** applied to any hosted database. The local API and PostgreSQL targets were explicitly verified as `127.0.0.1:55421` and `127.0.0.1:55422`, with 61 local migrations.
- Local synthetic browser proof: registration and recovery in Chrome; owner, wrong-account invitation, verified and revoked linked access, and admin isolation in Chrome desktop and WebKit mobile. All fixtures were removed. The loopback-only journey runner is `scripts/verify-v3-integration-local.mjs`. Focused source tests: 24/24; TypeScript and build passed. Selected screenshots are in `docs/release/v3-integration-evidence/`.
- Hosted Test LF migration ledger and security function definitions remain unverified. Do not deploy this branch to Test LF until a read-only, identity-verified hosted schema comparison and owner release approval. Local preview can use the approved loopback app, Supabase and Mailpit without real email.

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

## Customer UI consolidation increment

Date: 2026-10-13.

- Added an owner-scoped notification bell backed by existing `invitation_events`; it is presentation-only, session-read state, and is disabled in linked Fortress context.
- Reworked My Vault category and subsection preferences to use accessible responsive switches while preserving the existing preference loader/saver.
- Aligned shared settings primitives and support permission guidance with the approved warm LF design tokens and view-only sharing model.
- No schema, RLS, grant, invitation, IDV, estate, admin, production, or staging changes were made.
- Validation: TypeScript pass, stabilisation `91/91`, production build pass, route audit pass, link crawl pass, diff check pass. Core remains `57/58` because of the pre-existing local Supabase `site_url` assertion.

## Dashboard visual composition correction

Date: 2026-10-13.

- Replaced the Dashboard's legacy overview card presentation with the approved compact reference-tile composition while retaining canonical asset loaders, counts and routes.
- Added a mobile Home composition with truthful canonical value, record, people and debt summaries, a single next-step prompt and responsive vault rows.
- Added approved Vault/Sharing navigation group labels and reduced sidebar density to keep the complete shell visible at desktop widths.
- Removed the old desktop dashboard entry prompt and review panel from the rendered presentation; the readiness/action state remains available through the Action Centre and mobile next-step surface.
- No schema, RLS, grant, invitation, IDV, estate, admin, production, or staging changes were made.
- Browser smoke screenshots were captured at 1440x960, 402x874 and 375x812 against the local `127.0.0.1:3012` dev-smoke route. Application viewport width matched each viewport with no horizontal overflow.

## Shared icon-system conformance increment

Date: 2026-10-13.

- Centralised customer icon semantics in `components/ui/Icon.tsx` through `LF_ICON_MAP` and switched production instances to the Material Symbols Rounded CSS contract with local asset loading.
- Aligned customer navigation identifiers with the handoff: `space_dashboard`, `gavel`, `home`, `work`, `group`, `key` and `help`.
- The repository currently contains only the existing local Material Symbols-compatible TTF, not a separately downloaded Rounded font file; external font retrieval was unavailable, so the local fallback remains an explicit validation limitation.
- No route, data, grant, Auth, IDV, estate, admin, production or staging behavior changed.

## Permanent design guardian increment

Date: 2026-10-13.

- Copied the complete approved design handoff into `design/brand-guardian/` without modifying the source files.
- Added source provenance/checksums, design authority, change-control, screen-reference and brand-application governance documents.
- Added root `AGENTS.md` rules requiring customer UI work to identify the approved source state, use canonical tokens/components, preserve business/security behavior, and provide desktop/mobile evidence.
- Added `npm run design:check`, which verifies all eight handoff source checksums, canonical Material Symbols identifiers, governed copy, and prohibited governed icon-library usage.
- Preserved the existing Finance structural correction and Dashboard tooltip removal in the same validated increment.
- Validation: design guardian pass, icon tests 2/2, TypeScript pass after moving stale generated `.next/dev` output aside, lint pass, stabilisation 91/91, production build pass, route audit pass, link crawl pass, diff check pass.
- External GitHub and Google Fonts DNS were unavailable during this run. The repository still contains only the existing local Material Symbols-compatible font asset, so exact Rounded font asset conformance remains an explicit follow-up rather than being claimed complete.
- No schema, RLS, grant, invitation, IDV, estate, admin, production, or staging changes were made.

## Application-wide Vault presentation convergence

Date: 2026-10-13.

- Added `components/vault/VaultAreaOverview.tsx` as the shared record-first area overview primitive.
- Migrated Legal, Property and Business overview pages away from legacy Dashboard summary cards while preserving preference gates, canonical reads, routes and add flows.
- Migrated the canonical asset overview grid used by Digital and Personal areas to the same populated/empty/loading tile language.
- Restored the approved mobile large page title for non-Dashboard area pages; Dashboard retains its dedicated Home composition.
- Added `design/brand-guardian/SCREEN_CONFORMANCE_MATRIX.json` and made `npm run design:check` validate matrix completeness and allowed statuses.
- Browser smoke captured local dev-smoke screenshots under `/private/tmp/lf-guardian-*-settled.png` at 1440x960 and 402x874; all tested routes returned HTTP 200 and matched viewport width. This is unauthenticated/dev-smoke evidence, not hosted authenticated acceptance.
- Validation: TypeScript pass, design guardian pass, stabilisation 91/91, production build pass, focused Phase 4A data-proof tests 6/6, lint pass, diff check pass. Core remains 55/58 because of the pre-existing local Supabase `site_url` assertion; no auth configuration was changed.

## Staging build diagnostic: 353d848

Date: 2026-10-13.

- The target staging application is Coolify UUID `yka9huzmm56hjpz1gno448fb`, on branch `hosted-uat-preparation-20260715`.
- The reported failed build for `353d848` completed compilation, TypeScript validation and static-page generation, then exited with code 255 during Next.js trace collection.
- The public staging hostname could not be resolved from this environment (`curl: (6) Could not resolve host: test.mylegacyfortress.com`), so `/api/version` and the running container could not be verified.
- Read-only Coolify API requests were attempted without printing credentials. The application metadata and deployment-log requests returned HTTP 401/404, so build logs, container diagnostics and host resource metrics were unavailable.
- The repository contains no checked-in Dockerfile, Nixpacks file, Procfile or Node-version override. The documented staging path remains Node 20, `npm ci`, `next build --webpack`, then `npm run start`.
- A local production-equivalent `npm run build` succeeds with exit code 0 and generates the expected route output. No evidence establishes whether the hosted trace failure was caused by memory pressure, disk exhaustion, timeout, container termination or another host-side condition.
- No Coolify setting, Docker resource, dependency, Node version, deployment or production configuration was changed. Owner/operator access to the failed deployment logs and host/container metrics is required before attributing or correcting the failure.

## Mobile responsiveness remediation

Date: 2026-10-13.

- Added explicit viewport metadata in `app/layout.tsx`: device-width, initial scale, and `viewport-fit=cover`.
- Kept the UAT banner in normal document flow on mobile so it cannot occupy the same top coordinate as the sticky application header.
- Corrected the final mobile shell clearance in `app/globals.css`; the legacy mobile padding rule now reserves space for the floating bottom navigation and iOS safe-area inset.
- Added shared mobile wrapping and minimum-width rules for headings, finance sections, record rows, and shell children so content can shrink and wrap without horizontal overflow.
- At 402px, the local browser measurement reports `scrollWidth=402`, bottom navigation top `800px`, last content bottom `689.5px` at the page end, and no overlap. A geometry sweep at 320, 375, 390, 402, 430, 768, and 1280px reported zero viewport-overflow failures across Dashboard, Finances, Action Centre, People, Settings, and record-detail routes.
- Local browser smoke remains unauthenticated because the isolated runtime has no Supabase URL; it is geometry evidence only. Real iPhone/WebKit and authenticated hosted acceptance were not run.
- No Auth, RLS, grant, invitation, IDV, estate, probate, admin, production, or staging deployment behavior changed.

## V4 visual acceptance correction branch

Date: 2026-10-17. Branch: `fix/v4-visual-acceptance`, based on deployed staging `5066c552` in isolated `/private/tmp/legacy-fortress-v4-visual`; owner worktree untouched.

- Fixed shared Add Asset/`note_add` icon hiding, shared select chevron position, required-first two-column record forms, collapsed optional fields, one Cancel action, and a single document/photo upload area. The first image still uses the existing photo attachment path.
- Made `/add` finance choices open their forms directly. People & Access now separates connection, identity and active record access; shows named records, adds revoke confirmation and request filters, and presents Sharing as an owner-only record-by-person matrix. Record toggles are disabled while permissions save to avoid overwriting a second edit.
- Authenticated local Chrome desktop and WebKit mobile visual journeys passed before the final matrix and mobile CSS changes. Focused desktop/mobile permission edit and revoke journeys passed after the save fix; wrong-user denial passed in the same local synthetic run. The owner stopped further browser execution, so the final matrix/mobile spacing still needs owner visual review.
- Final TypeScript and production build passed. Targeted ESLint passed with warnings; repository-wide lint still has pre-existing errors in the copied design HTML support files. Focused source checks pass after updating assertions for V4 currency and named-record UI. No hosted environment was changed.

## Combined V4 mobile and workspace selector correction

Date: 2026-10-17. Branch: `fix/v4-mobile-acceptance`, based on staging `38ea8d1`; no deployment.

- Preserved the in-progress mobile Finance, dashboard, People/form clearance, and Platform Administration layout fixes. Shared record forms now use mobile spacing and hide the fixed bottom navigation while open.
- Moved the customer workspace trigger into the brand row on desktop and mobile. The menu opens as an overlay, supports outside click, Escape, arrow keys and selection dismissal, and still uses the existing role-filtered workspace list.
- Focused workspace tests, TypeScript, and targeted lint passed. Local Chrome smoke mode verified the desktop/mobile selector and dashboard geometry at 1440px/390px. Local Supabase on `127.0.0.1:55421` was unavailable, so authenticated Finance, bank form, and admin content checks remain for staging review.

## V5 design handoff integration

- Based the isolated `design/v5-handoff-integration` worktree on confirmed remote staging `0557f28cf7312b40650e3c8e674f9dde9c36c97b`. The owner main worktree, its unpublished admin/release/configuration work, and all hosted environments were left untouched.
- Added the complete `design_handoff_legacy_fortress 5/` package with its original relative design assets. Retained V4 design history, including the previously committed mobile supplement, and indexed V5 precedence, implementation gaps, staged delivery and unresolved decisions in `docs/design-implementation/`.
- This is documentation only: no application, authentication, permissions, schema or release behavior was changed. The next stage is Personal Vault mobile after owner approval of its bounded scope; retain current authorised workspace choices until the conflicting V5 navigation guidance is resolved.

## V5 Stage 1 Personal Vault mobile implementation

- Isolated branch `feat/v5-vault-mobile-stage1` is based on staging `0557f28` plus the committed V5 handoff. The owner worktree and hosted environments remain untouched.
- The customer shell now has a 52px mobile header, bounded drawer, four docked tabs, independent content scrolling and safe-area clearance. The Dashboard uses authorised values and counts in one full-width summary, three KPI tiles and a responsive vault grid. Shared Finance rows wrap, and shared add/edit forms use a full-screen mobile layout with a docked Save control. The local Material Symbols Rounded font controls fixed icon boxes.
- The owner resolved the V5 navigation conflict: customer switching is restricted to Personal and authorised linked Vault contexts. Separate staff/partner sign-in, a protected master-owner assignment and the future TEST-only launcher remain a separate security project. Stage 1 changes no authentication, role assignment, RLS, schema or persistence.
- Focused workspace/icon tests passed (10/10); TypeScript, targeted ESLint and design checks passed. Local Chromium at 390, 320 and 402px, 390px with enlarged text, and 1440px desktop showed no document overflow; the 390px header measured 52px and the local icon font loaded. Local Supabase health answered on `127.0.0.1:55421`, but Finance/form authenticated visual checks were not completed because dev smoke routed those pages to sign-in. This remains a review limitation, not a claimed pass.

## V5-A Platform Admin design checkpoint

- Isolated `feat/v5-admin-design` worktree at `/private/tmp/legacy-fortress-v5-admin-design` starts from verified TEST `5e81e4cf3c33db92f913970ef0cbbb2ab50f432b`. The undeployed privacy-policy branch and owner worktree are untouched.
- Existing `/admin` routes now use the V5 warm admin shell, grouped capability-filtered navigation, responsive card/table presentation, 56px mobile header, safe-area-aware docked tabs, and focus-managed drawer. The generic cross-domain switcher is hidden only in Admin presentation; server permissions and routes are unchanged. Existing enterprise and probate audit destinations remain available.
- Synthetic local support-agent sign-in and Admin-to-Users navigation passed at 390px; Admin menu/Escape and desktop 1440px passed with no horizontal overflow. Evidence: `/private/tmp/lf-v5a-evidence/`. The synthetic account was removed. TypeScript and 20 focused tests passed; targeted lint has one pre-existing organisation-loader warning.
- No migrations, auth, RLS, API, hosted environment, or production changes are included. Before a TEST release, verify the protected release gate and remote staging HEAD; move to V5-B only after V5-A release succeeds.

## V5-A.1 Admin mobile design checkpoint

- `feat/v5-1-admin-mobile` starts from verified TEST `3ed3f3677c7a9130f0417e83972ace868e5f1e70`. The untouched V5.1 handoff is copied into this isolated worktree and indexed as the latest visual authority; V5 and V4 remain historical references.
- Admin has a compact dark mobile header, left menu, account/search utilities, three role tabs, concise Overview metrics, a status-only verification list and compact organisation controls. Existing routes, capability filters and verification actions remain intact. The TEST launcher, new approval actions and undeployed privacy migrations are excluded.
- Synthetic local support-agent and super-admin routes passed at 390px and 320px with no horizontal overflow; desktop passed at 1440px. TypeScript and 12 focused tests passed. Targeted lint has only the pre-existing organisation loader warning. Evidence is in `/private/tmp/lf-v5a1-evidence/` and `/private/tmp/lf-v5a1-super-evidence/`; synthetic accounts were removed.
- Next: commit, confirm the remote staging branch still equals `3ed3f367`, then use the protected GitHub Actions/Coolify TEST release. Stop on any gate failure before V5-B.

## V5.1 Partner presentation

- V5-A.1 was released to TEST at `72e011c57b0c32aba37f4951b21d1b5bfd7ff690`; protected GitHub Actions and hosted acceptance passed.
- The isolated `feat/v5-1-partner` branch adds a Partner Portal presentation to the existing `/enterprise` route for organisation-scoped members. The API exposes its existing resolved scope and capabilities to the UI; server-side organisation and action checks remain unchanged. Mobile has Overview, Team and Invitations tabs, compact cards/lists and a light navigation shell. Platform staff retain their existing Enterprise Operations presentation.
- Synthetic local partner sign-in and tenant-scope denial passed, with no overflow at 390px, 320px or desktop 1440px. No schema, RLS, auth or privacy-release migration is included. The TEST-only owner launcher and separate Partner sign-in remain security-gated.

## V5-C Personal Vault V5.1 checkpoint

- Base is verified TEST `da245de6c08cd8ffbebf67cffe30e8d52f3b912a` on isolated `feat/v5-1-personal-vault`. The current changes are presentation only: mobile owner Home summary, task grouping, Finance cards, People controls, notification sheet, Settings links, and a plain Vault label when there is only one customer context. Existing data services, routes, permissions and the undeployed privacy-policy branch are untouched.
- TypeScript and targeted lint passed. Synthetic local owner browser navigation and ordinary-owner Admin denial passed at 390px; Home and People also passed at 320px, Home at 1440px. One Action Centre row-width failure seen in the first screenshot was corrected and the affected Action Centre and Finance screens passed a focused recheck. Evidence: `/private/tmp/lf-v51c-evidence/`. Synthetic fixtures were removed.
- V5.1 founding-owner TEST launcher is not implemented: current master-role resolution includes an email fallback and the independently authenticated TEST destinations in the prototype are not configured. Direct authorised `/dashboard` navigation works. Implement a launcher only after protected account-ID master verification and independent entry points are approved; do not alter Auth in this UI release.
- Focused source assertions for the changed Action Centre, dashboard and Vault selector have been reconciled and pass. Next: commit and push this branch, verify remote staging remains at `da245de`, then use the protected TEST release. Stop on any release gate failure. Owner iPhone visual acceptance remains outstanding.

## V5.1 owner acceptance correction

- Isolated `fix/v5-1-owner-acceptance` starts at verified TEST `26c2359cd12f524e58651fb72a3b98c8b169be58`. The main owner worktree and undeployed privacy-policy branch remain untouched.
- The mobile Vault header removes decorative borders while retaining keyboard focus and 44px controls. Home keeps a three-row To do preview above the compact Vault list; Will decisions open Action Centre detail and save through existing profile preferences. Profile is the canonical account destination, with security at `/account/security`.
- The Admin drawer leaves a tapped link mounted until client routing completes, and its light-surface hover contrast is corrected. A mobile avatar chevron that extended past the viewport is hidden. Admin desktop Overview keeps metrics and decisions first, with detailed operational data in collapsed sections.
- Vault initial session hydration now belongs to the bootstrap guard, avoiding duplicate initial renders without changing security redirects. Synthetic local checks proved ordinary-user Admin denial (403), single-tap Admin navigation without a document reload, 320/390px fit, Will choice persistence, and retained desktop operational metrics. The six failures in older source-assertion tests also fail at the unchanged staging baseline; TypeScript and changed-file lint had no errors.
- The TEST-only owner launcher remains gated: current master-role resolution can use an email fallback, and separately authenticated TEST entry points are not configured. No launcher, migration, RLS, provider or production change is included. Next: protected TEST release from this correction branch after checking remote staging still equals the approved baseline.
