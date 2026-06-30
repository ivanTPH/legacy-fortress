# Legacy Fortress UAT Remediation TODO

Date: 2026-06-29

Scope: isolated local browser UAT at `http://localhost:3012` against the Legacy Fortress local Supabase project on `127.0.0.1:55421`, using synthetic users, fictional records, and dummy files only. No hosted Supabase, Vercel, Stripe, production data, live users, or Shure.Fund systems were touched.

Related docs: [BUILD_AND_RELEASE.md](./BUILD_AND_RELEASE.md), [KNOWN_TECH_DEBT.md](./KNOWN_TECH_DEBT.md), [ATTACHMENT_AND_DOCUMENT_ARCHITECTURE.md](./ATTACHMENT_AND_DOCUMENT_ARCHITECTURE.md), [route-matrix.md](./route-matrix.md).

## Verified Fixes Completed

- Product defect: `/executors` no longer triggers the local browser runtime error `ExecutorsRedirectPage cannot have a negative time stamp`; it redirects through a small client redirect page to `/contacts?group=executors`.
- UX improvement: `/forgot-password` now explains the empty-email disabled state with accessible inline guidance while still blocking blank reset requests.
- Test coverage: auth hydration console coverage now includes `/`, `/sign-in`, `/sign-up`, `/forgot-password`, and invalid reset links.
- Test coverage: focused browser assertions cover the executor redirect and forgot-password guidance.
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
