# Legacy Fortress Runtime Schema Manifest (Stabilisation Baseline)

This document is the runtime-safe schema reference for application code paths that must not crash when optional migrations are missing.

## Baseline rule
- Future edits must use **verified runtime schema** checks (via `lib/schemaSafe.ts`) before querying optional tables/columns.
- Optional infrastructure (for example onboarding tables) must fail safely and must not crash core asset pages.

## Canonical chain used by runtime
- `organisations -> wallets -> assets -> documents`

---

## `public.organisations`

### Verified required columns
- `id`
- `owner_user_id`

### Verified optional columns
- `created_at`
- `name`

### Code paths
- `lib/canonicalPersistence.ts` (`ensureWalletContext`)

---

## `public.wallets`

### Verified required columns
- `id`
- `owner_user_id`

### Verified optional columns
- `organisation_id`
- `status`
- `label`
- `created_at`

### Columns currently treated as optional/possibly absent
- `organisation_id`
- `status`

### Code paths
- `lib/canonicalPersistence.ts` (`ensureWalletContext`)
- Consumers: `components/records/UniversalRecordWorkspace.tsx`, `lib/assets/createAsset.ts`, `app/(app)/dashboard/page.tsx`

---

## `public.assets`

### Verified required columns used by runtime queries/writes
- `id`
- `owner_user_id`
- `wallet_id`
- `section_key`
- `category_key`
- `title`
- `metadata_json`

### Verified optional columns used by runtime where available
- `organisation_id`
- `provider_name`
- `provider_key`
- `summary`
- `value_minor`
- `currency_code`
- `status`
- `visibility`
- `archived_at`
- `deleted_at`
- `updated_at`
- `created_at`

### Code paths
- `components/records/UniversalRecordWorkspace.tsx`
- `lib/assets/createAsset.ts`
- `app/(app)/dashboard/page.tsx`
- `lib/canonicalPersistence.ts` (context only)

---

## `public.documents`

### Verified required columns used by runtime queries/writes
- `id`
- `asset_id`
- `owner_user_id`
- `wallet_id`
- `storage_bucket`
- `storage_path`
- `file_name`
- `mime_type`

### Verified optional columns used by runtime where available
- `organisation_id`
- `size_bytes`
- `checksum`
- `document_kind`
- `created_at`
- `updated_at`
- `deleted_at`

### Code paths
- `components/records/UniversalRecordWorkspace.tsx`

---

## Onboarding infrastructure

## `public.user_onboarding_state`

### Runtime status
- Treated as **optional** at runtime.
- App must not crash if table or columns are missing.

### Columns probed by runtime
- `user_id` (required to use table)
- `current_step`
- `completed_steps`
- `is_completed` (required to enforce gating)
- `terms_accepted`
- `marketing_opt_in`
- `tour_opt_in`
- `updated_at`

### Fallback behavior if missing
- `lib/onboarding/index.ts` returns safe fallback completed state.
- `app/(app)/layout.tsx` catches onboarding errors and continues without crashing core app routes.

---

## Shared schema-safe helpers

Use:
- `lib/schemaSafe.ts`
  - `hasTable(client, table)`
  - `hasColumn(client, table, column)`

And shared error helpers:
- `lib/supabaseErrors.ts`
  - `isMissingRelationError`
  - `isMissingColumnError`

No new persistence path should introduce ad hoc string parsing for schema checks.

---

## Dashboard graceful degradation

- Dashboard summary loading must **not** hard-fail if `organisations` is unavailable.
- Use read-safe wallet resolution (`resolveWalletContextForRead`) and continue with owner/wallet-safe summary queries.
- If optional upstream context is unavailable, render card-level empty/incomplete states rather than a full-page failure.

---

## Local dev smoke harness (no production auth bypass)

Purpose:
- Verify Dashboard and Bank rendered states locally without requiring admin user provisioning in constrained environments.

Safety:
- Enabled only when all conditions are true:
  - `NODE_ENV=development`
  - hostname is `localhost` or `127.0.0.1`
  - query param `lf_dev_smoke=1`
- No production auth/security path is changed.

Variant query param:
- `lf_dev_variant=empty` -> empty-state verification
- `lf_dev_variant=fixture` -> fixture record verification

Run:
1. Start app locally: `npm run dev`
2. Execute smoke harness:
   - `node scripts/smoke-dashboard-bank-dev.mjs`

What this verifies:
- Dashboard shell renders without organisations-wallet hard-failure banner
- Bank empty state renders
- Guided capture opens from Add bank account
- Upload staging area is visible
- Fixture bank record card renders in fixture mode
