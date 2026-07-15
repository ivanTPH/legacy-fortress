# Legacy Fortress UAT Remediation TODO

Date: 2026-06-29

Scope: isolated local browser UAT at `http://localhost:3012` against the Legacy Fortress local Supabase project on `127.0.0.1:55421`, using synthetic users, fictional records, and dummy files only. No hosted Supabase, Vercel, Stripe, production data, live users, or Shure.Fund systems were touched.

Related docs: [BUILD_AND_RELEASE.md](./BUILD_AND_RELEASE.md), [KNOWN_TECH_DEBT.md](./KNOWN_TECH_DEBT.md), [ATTACHMENT_AND_DOCUMENT_ARCHITECTURE.md](./ATTACHMENT_AND_DOCUMENT_ARCHITECTURE.md), [route-matrix.md](./route-matrix.md), [ADMIN_BACKOFFICE_DELIVERY_PLAN.md](./ADMIN_BACKOFFICE_DELIVERY_PLAN.md), [HOSTED_STAGING_READINESS_PLAN.md](./HOSTED_STAGING_READINESS_PLAN.md).

Admin/probate/back-office note: customer-vault UAT and admin/probate release readiness are separate tracks. Treat [ADMIN_BACKOFFICE_DELIVERY_PLAN.md](./ADMIN_BACKOFFICE_DELIVERY_PLAN.md) as the source of truth for future admin, probate, support, document-governance, enterprise, audit and role-permission work.

Hosted staging note: treat [HOSTED_STAGING_READINESS_PLAN.md](./HOSTED_STAGING_READINESS_PLAN.md) as the source of truth for hosted staging prerequisites, migration safety, deployment packaging exclusions, hosted browser/API/RLS proof, and canonical contact architecture. Current status is local internal UAT only; hosted staging still requires an isolated target, secure environment values, backup/rollback confirmation and independent synthetic browser/RLS proof.

Phase 4D pre-push note: the latest pre-push evidence is in `docs/release/PHASE4D_*.md`. Dependency audit remediation passed locally, `npm run release:check` passed, and `npm run uat:validate` now exists with fail-closed UAT-isolation tests. Remaining pre-push blockers are owner Coolify source verification, the historical credential-like value decision, hosted UAT isolation proof, `supabase/config.toml` exclusion/approval, and rerunning blocked browser/local-DB post-query proof where the execution sandbox prevented direct local Supabase access.

## Verified Fixes Completed

- Product defect: `/executors` no longer triggers the local browser runtime error `ExecutorsRedirectPage cannot have a negative time stamp`; it redirects through a small client redirect page to `/contacts?group=executors`.
- UX improvement: `/forgot-password` now explains the empty-email disabled state with accessible inline guidance while still blocking blank reset requests.
- Test coverage: auth hydration console coverage now includes `/`, `/sign-in`, `/sign-up`, `/forgot-password`, and invalid reset links.
- Test coverage: focused browser assertions cover the executor redirect and forgot-password guidance.
- 2026-07-04 Phase 3 hosted staging readiness and canonical contact design completed as documentation/readiness work only.
  - Evidence: [HOSTED_STAGING_READINESS_PLAN.md](./HOSTED_STAGING_READINESS_PLAN.md).
  - Scope: staging prerequisites register, deployment safety findings, migration checklist, hosted browser/API/RLS UAT plan, canonical contact architecture, known blockers and rollback requirements.
  - Verification evidence: focused node suite passed 44/44; `npm run test:stabilisation` passed 34/34; `npm run lint` passed; `npm run build` passed; local `/api/health/schema` returned `ok: true`; auth/session/linked-access Playwright gate passed 8/8 with ignored local env wrapper; executor/legal/attachment/mobile focused Playwright checks passed; dashboard count check passed in isolated one-worker rerun after a grouped local count mismatch.
  - No hosted Supabase, Vercel, Stripe, production data, real-user accounts, Shure.Fund, deployment, branch, commit, push or hosted migration was touched.
  - Current verdict: partially ready for hosted staging UAT with named blockers; suitable only for controlled local internal UAT until hosted staging is provisioned and independently proven.
- 2026-06-29 Core workflow sprint: `/legal/wills` now opens the legal will/document record flow instead of the executor asset flow.
  - Evidence target: `tests/e2e/final-uat-workflows.spec.ts` Legal wills lifecycle.
  - Affected files: `app/(app)/legal/[category]/page.tsx`, `tests/e2e/final-uat-workflows.spec.ts`.
- 2026-06-29 Core workflow sprint: canonical record cards now show the saved primary title first, including bank records, with provider details kept as secondary context.
  - Evidence target: `tests/e2e/final-uat-workflows.spec.ts` bank/property/business lifecycle.
  - Affected files: `components/records/UniversalRecordWorkspace.tsx`.
- 2026-06-29 Core workflow sprint: section-entry workspaces now expose shared search and consistent `Edit record` / `Delete record` action labels.
  - Evidence target: `tests/e2e/final-uat-workflows.spec.ts` Cars & Transport and Employment lifecycle.
  - Affected files: `components/sections/SectionWorkspace.tsx`, `app/(app)/employment/page.tsx`.
- 2026-06-29 Core workflow sprint: contacts now expose a dedicated `Search contacts` control over name, email, role, and linked context.
  - Evidence target: `tests/e2e/final-uat-workflows.spec.ts` Trusted contacts lifecycle.
  - Affected files: `components/contacts/ContactsNetworkWorkspace.tsx`.

## 2026-06-30 Local Review Environment

- Synthetic owner account seeded locally: `owner-uat-20260629@legacyfortress.test`.
  - Status: writable local-only owner account populated with fictional profile data, avatar, finance, legal will, property, business, vehicle, employment, possession, identity/document, reminder, contact, executor, invitation, and attachment data.
  - Seed marker: `owner-review-20260629` in local record metadata/details where supported.
  - Browser evidence: owner sign-in passed at `http://127.0.0.1:3012/dashboard`; visible owner avatar passed; finance bank record, business record, reminder, contacts/executor, bank attachment visibility, and refresh persistence passed.
  - Data evidence: local DB contains 6 tagged assets, 1 tagged legal record, 2 tagged section entries, 3 synthetic contacts, and 3 document rows for the owner account.
  - Storage evidence: local `avatars` contains synthetic owner/reviewer/Bill Smith avatars; local `vault-docs` contains synthetic PDF, PNG, and DOCX-style UAT files.
- Demo/reviewer UX clarification completed in `app/(app)/layout.tsx`.
  - The signed-in account/avatar areas now identify the signed-in reviewer account.
  - Linked-view workspace header now labels `Estate owner context`, shows `Viewing Bill Smith's estate records`, and separately names the signed-in reviewer and role.
  - Browser evidence: clean `/demo` run opened the demo account, reached `/dashboard`, and displayed both Bill Smith owner context and `Legacy Fortress Demo Reviewer`.
- 2026-06-30 Preview-readiness repair: identity documents now use the same canonical asset category for create/update/read/search/delete.
  - Affected files: `components/records/UniversalRecordWorkspace.tsx`, `lib/assets/createAsset.ts`, `lib/assets/fetchCanonicalAssets.ts`, `tests/legal-and-contact-mapping.test.mjs`, `tests/e2e/preview-readiness-release-gate.spec.ts`.
  - Browser evidence: `tests/e2e/preview-readiness-release-gate.spec.ts` passed identity document create -> retrieve -> refresh -> search -> edit -> refresh -> delete locally.
  - Unit evidence: `tests/legal-and-contact-mapping.test.mjs` now asserts identity document reads and writes share `legal / identity-documents`.
- 2026-06-30 Preview-readiness local seed correction completed in isolated local Supabase only.
  - Cars local seed corrected to `section_entries.cars_transport / records`.
  - Employment local seed corrected to `section_entries.employment / records`.
  - Personal possession local seed corrected to `records.personal / possessions`.
  - Identity document local seed corrected to canonical `assets.legal / identity-documents`.
  - These seed/data changes are not Git changes and must not be committed as production data.
- 2026-06-30 Preview-readiness browser proof completed at `http://127.0.0.1:3012`.
  - Dashboard search found `UAT Maple Bank Current Account` and `synthetic-bank-statement.pdf`.
  - Seeded route retrieval passed for `/legal/wills`, `/vault/property`, `/cars-transport`, `/employment`, `/vault/personal`, and `/identity-documents`.
  - Contacts search found `Maya Patel` after refresh.
  - Owner sign-in -> sign-out -> `/demo` passed with read-only reviewer mode and separate Bill Smith estate-owner context.
  - Captured `/api/internal/admin/session` 403 responses are expected non-admin restrictions and did not block tested user workflows.
- Avatar finding: the current isolated local database has no Ivan/Yardley account row and no Ivan avatar metadata.
  - Current avatar metadata source is `public.user_profiles.avatar_path`.
  - Expected local storage path is in the `avatars` bucket first, with `vault-docs` fallback in profile helpers.
  - Most likely cause of the missing Ivan Yardley image in this local experience: the image belongs to a hosted/older environment or unseeded local account, not the current isolated local database.
  - Live impact cannot be confirmed without inspecting hosted data; do not copy real profile images into local UAT without approval.
- Local stakeholder review suitability: suitable for reviewing the populated owner account, reviewer context clarification, dashboard search, corrected route retrieval, contact search, and identity-document lifecycle in the isolated local environment.
- Preview deployment suitability: safe to create a Preview branch only with the approved production-safe commit set and with local-only files/data excluded.

## P0 Critical

- Product defect: complete authenticated CRUD proof for all primary record workspaces.
  - User impact: users cannot be considered release-safe until create, retrieve, edit, delete/archive, refresh, re-login, and search are proven per category.
  - Likely files/components: `components/records/UniversalRecordWorkspace.tsx`, `components/sections/SectionWorkspace.tsx`, category pages under `app/(app)`.
  - Test required: selector-specific Playwright tests per route with real labels and category-specific required fields.
  - Acceptance criteria: Legal, Finances, Personal, Property, Business, Cars & Transport, Employment, Identity Documents, contacts, and executors each pass create/edit/delete/search/refresh/re-login.

- Product defect: legal wills route presents executor-oriented creation copy/action.
  - User impact: users adding will information see misleading "Add executor" wording.
  - Likely files/components: `app/(app)/legal/[category]/page.tsx`, `lib/legalCategories.ts`, `components/records/UniversalRecordWorkspace.tsx`.
  - Test required: browser assertion for `/legal/wills` showing will-specific add/save labels and saved will retrieval.
  - Status: fixed in code on 2026-06-29; awaiting passing browser lifecycle proof.
  - Acceptance criteria: `/legal/wills` uses will-specific labels and saves a will record/document without executor wording.

## P1 High

- Product defect/test gap: local owner dashboard does not surface the seeded finance record title through dashboard search.
  - User impact: stakeholder review cannot use dashboard search as proof that newly seeded/review records are discoverable from the overview.
  - Evidence: 2026-06-30 browser verifier signed in as `owner-uat-20260629@legacyfortress.test`; direct `/finances/bank` retrieval passed, but dashboard search for `UAT Maple` failed to show `UAT Maple Bank Current Account`.
  - Status: resolved as a verifier timing issue on 2026-06-30; focused Playwright proof now waits for dashboard data and passes.
  - Likely files/components: `app/(app)/dashboard/page.tsx`, dashboard search aggregation helpers around asset/record/section-entry rows.
  - Acceptance criteria: dashboard search retrieves visible records from canonical assets, universal records, documents, contacts, and remaining section entries.

- Product defect/test gap: several top-level category routes do not expose the seeded local review records.
  - User impact: stakeholder review is uneven because direct finance/business/task/contact examples pass while legal/property/cars/employment/personal/identity top-level examples remain hard to prove.
  - Evidence: 2026-06-30 browser verifier passed `/finances/bank`, `/business`, `/personal/tasks`, `/contacts`; it did not find seeded titles on `/legal/wills`, `/property`, `/cars-transport`, `/employment`, `/personal`, or `/identity-documents`.
  - Status: resolved for Preview proof on 2026-06-30. `/property` and `/personal` are overview routes by design; their editable record routes are `/vault/property` and `/vault/personal`. Cars, employment, possessions, and identity-document local seed paths were corrected. `/legal/wills` passed with stable waiting.
  - Likely files/components: category route wrappers under `app/(app)`, `components/records/UniversalRecordWorkspace.tsx`, `components/sections/SectionWorkspace.tsx`, and canonical-vs-legacy route mappings.
  - Acceptance criteria: each visible navigation route either displays its supported seeded records or clearly links to the canonical editable workspace that does.

- Product defect: canonical asset display does not consistently show the testable user-facing `Record title`.
  - User impact: saved records may be difficult to recognise if the prominent display prefers provider/name fields over the user-entered title.
  - Likely files/components: `components/records/UniversalRecordWorkspace.tsx`, `lib/assets/*Asset.ts`, `lib/assets/fieldDictionary.ts`.
  - Test required: bank/property/business save tests asserting the entered title or primary label is visible after save and refresh.
  - Status: fixed in code on 2026-06-29 for canonical card primary title display; awaiting passing browser lifecycle proof.
  - Acceptance criteria: each saved canonical record has a clear visible user-entered identifier after save, refresh, and search.

- Product defect/test gap: section-style pages need stable edit/delete controls.
  - User impact: records in Cars & Transport and Employment can be saved, but selector-specific UAT could not prove edit/delete controls.
  - Likely files/components: `components/sections/SectionWorkspace.tsx`, `app/(app)/cars-transport/page.tsx`, `app/(app)/employment/page.tsx`.
  - Test required: Playwright lifecycle tests using accessible button names for edit and delete.
  - Status: partially fixed in code on 2026-06-29 with shared search and `Edit record` / `Delete record` labels; awaiting passing browser lifecycle proof.
  - Acceptance criteria: saved section records expose accessible edit and delete/archive actions and pass lifecycle tests.

- Product defect/test gap: contacts and executor invitation/permission workflows need dedicated tests.
  - User impact: trusted contact access and executor sharing are core trust workflows and must be proven with exact selectors.
  - Likely files/components: `components/contacts/ContactsNetworkWorkspace.tsx`, `app/(app)/components/dashboard/ContactInvitationManager.tsx`, `lib/contacts/*`.
  - Test required: create contact, assign role, send/local invitation where available, adjust permissions, revoke/remove, and verify group counts.
  - Status: partially fixed in code on 2026-06-29 with dedicated contact search and updated selector-specific test inputs; invite/permission proof still required.
  - Acceptance criteria: contact appears in correct group, permissions persist after refresh/re-login, and revocation/removal is visible.

## P2 Medium

- Product defect/test gap: attachments need parent-record-specific proof.
  - User impact: document upload cannot be release-cleared until files are proven on the correct parent record.
  - Likely files/components: `components/documents/DocumentsWorkspace.tsx`, `components/documents/AttachmentGallery.tsx`, `components/records/UniversalRecordWorkspace.tsx`, `lib/storage/*`.
  - Test required: PDF, PNG/JPG, and non-previewable office-style upload; preview/download/print where available; replace/remove.
  - Acceptance criteria: supported files appear on the intended record, preview/download/print controls behave as documented, and unsupported preview falls back clearly.

- UX improvement: validation and disabled-control messaging need consistency.
  - User impact: non-technical users need clear next steps when a form cannot submit.
  - Likely files/components: auth forms, `UniversalRecordWorkspace`, `SectionWorkspace`, `DocumentsWorkspace`, settings forms.
  - Test required: browser validation checks for required fields, invalid email, duplicate-like inputs, upload errors, and delete confirmations.
  - Acceptance criteria: each blocked action has visible, accessible, specific guidance.

- Test coverage gap: dashboard count/value impact needs category-specific assertions.
  - User impact: users rely on dashboard totals to judge vault readiness.
  - Likely files/components: `app/(app)/dashboard/page.tsx`, `lib/dashboard/*`.
  - Test required: create a contributing record, verify dashboard count/value changes, archive/delete, verify totals update.
  - Acceptance criteria: dashboard totals match saved local records after refresh and re-login.

## P3 Low

- UX improvement: document route overview pages should clearly distinguish overview pages from editable workspaces.
  - User impact: users may expect `/property` to be directly editable, while editable property records live at `/vault/property`.
  - Likely files/components: `app/(app)/property/page.tsx`, navigation config.
  - Test required: navigation/CTA assertion from overview to editable workspace.
  - Acceptance criteria: overview CTAs clearly route to the create/manage workspace.

- Technical debt: local UAT runner should distinguish test assumption failures from product defects.
  - User impact: release reports become noisy when generic selectors miss actual controls.
  - Likely files/components: `tests/e2e/*`, any local-only UAT harness scripts.
  - Test required: route-specific helper coverage with structured result output.
  - Acceptance criteria: UAT output marks Passed, Failed, Blocked, or Not Available with exact route and selector evidence.

## Untested Or Blocked Workflows

- 2026-06-30 Phase 1 admin foundation implementation completed to code/build level and remains in UAT.
  - Scope: admin roles/capabilities, server-side capability checks, prototype-route guard routing, additive append-only audit-event migration, admin audit writer, and admin workspace permission labelling.
  - Evidence: `node --test tests/admin-phase1-foundation.test.mjs` passed 4/4; `npm run build` passed.
  - Affected files: `lib/admin/capabilities.ts`, `lib/admin/access.ts`, `lib/admin/audit.ts`, `lib/admin/operations.ts`, `app/api/internal/admin/session/route.ts`, `app/api/internal/admin/admin-users/route.ts`, `app/api/internal/admin/users/route.ts`, `app/api/internal/admin/support/route.ts`, `app/api/internal/admin/verifications/route.ts`, `components/admin/AdminOpsWorkspace.tsx`, `proxy.ts`, `supabase/migrations/20260630170000_admin_phase1_foundation.sql`, `tests/admin-phase1-foundation.test.mjs`.
  - Remaining gate: role-based browser UAT and local migration application proof are still required before any admin/probate production-readiness claim.
- 2026-06-30 Phase 2A probate/executor verification discovery completed.
  - Scope: discovery and design only; no probate case implementation, schema application, hosted-service access, Shure.Fund access, branch, commit, push or deployment.
  - Evidence: [ADMIN_BACKOFFICE_DELIVERY_PLAN.md](./ADMIN_BACKOFFICE_DELIVERY_PLAN.md) Phase 2A Discovery And Design section.
  - Recommended model: add one canonical `probate_cases` table plus `probate_case_evidence`, linking existing `verification_requests`, `role_assignments`, `contact_invitations`, `contacts`, `account_access_grants`, `documents`, and Phase 1 `audit_events`.
  - Remaining gate: do not implement Phase 2B until Phase 2A design is approved and Phase 1 local migration/browser role-denial/audit evidence is complete.
- 2026-07-01 Phase 1 runtime gate blocked before Phase 2B.
  - Required migration identified: `supabase/migrations/20260630170000_admin_phase1_foundation.sql`.
  - Intended local-only effect: add `admin_users.role`; create append-only `audit_events`; add actor/resource/category/route indexes; enable RLS; add update/delete prevention triggers.
  - Blocker evidence: `supabase status` failed with `Cannot connect to the Docker daemon at unix:///Users/ivan-imac/.colima/default/docker.sock`.
  - Result: no local migration was applied, schema/RLS were not verified, browser role-based admin UAT was not run, and Phase 2B was not started.
  - Next action: make the isolated local Legacy Fortress Supabase runtime reachable without touching Shure.Fund, then apply only the Phase 1 migration and rerun the runtime/browser gate.
- 2026-07-01 Phase 1 database runtime gate completed; browser gate remains blocked.
  - Applied only `supabase/migrations/20260630170000_admin_phase1_foundation.sql` to the isolated local Legacy Fortress database and recorded only version `20260630170000` in local migration history.
  - Verified `admin_users.role` column, default and check constraint.
  - Verified `audit_events` table, primary/actor/category/resource/route indexes, RLS, and append-only update/delete prevention triggers.
  - Verified a synthetic audit insert succeeds.
  - Verified audit UPDATE and DELETE attempts are rejected with `ERROR: audit_events are append-only`.
  - Browser role UAT was not run because `.env.local` points `NEXT_PUBLIC_SUPABASE_URL` to a hosted Supabase project instead of the confirmed local project URL. Continuing app/browser auth testing in that state would risk hosted access.
  - A synthetic-user preparation command read `.env.local` before this mismatch was discovered. Stop using `.env.local` for local admin UAT until it is safely isolated or overridden without touching hosted services.
  - `npm run lint` passed.
  - `npm run build` passed.
  - `npm run test:stabilisation` failed on two dashboard UI consistency assertions unrelated to Phase 1 admin runtime: attachment-gallery replace-label expectation and document/narrative value expectation.
  - Phase 2B remains blocked until browser role-based admin UAT passes against the isolated local Supabase instance.
- 2026-07-01 Phase 1 browser/runtime gate resumed with local-only env isolation; auditor read-surface gap identified.
  - Local-only environment mechanism: created ignored `.env.phase1.local.raw` and `.env.phase1.local`; loaded with command-scoped `set -a; source .env.phase1.local; set +a; PORT=3012 npm run dev`. `.env.local` was not overwritten.
  - Local-only proof: browser network capture recorded 66 requests to the local Supabase API origin and 0 hosted Supabase requests. `/api/health/schema` passed locally.
  - Local synthetic accounts: `phase1-standard@legacyfortress.test`, `phase1-support@legacyfortress.test`, `phase1-verifier@legacyfortress.test`, `phase1-probate@legacyfortress.test`, `phase1-auditor@legacyfortress.test`, `phase1-super@legacyfortress.test`, plus one `phase1-added-*` admin grant target. These are isolated local UAT rows and remain clearly identifiable by `phase1-` prefix; audit rows are append-only and were not removed.
  - Browser/API role evidence: unauthenticated `/internal/admin` redirected to sign-in; standard user denied UI and protected admin API; support agent support read allowed and admin-user management denied; verification reviewer queue read allowed and approve/reject denied; probate reviewer queue read allowed; auditor support/admin mutation denied; super admin opened admin workspace and performed an admin-user grant.
  - Audit evidence: the super-admin admin-user grant wrote one `audit_events` row; direct update/delete attempts were rejected with `ERROR: audit_events are append-only`.
  - Prototype route evidence: prototype admin route is gated in local runtime; old explicit query flag no longer opens mock operations.
  - Stabilisation fixes: `components/documents/AttachmentGallery.tsx` now gives the replace upload action an explicit reusable label; `components/records/UniversalRecordWorkspace.tsx` now keeps trusted-contact and narrative-document `value_minor`/`currency_code` as `null`.
  - Test evidence: `npm run test:stabilisation` passed 34/34; `npm run lint` passed; `npm run build` passed.
  - Remaining blocker: auditor role cannot yet inspect audit history because no read-only audit-history UI/API is implemented. Phase 2B is not safe to begin until that Phase 1 auditor-read gate is implemented and browser-proven.
- 2026-07-01 Phase 1 auditor read-only audit-history gate completed locally.
  - Added route/API: `GET /api/internal/admin/audit-history`.
  - Allowed roles proven locally: `auditor`, `super_admin`.
  - Denied roles proven locally: unauthenticated request, standard user, `support_agent`, `verification_reviewer`, `probate_reviewer`.
  - Field-safety proof: API returns only bounded audit review fields: category, action, result, actor email, actor role, resource type, resource label, route, policy decision and created timestamp. It does not return raw metadata, passwords, tokens, storage credentials, actor user IDs or resource IDs.
  - Read-only proof: no POST/PUT/PATCH/DELETE handler exists; direct `POST /api/internal/admin/audit-history` returned 405; browser audit panel had zero buttons; direct audit UPDATE and DELETE attempts still failed with `ERROR: audit_events are append-only`.
  - Browser proof: auditor opened `/internal/admin`, saw `Audit history`, and inspected an `Admin user granted` event; super admin saw the same event; standard user remained denied.
  - Local-only proof: browser network capture recorded 129 local Supabase API requests and 0 hosted Supabase requests.
  - Test evidence: `node --test tests/admin-phase1-foundation.test.mjs` passed 5/5; `npm run test:stabilisation` passed 34/34; `npm run lint` passed; `npm run build` passed.
  - Phase 1 status: runtime gate complete in the isolated local environment. Do not start Phase 2B without explicit approval.
- 2026-07-01 Phase 2B probate/executor verification runtime implemented and locally proven.
  - Added migration: `supabase/migrations/20260701193000_admin_phase2b_probate_cases.sql`.
  - Added canonical tables: `probate_cases` and `probate_case_evidence`; both are local-only applied in the isolated Legacy Fortress database for this UAT run.
  - Added routes/APIs: `GET/POST /api/internal/admin/probate-cases`, `GET /api/internal/admin/probate-cases/[caseId]`, `POST /api/internal/admin/probate-cases/[caseId]/actions`, `GET/POST /api/internal/admin/probate-cases/[caseId]/evidence`, and `GET /api/internal/admin/probate-cases/[caseId]/evidence/[evidenceId]/signed-url`.
  - Added service/workspace files: `lib/admin/probateCases.ts` and the `Probate and executor cases` live admin section in `components/admin/AdminOpsWorkspace.tsx`.
  - Local-only proof: browser network capture during UAT recorded only `http://127.0.0.1:55421` as the Supabase origin; no hosted Supabase, Vercel, Stripe, production data, real users or Shure.Fund were touched.
  - Synthetic local workflow evidence: `verificationRequestId=2699e341-0821-4275-a1fc-fa8decaa0108`, `caseId=50f0413a-f0fe-4851-b2e8-7ee8a0471e67`, `evidenceId=a65b0e83-f2b2-40cc-839f-5caec40feb2f`.
  - Role evidence: unauthenticated case API returned 401; standard user, support agent and auditor returned 403; verification reviewer could list/create/request-information/mark-review and was denied approve; probate reviewer approved and revoked; super admin read audit history.
  - Workflow evidence: case moved `submitted -> needs_information -> under_review -> approved -> revoked`; approval activated a linked access grant with `scope=probate_case` and read-only permission override; revocation set the linked grant to `revoked`.
  - Evidence proof: PDF evidence uploaded to local storage, appeared in `/internal/admin`, and opened through the signed evidence URL route rather than a public URL.
  - Audit proof: audit history included case submitted, evidence uploaded, evidence viewed, case approve and case revoke; direct audit UPDATE and DELETE attempts were still rejected by append-only triggers.
  - Test evidence: `node --test tests/admin-phase2b-probate-cases.test.mjs` passed 4/4; `node --test tests/admin-phase1-foundation.test.mjs` passed 5/5; `npm run test:stabilisation` passed 34/34; `npm run lint` passed; `npm run build` passed.
  - Remaining release risk: Phase 2B is admin-side and locally proven only. Customer-facing probate access consumption, legal wording, evidence retention policy and production rollout gates still require review before live deployment.
  - Phase 2B status: implemented and in local UAT. Do not begin Phase 3 without explicit approval.
- 2026-07-02 Phase 3 operational readiness UAT completed locally.
  - Scope: end-to-end MVP journey proof only; no deployment, commit, push, hosted Supabase/Vercel/Stripe access, production data access, real-user access, Shure.Fund access, dependency upgrade, infrastructure change, Phase 4 work or broad redesign.
  - Local-only environment: app tested at `http://localhost:3012` using command-scoped `.env.phase1.local`; browser network capture saw Supabase requests only to `http://127.0.0.1:55421`. `.env.local` was not overwritten and hosted credentials were not printed.
  - Synthetic marker: `phase3-1782988899569`.
  - Synthetic local accounts retained for continued UAT: `phase3-owner-1782988899569@legacyfortress.test`, `phase3-executor-1782988899569@legacyfortress.test`, `phase3-standard-1782988899569@legacyfortress.test`, `phase3-support-1782988899569@legacyfortress.test`, `phase3-reviewer-1782988899569@legacyfortress.test`, `phase3-probate-1782988899569@legacyfortress.test`, `phase3-auditor-1782988899569@legacyfortress.test`, `phase3-admin-1782988899569@legacyfortress.test`.
  - Account/auth proof: sign-up validation, invalid sign-in messaging and owner sign-in passed locally; dashboard loaded after authentication.
  - Core route retrieval proof after sign-in and refresh/wait: `/legal/wills` showed `Phase3 Evergreen Will`; `/finances/bank` showed `Phase3 Riverbank Current Account`; `/vault/property` showed `Phase3 Willow House`; `/business` showed `Phase3 Cedar Studio Ltd`; `/identity-documents` showed `Phase3 Fictional Passport`; `/cars-transport` showed `Phase3 Copper Roadster`; `/employment` showed `Phase3 Archivist Role`; `/personal/wishes` showed `Phase3 Letter of Wishes`; `/contacts?group=executors` showed `Phase3 Executor Contact`.
  - Dashboard proof: dashboard counts/cards reflected the seeded finance/property/business/legal categories; `/dashboard?search=Riverbank`, `/dashboard?search=Phase3%20Riverbank%20Current%20Account` and `/dashboard?search=phase3-estate-plan.pdf` found the bank record and attachment. The visible sidebar search is not the dashboard discovery proof surface.
  - Attachment proof: local storage upload and metadata creation passed for PDF, PNG image and DOCX-style files. `/finances/bank` showed `phase3-estate-plan.pdf` and `phase3-office-fallback.docx`; opening the saved record document panel exposed shared `AttachmentGallery` controls with accessible labels for preview, download, print and remove. DOCX displayed the intended open/download fallback without print.
  - Probate/evidence/access lifecycle proof: Phase 2B case moved `submitted -> needs_information -> under_review -> approved -> revoked`; PDF evidence uploaded to local `vault-docs`, signed evidence access worked for permitted reviewer, standard user evidence access returned 403, approval created a read-only `probate_case` access grant, revocation set the grant to `revoked`, and audit history contained the expected case/evidence/access events.
  - Role UAT proof: unauthenticated probate case API returned 401; standard user, support agent and auditor were denied probate case mutation; support scope read remained allowed; verification reviewer could list/review but could not approve; probate reviewer could approve/revoke; auditor could read audit history only; super admin could read audit history.
  - Mobile smoke proof: `/dashboard`, `/finances/bank`, `/contacts?group=executors` and `/internal/admin` loaded at mobile viewport without horizontal overflow in the scripted check.
  - Validation commands: `node --test tests/admin-phase1-foundation.test.mjs tests/admin-phase2b-probate-cases.test.mjs tests/dashboard-search-routing.test.mjs tests/attachment-merge.test.mjs tests/viewer-access-permissions.test.mjs` passed 19/19; `npm run test:stabilisation` passed 34/34; `npm run lint` passed; `npm run build` passed; `curl -sS http://127.0.0.1:3012/api/health/schema` returned `ok: true`.
  - Console/error findings: local browser console still emits non-blocking `Multiple GoTrueClient instances` warnings and expected local 403/404 responses for non-admin admin-session checks and missing avatar resources. No page crash was observed in Phase 3.
  - Retained data: Phase 3 synthetic Auth/profile/admin/contact/record/document/storage rows remain in the isolated local database/storage because audit events are append-only and the records are useful for repeatable local UAT. They are clearly identifiable by the `phase3-` prefix and must not be exported or deployed as production data.
  - Missing reference inputs: `Legacy_Fortress_UX_Data_Capture_Interaction_Standards.docx` and `Legacy_Fortress_Inclusion_Exclusion_Specification.docx` were requested inputs but were not present in the repository.
  - Phase 3 verdict: passed with documented non-blocking debt for controlled internal UAT. Not a production-readiness claim.
- 2026-07-03 Phase 4 customer-side linked-access and revocation proof completed locally; release gate is blocked.
  - Scope: customer-side linked executor/probate access and immediate revocation proof only; no deployment, commit, push, hosted Supabase/Vercel/Stripe access, production data access, real-user access, Shure.Fund access, dependency upgrade, migration, infrastructure change or unrelated feature work.
  - Local-only environment: app tested at `http://127.0.0.1:3012` using command-scoped `.env.phase1.local`; browser network capture saw Supabase requests only to `http://127.0.0.1:55421`.
  - Synthetic marker: `phase4-1783092424505`.
  - Synthetic local accounts retained for continued UAT: `phase4-owner-1783092424505@legacyfortress.test`, `phase4-linked-executor-1783092424505@legacyfortress.test`, `phase4-probate-reviewer-1783092424505@legacyfortress.test`, `phase4-admin-1783092424505@legacyfortress.test`.
  - Before-grant proof: linked executor did not see the owner property record or unrelated bank record in browser; direct REST reads for the owner's assets/documents returned zero rows.
  - After-approval browser proof: probate reviewer approved the case through `/internal/admin`; linked executor could see only `Phase4 Approved Property 1783092424505` in `/vault/property`; `/finances/bank` redirected back to dashboard and did not show `Phase4 Private Bank 1783092424505`; access persisted after refresh.
  - After-approval server-side blocker: the same linked executor's direct local REST query to `assets` for the owner returned both `Phase4 Approved Property 1783092424505` and unrelated `Phase4 Private Bank 1783092424505`. This means active linked grants are still too broad at RLS/API level and rely on client filtering for fine-grained asset scope.
  - After-revocation proof: probate reviewer revoked access through `/internal/admin`; same-session `/vault/property` no longer showed the approved property; direct REST returned zero owner assets; a fresh browser session after sign-in also did not show the approved property.
  - Audit proof: `audit_events` contained `Probate case approve` and `Probate case revoke` for the Phase 4 case.
  - Durable test evidence: added `tests/e2e/phase4-linked-access-revocation.spec.ts` as an expected-failing Playwright release gate. It proves UI revocation and preserves the server-side RLS leak as a known release blocker until fixed.
  - GoTrue warning diagnosis: likely caused by multiple browser-side Supabase clients: the singleton in `lib/supabaseClient.ts` plus isolated auth/recovery/request clients in auth flows. Phase 4 did not show a functional or security failure from the warning, so no code change was made.
  - Validation commands: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 npx playwright test tests/e2e/phase4-linked-access-revocation.spec.ts --project=desktop-chromium` completed with one expected failure; `node --test tests/admin-phase1-foundation.test.mjs tests/admin-phase2b-probate-cases.test.mjs` passed 9/9; `npm run test:stabilisation` passed 34/34; `npm run lint` passed; `npm run build` passed; `curl -sS http://127.0.0.1:3012/api/health/schema` returned `ok: true`.
  - Phase 4 verdict: blocked. Do not claim production readiness or pilot readiness until linked-access RLS/API scope enforces `permissions_override.asset_ids`, `record_ids`, section scope and revoked status server-side.
- 2026-07-03 Phase 4 remediation completed locally: server-side linked-access scope enforcement.
  - Added migration: `supabase/migrations/20260703153000_linked_access_scope_enforcement.sql`.
  - Local migration status: applied only this migration to the isolated local Legacy Fortress database and recorded `20260703153000 / linked_access_scope_enforcement` in local migration history. No hosted database or unrelated migration was touched.
  - Security change: replaced broad linked-select policies with scoped helpers for assets, records, section entries, documents, attachments and storage objects. Active linked grants now require explicit `permissions_override` ids or grant-contact assignments through `contact_links` / `record_contacts`; revoked grants stop matching immediately.
  - Installed policy proof: local `pg_policies` shows `assets_linked_select` using `linked_grant_allows_asset(owner_user_id, id)`, `documents_linked_select` using `linked_grant_allows_document(...)`, `records_linked_select` using `linked_grant_allows_record(owner_user_id, id)`, and attachments/contact links using the scoped record/asset helpers.
  - Browser/server proof: `tests/e2e/phase4-linked-access-revocation.spec.ts` now passes as a normal Playwright test. It proves before-grant denial, post-approval approved property visibility, unrelated bank denial in browser, unrelated asset and document-metadata denial through direct REST, refresh persistence, revocation, same-session denial, direct REST denial after revocation, fresh-session denial and audit visibility.
  - Validation commands: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 npx playwright test tests/e2e/phase4-linked-access-revocation.spec.ts --project=desktop-chromium` passed 1/1; `node --test tests/admin-phase1-foundation.test.mjs tests/admin-phase2b-probate-cases.test.mjs tests/invitation-linked-access.test.mjs tests/viewer-access-permissions.test.mjs` passed 15/15; `npm run test:stabilisation` passed 34/34; `npm run lint` passed; `npm run build` passed; `curl -sS http://127.0.0.1:3012/api/health/schema` returned `ok: true`.
  - Phase 4 remediation verdict: passed locally. This removes the specific server-side linked-access scope blocker found in Phase 4.
- 2026-07-04 Phase 5 staging-release preparation completed; staging gate is blocked pending approved staging access.
  - Scope: staging readiness, migration control and independent security re-proof planning only. No production deploy, commit, push, hosted database access, customer data access, Shure.Fund access or staging migration was performed.
  - Current branch/status: `uat-remediation-preview` with accumulated Phase 1-4 app/security changes, documentation changes, local-UAT-only config changes and review-sensitive dirty files.
  - Review-sensitive files: `supabase/config.toml` contains local-only project id, port, email/site URL, edge-runtime and analytics changes for isolated UAT and must not be included in a staging release without separate review; `tsconfig.json` contains formatting churn plus generated `.next/dev/dev/types/**/*.ts` include and requires review before commit/deploy packaging.
  - Migration reviewed for staging: `supabase/migrations/20260703153000_linked_access_scope_enforcement.sql`.
  - Migration assessment: intended to replace broad linked-select policies with scoped linked-grant helper functions for assets, records, section entries, documents, attachments and storage. It preserves owner policies and requires active accepted/verified/active grants plus explicit scoped ids or canonical contact/record links. Revoked grants cease to match at RLS level.
  - Staging pre-flight blocker: no approved staging project URL/API origin, migration history, database isolation confirmation, backup/restore procedure, rollback owner or synthetic-account permission was provided. Therefore no staging credentials were used and no hosted service was contacted.
  - Required pre-apply checks: confirm staging is not production, confirm migration `20260703153000` is absent, confirm prerequisite migrations `20260324103000`, `20260630170000` and `20260701193000` are present, capture current linked-select policies/functions, verify backup/checkpoint, and identify rollback approver.
  - Required post-apply checks: inspect `pg_policies` for scoped linked policies, run direct REST/RLS denial tests before grant, after scoped grant and after revocation, verify storage/document metadata denial, verify audit events, and rerun Phase 1/2B/linked-access/stabilisation/lint/build gates.
  - Synthetic staging data plan: use only `staging-phase5-owner-*`, `staging-phase5-linked-executor-*`, `staging-phase5-probate-reviewer-*`, `staging-phase5-auditor-*`, `staging-phase5-super-admin-*` and fictional `Staging Phase5` records/documents.
  - Phase 5 verdict: staging preparation complete, awaiting explicit staging environment approval and backup/rollback confirmation.
- 2026-07-04 Phase 5 continuation attempted; still blocked before hosted staging access.
  - Approval received to use an isolated staging environment, but no secure staging environment variables or staging env file were available to this shell.
  - Checked for staging/Supabase/Playwright/rollback variable names only; no values were printed and no credentials were exposed.
  - Result: staging target could not be verified, migration history could not be inspected, backup/checkpoint could not be confirmed, rollback owner could not be validated, and `20260703153000_linked_access_scope_enforcement.sql` was not applied to any hosted project.
  - No synthetic staging accounts or data were created.
  - No hosted Supabase, Vercel, Stripe, production data, real users or Shure.Fund systems were accessed.
  - Next unblocker: provide the approved staging details through the secure local environment mechanism before rerunning Phase 5.
- 2026-07-04 Phase 5A secure staging configuration preparation completed.
  - Scope: repository-only preparation. No hosted service access, migration, deploy, commit, push, browser test, real account, Shure.Fund or production-system contact.
  - Added non-secret ignored template: `.env.staging.example`.
  - Added setup guide: [STAGING_ENVIRONMENT_SETUP.md](./STAGING_ENVIRONMENT_SETUP.md).
  - Environment inventory covered Supabase browser/admin variables, application URLs, Playwright/browser test variables, migration DB access, test persona controls and provider placeholders.
  - Git-ignore assessment: `.gitignore` ignores `.env*`, so `.env.staging.example` and future `.env.staging.local` files are ignored. This is safe for secrets, but means the template is local handover material rather than a normal committed template.
  - Accidental-production risk remains if `.env.local` or shell variables point at hosted production while browser tests run. Phase 5 must load an explicit staging env and verify browser network origins before account creation or sign-in.
- 2026-07-04 Phase 5B local release package review completed.
  - Scope: local release package audit only. No hosted Supabase, Vercel, Stripe, Shure.Fund, third-party service, production system, deploy, commit, push, hosted migration or staging environment was accessed.
  - Current basis: controlled local internal UAT only; no pilot or production readiness claim.
  - Dirty-file categories:
    - Approved Phase 1-4 application/security changes: `app/api/internal/admin/*`, `components/admin/AdminOpsWorkspace.tsx`, `components/documents/AttachmentGallery.tsx`, `components/records/UniversalRecordWorkspace.tsx`, `lib/admin/*`, `proxy.ts`, and migrations `20260630170000`, `20260701193000`, `20260703153000`.
    - Documentation and handover: `.gitignore`, `.env.example`, `.env.staging.example`, `docs/ADMIN_BACKOFFICE_DELIVERY_PLAN.md`, `docs/STAGING_ENVIRONMENT_SETUP.md`, `docs/BUILD_AND_RELEASE.md`, `docs/KNOWN_TECH_DEBT.md`, `docs/UAT_REMEDIATION_TODO.md`.
    - Automated tests: `tests/admin-phase1-foundation.test.mjs`, `tests/admin-phase2b-probate-cases.test.mjs`, `tests/csp-local-supabase.test.mjs`, and the current e2e UAT/release-gate specs under `tests/e2e/`.
    - Local-only UAT/review-sensitive: `supabase/config.toml` local port/site/email changes; ignored `.env.local`, `.env.phase1.local`, `.env.phase1.local.raw`; and `tsconfig.json` formatting/generated include drift.
  - Must exclude from future commit/deploy without separate review: `supabase/config.toml`, `tsconfig.json`, all secret-bearing `.env*` files such as `.env.local`, `.env.phase1.local`, `.env.phase1.local.raw`, `.env.staging.local`, generated `.next`, `test-results`, screenshots and local storage/database dumps.
  - Migration-chain review: required migrations are present and ordered after their prerequisites: `20260324103000_contact_invitation_view_only_access.sql`, `20260630170000_admin_phase1_foundation.sql`, `20260701193000_admin_phase2b_probate_cases.sql`, `20260703153000_linked_access_scope_enforcement.sql`.
  - Local reproducibility: code/migrations/docs/templates are present, but recreating the exact local UAT environment still requires private ignored local env values and local Supabase data/seed steps. No secrets are committed.
  - Verification evidence: `npm run test:stabilisation` passed 34/34; `node --test tests/admin-phase1-foundation.test.mjs tests/admin-phase2b-probate-cases.test.mjs tests/invitation-linked-access.test.mjs tests/viewer-access-permissions.test.mjs` passed 15/15; Phase 4 Playwright linked-access revocation test passed 1/1 against local UAT; `npm run lint` passed; `npm run build` passed; local `/api/health/schema` returned `ok: true`.
  - Verdict: ready for controlled local internal UAT. Not suitable for pilot or production without staging or equivalent hosted non-production re-proof.
- 2026-06-30 Phase 6 discovery-only codebase consolidation audit completed.
  - Scope: repository simplification audit only; no app code, schema, migrations, branch, deployment, hosted-service, production-data or Shure.Fund changes.
  - Evidence: [ADMIN_BACKOFFICE_DELIVERY_PLAN.md](./ADMIN_BACKOFFICE_DELIVERY_PLAN.md) Phase 6 section.
  - Git topology: current branch `uat-remediation-preview` is 9 commits ahead of `origin/main`; local `main` is 5 commits ahead of `origin/main`; `uat-remediation-preview` adds 4 commits beyond local `main`.
  - Dirty files observed: `docs/UAT_REMEDIATION_TODO.md`, `supabase/config.toml`, `tsconfig.json`; untracked `docs/ADMIN_BACKOFFICE_DELIVERY_PLAN.md` and local UAT/e2e test files.
  - Consolidation findings: `UniversalRecordWorkspace` is the preferred canonical record surface; `SectionWorkspace` remains active for `/cars-transport`, `/employment`, and `/personal/wishes`; `documents`/`AttachmentGallery` are preferred while `attachments` and `file_path` remain compatibility paths; canonical contacts use `contacts/contact_links/contact_invitations` while `record_contacts` and legacy people routes remain compatibility paths.
  - Retirement rule: do not remove `section_entries`, `records`, `attachments`, `record_contacts`, `/signin`, or `/internal/admin/prototype/*` without a separate approval, route parity proof, browser UAT, rollback plan, and deployment review.
- 2026-06-30 local owner browser verification blocked/failing items:
  - Dashboard owner display text did not include `Alex Morgan`, although the visible topbar avatar loaded from the synthetic owner avatar.
  - Dashboard search, seeded route retrieval, identity lifecycle, contacts search, and owner-to-demo transition were re-proven by `tests/e2e/preview-readiness-release-gate.spec.ts`.
  - Browser console logged repeated local `403` responses from `/api/internal/admin/session`; classified as expected non-admin admin-access restriction with no tested user-flow impact.
- 2026-06-30 demo browser verification:
  - Clean `/demo` browser run passed and showed the corrected reviewer/owner context.
  - Owner sign-in -> sign-out -> `/demo` now passes in focused Playwright release-gate proof.
- Full legal category matrix beyond `/legal/wills`.
- Full finance matrix beyond bank save attempt and canonical display checks.
- Identity documents full lifecycle and attached scan/photo behavior.
- Reminder/review-date persistence across all categories.
- Executor invitation email/acceptance and permission revocation.
- Admin/support/probate/audit actions beyond route accessibility and basic search surfaces.
- Mobile CRUD, upload, and permission workflows beyond responsive route loading.

## Do Not Deploy Until

- `npm run lint` passes or the known `tests/workspace-switcher.test.mjs` parse error is resolved in an approved change.
- Production build passes after all UAT fixes.
- Selector-specific CRUD tests pass for every primary category.
- Auth sign-up, confirmation, sign-in, reset, refresh, protected deep-link return, onboarding/terms, and sign-out pass.
- Attachment tests pass for PDF, image, and non-previewable office-style files.
- Dashboard count/value tests pass after create/edit/archive/delete.
- Contacts, executor, sharing, permission, and revocation workflows pass with synthetic local users.
- No hosted Supabase, Stripe, Vercel, production data, or live deployment is touched during release-candidate testing.

## 2026-07-04 Phases 6-8 Local UAT Hardening Evidence

- Status: passed with documented non-blocking debt. Position remains controlled local internal UAT only; no pilot or production readiness claim.
- Safety: local-only work in `/Users/ivan-imac/legacy-fortress-web`; no hosted Supabase, Vercel, Stripe, production data, real accounts, live email, Shure.Fund or third-party systems were accessed.
- Phase 6 fixes:
  - Added `lib/auth/browserAuthClient.ts` and moved sign-up/password-reset helper clients to non-persistent, purpose-scoped browser auth clients to prevent duplicate session-client warnings in normal auth flows.
  - Clarified dashboard/sidebar search scope in `app/(app)/layout.tsx` and `app/(app)/dashboard/page.tsx` with accessible labels, result heading, empty state and clear action.
  - Replaced `/executors` server redirect with a client-side redirect/status page to avoid the local Next dev `ExecutorsRedirectPage` negative performance timestamp error.
  - Kept document-style record UI non-monetary while writing legacy-compatible `value_minor: 0` and `currency_code: "GBP"` where the existing `records` table still has not-null constraints.
- Phase 7 contact decision:
  - No new contact model or migration was introduced. Existing canonical contacts are `contacts`, `contact_links` and `contact_invitations`; `record_contacts` and legacy people routes remain compatibility surfaces.
  - Contact search now expands matching groups during search so newly created contacts are visible on desktop/mobile without manually opening the group.
- Phase 8 proof:
  - Browser auth/session: `auth-hydration-console`, `auth-session-phase1` and Phase 4 linked-access revocation tests passed against `http://127.0.0.1:3012` and local Supabase `http://127.0.0.1:55421`.
  - Browser CRUD/search: finance, legal wills, property, business, cars/transport, employment and contacts self-contained UAT paths were run; legal wills save was repaired and re-proven.
  - Attachments: canonical and legacy records passed upload, preview, download, print for previewable files, replace, remove and DOCX/non-previewable fallback. Legacy section uploads now use the same user-scoped storage prefix convention as other vault documents.
  - Dashboard counts: create/edit/delete/refresh/re-login count proof passed for finance, property and business.
  - Mobile smoke: passed sign-in, dashboard, canonical record, legacy record, contact add/search/remove, attachment upload/remove, navigation and sign-out.
- Commands/results:
  - `node --test tests/auth-browser-client.test.mjs tests/dashboard-ui-consistency.test.mjs tests/platform-architecture-stabilisation.test.mjs tests/contact-editing.test.mjs tests/canonical-contact-reuse.test.mjs tests/executors-unification.test.mjs tests/people-role-unification.test.mjs tests/admin-phase1-foundation.test.mjs tests/admin-phase2b-probate-cases.test.mjs tests/invitation-linked-access.test.mjs tests/viewer-access-permissions.test.mjs tests/linked-document-preview.test.mjs tests/contact-permissions.test.mjs` passed 44/44.
  - `npm run test:stabilisation` passed 34/34.
  - `npm run lint` passed.
  - `npm run build` passed.
  - `curl -sS http://127.0.0.1:3012/api/health/schema` returned `ok: true`.
  - `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 npx playwright test tests/e2e/auth-hydration-console.spec.ts tests/e2e/auth-session-phase1.spec.ts tests/e2e/phase4-linked-access-revocation.spec.ts --project=desktop-chromium` passed 8/8.
  - Focused self-contained browser proofs for legal wills, attachments, dashboard counts and mobile smoke passed after targeted fixes.
- Synthetic data:
  - Playwright-created final/phase synthetic users are cleaned up where the test owns the user. Append-only audit evidence and local UAT records created by browser tests may remain in the isolated local database for repeatability/evidence.
- Remaining non-blocking debt:
  - Canonical/legacy persistence split remains: `SectionWorkspace`, `section_entries`, `records`, `attachments` and `record_contacts` are compatibility surfaces until a separate approved migration/backfill/retirement phase.
  - Dashboard count browser proof is intentionally split/focused because the all-in-one self-contained suite is too slow as a single release gate.

## 2026-07-12 Admin / Application Dashboard Foundation

- Scope: admin/application dashboard foundation only; no hosted systems, production data, real users, deployment, commit, push, Shure.Fund, Stripe or Vercel interaction.
- Implemented:
  - `/admin` as the canonical admin landing route.
  - `/admin/access-denied` as the safe non-admin denial route.
  - `/api/internal/admin/dashboard-summary` for aggregate-only operational metrics.
  - `/api/internal/admin/local-role-override` for local-only role-matrix testing by an authorised super admin.
  - Canonical role/capability docs and metric docs: [ADMIN_FOUNDATION.md](./ADMIN_FOUNDATION.md), [ADMIN_ROLE_MATRIX.md](./ADMIN_ROLE_MATRIX.md), [ADMIN_DASHBOARD_METRICS.md](./ADMIN_DASHBOARD_METRICS.md), [ADMIN_UAT.md](./ADMIN_UAT.md).
- Safety evidence:
  - Unauthenticated request to `/api/internal/admin/dashboard-summary` returned `401 Unauthorized` and did not expose dashboard data.
  - Dashboard metrics return aggregate counts/status only; no passwords, tokens, document contents, signed storage URLs or private vault record details are exposed.
  - Local role override is cookie-based, local-runtime gated and capability-gated.
- Verification:
  - `node --test tests/admin-phase1-foundation.test.mjs tests/admin-phase2b-probate-cases.test.mjs tests/platform-architecture-stabilisation.test.mjs` passed 19/19.
  - `npm run lint` passed.
  - `npm run build` passed.
  - `npm run test:stabilisation` currently fails two dashboard/onboarding UI assertions unrelated to the new admin dashboard foundation: avatar hydration test text no longer matches the current layout implementation, and the onboarding structured-capture assertion expects older copy/layout.
  - Playwright local smoke rendered `/admin/access-denied` on desktop/mobile; full role-account browser proof is still outstanding.
- Remaining blocker before claiming Phase 1 complete:
  - Create or reuse synthetic local admin-role accounts and prove support-agent, verification-reviewer, probate-reviewer, auditor, enterprise-admin, super-admin, standard-user and revoked-admin access/denial in the browser and through protected APIs.
  - Validate dashboard aggregate counts against known local synthetic data.
  - Confirm real authorised admin dashboard access writes the expected append-only audit event.
