# Known Tech Debt

Only confirmed repo issues or duplication are listed here.

## High severity

- Mixed canonical and legacy workspace stacks
  - Files:
    - [components/records/UniversalRecordWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/records/UniversalRecordWorkspace.tsx)
    - [components/sections/SectionWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/sections/SectionWorkspace.tsx)
    - `app/(app)/employment/page.tsx`
    - `app/(app)/cars-transport/page.tsx`
    - `app/(app)/support/page.tsx`
    - `app/(app)/personal/wishes/page.tsx`
  - Issue:
    - The app still uses both canonical `assets/documents` and legacy `section_entries/file_path` patterns.

- Auth route usage is not fully normalized
  - Files:
    - [app/sign-in/page.tsx](/Users/ivan-imac/legacy-fortress-web/app/sign-in/page.tsx)
    - [app/signin/page.tsx](/Users/ivan-imac/legacy-fortress-web/app/signin/page.tsx)
    - multiple `router.replace("/signin")` references across `app/` and `components/`
  - Issue:
    - Both `/sign-in` and `/signin` are still referenced in the codebase.

## Medium severity

- Duplicate document storage models
  - Files:
    - [lib/assets/documentLinks.ts](/Users/ivan-imac/legacy-fortress-web/lib/assets/documentLinks.ts)
    - [components/records/UniversalRecordWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/records/UniversalRecordWorkspace.tsx)
    - `supabase/migrations/20260309113000_add_universal_record_pattern_tables.sql`
  - Issue:
    - `public.documents` and `public.attachments` both exist and are both read by current workspaces.

- Legacy `file_path` still exists in active paths
  - Files:
    - [components/sections/SectionWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/sections/SectionWorkspace.tsx)
    - `app/(app)/vault/[section]/[id]/page.tsx`
    - `supabase/migrations/20260307190000_route_parity_workspace_tables.sql`
    - `supabase/migrations/20260315162000_canonical_wallet_asset_document_model.sql`
  - Issue:
    - Old single-file attachment shape is still present in schema and some route logic.

- Hardcoded forms still exist where canonical config is not yet adopted
  - Files:
    - [components/records/UniversalRecordWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/records/UniversalRecordWorkspace.tsx)
  - Issue:
    - Bank/property/beneficiary/executor/task use config-driven fields, but several categories still render hardcoded field groups inside the same workspace.

 - Service-role admin flows depend on local secret quality
  - Files:
    - [.env.local](/Users/ivan-imac/legacy-fortress-web/.env.local)
    - [lib/supabaseAdmin.ts](/Users/ivan-imac/legacy-fortress-web/lib/supabaseAdmin.ts)
    - [app/api/health/schema/route.ts](/Users/ivan-imac/legacy-fortress-web/app/api/health/schema/route.ts)
  - Issue:
    - A truncated `SUPABASE_SERVICE_ROLE_KEY` causes admin verification and seed flows to fail with 401 even when anon-authenticated app flows still work.

## Low severity

- App routes and older vault routes overlap
  - Files:
    - `app/(app)/property/page.tsx`
    - `app/(app)/vault/property/page.tsx`
    - `app/(app)/vault/financial/page.tsx`
    - `app/(app)/vault/legal/page.tsx`
    - `app/(app)/vault/business/page.tsx`
    - `app/(app)/vault/digital/page.tsx`
  - Issue:
    - Multiple navigation surfaces still coexist for related data domains.

- Development/smoke tracing is embedded in production app code paths
  - Files:
    - [app/(app)/layout.tsx](/Users/ivan-imac/legacy-fortress-web/app/(app)/layout.tsx)
    - [components/records/UniversalRecordWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/records/UniversalRecordWorkspace.tsx)
    - [lib/devSmoke.ts](/Users/ivan-imac/legacy-fortress-web/lib/devSmoke.ts)
  - Issue:
    - Debug and trace hooks are guarded, but the production code paths still carry substantial dev-smoke instrumentation.

- Commercial positioning stops short of billing implementation
  - Files:
    - [app/onboarding/page.tsx](/Users/ivan-imac/legacy-fortress-web/app/onboarding/page.tsx)
    - [app/sign-in/page.tsx](/Users/ivan-imac/legacy-fortress-web/app/sign-in/page.tsx)
    - [app/signup/page.tsx](/Users/ivan-imac/legacy-fortress-web/app/signup/page.tsx)
    - [app/(app)/layout.tsx](/Users/ivan-imac/legacy-fortress-web/app/(app)/layout.tsx)
  - Issue:
    - The app now positions itself as a premium secure service, but upgrade and plan surfaces remain copy-only until billing/product packaging is implemented.

- Plan framework is readiness-only, not a live payments stack
  - Files:
    - [lib/accountPlan.ts](/Users/ivan-imac/legacy-fortress-web/lib/accountPlan.ts)
    - [app/(app)/account/billing/page.tsx](/Users/ivan-imac/legacy-fortress-web/app/(app)/account/billing/page.tsx)
    - [app/api/billing/portal/route.ts](/Users/ivan-imac/legacy-fortress-web/app/api/billing/portal/route.ts)
  - Issue:
    - Owner plan state and starter/premium gating now exist, but live checkout, invoicing, dunning, and provider webhooks are still future work.

## Rules for future prompts

- Do not add another legacy CRUD pattern when `UniversalRecordWorkspace` or a canonical asset helper already exists.
- Do not add page-level duplicate attachment UIs when [AttachmentGallery.tsx](/Users/ivan-imac/legacy-fortress-web/components/documents/AttachmentGallery.tsx) or [DocumentsWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/documents/DocumentsWorkspace.tsx) already covers the need.
- Do not add hardcoded fields to a category that already has a config in [fieldDictionary.ts](/Users/ivan-imac/legacy-fortress-web/lib/assets/fieldDictionary.ts).
- Normalize routes to the current public auth path (`/sign-in`) instead of introducing more alias dependence.
 - Seeded canonical contacts may retain compatibility contexts without a real linked record
  - Files:
    - [scripts/seed-bill-smith-review-account.mjs](/Users/ivan-imac/legacy-fortress-web/scripts/seed-bill-smith-review-account.mjs)
    - [lib/contacts/canonicalContacts.ts](/Users/ivan-imac/legacy-fortress-web/lib/contacts/canonicalContacts.ts)
  - Issue:
    - Context cleanup now prefers live `contact_links`, but intentionally retains unmatched compatibility contexts such as the synthetic trustee placeholder when there is no real linked trust record yet.
