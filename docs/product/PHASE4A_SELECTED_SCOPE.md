# Phase 4A Selected Scope

Last updated: 2026-07-13

## Objective

Phase 4A improves customer dashboard consistency and proves canonical customer data for a controlled local UAT slice. It does not broaden admin, probate, enterprise, contact invitation, migration, or deployment scope.

## Included Routes

| Route | Reason included | Shared components | Data source |
| --- | --- | --- | --- |
| `/property` | Property records have a canonical `UniversalRecordWorkspace` at `/vault/property`. | `CanonicalAssetOverviewGrid`, `DashboardAssetSummaryCard` | canonical `assets` scoped to property/property |
| `/business` | Business interests have a canonical `UniversalRecordWorkspace` at `/vault/business`. | `CanonicalAssetOverviewGrid`, `DashboardAssetSummaryCard` | canonical `assets` scoped to business/business |
| `/vault/digital` | Digital records have a canonical workspace and typed add links. | `CanonicalAssetOverviewGrid`, `DashboardAssetSummaryCard` | canonical `assets` scoped to digital/digital and filtered by safe metadata type |
| `/vault/personal` | Possession records have a canonical workspace and typed add links. | `CanonicalAssetOverviewGrid`, `DashboardAssetSummaryCard` | canonical `assets` scoped to personal/possessions and filtered by safe metadata type |

## Excluded Routes

| Route | Reason excluded |
| --- | --- |
| `/dashboard` | Broad dashboard already has Phase 3 proof and more behaviour than this narrow consistency pass. |
| `/finances` | Already has Phase 3 browser proof and intentionally merges canonical assets with legacy finance records. |
| `/legal` | Mixed canonical/legacy legal route; legal forms and linked contacts are still being product-refined. |
| `/finances/pensions`, `/finances/investments`, `/finances/insurance`, `/finances/debts` | Mixed/legacy finance details remain outside this dashboard consistency pass. |
| `/employment`, `/cars-transport`, `/personal/wishes`, `/support` | `section_entries`/legacy workspaces remain available but are not safe to count as canonical dashboard proof. |
| `/contacts`, `/access-requests` | Security and invitation workflows are separate functional tracks. |
| `/internal/admin`, enterprise dashboards, probate dashboards | Explicitly out of scope. |

## Acceptance Criteria

- Selected overview routes use shared dashboard cards rather than page-specific card implementations.
- Selected overview routes read canonical assets through shared Supabase/client helpers.
- Empty selected tiles expose a single `Add record` action.
- Populated selected tiles show count-only summaries and do not leak filenames, contact details, account numbers, notes, document bodies, or unrelated owner data.
- Selected route counts survive refresh and do not count deleted/archived rows.
- Desktop and mobile browser proof covers empty, populated, mixed, isolation and navigation states.
- At least one canonical category is proven through UI create -> dashboard retrieval.

## Rollback Boundary

Rollback is limited to:

- `app/(app)/components/dashboard/CanonicalAssetOverviewGrid.tsx`
- selected overview page wiring for `/property`, `/business`, `/vault/digital`, `/vault/personal`
- Phase 4A docs, fixtures, and tests
- package test-script registration if applied

No database schema, migrations, hosted settings, RLS policies, Supabase configuration, admin routes, probate routes, or enterprise routes are part of this rollback boundary.

## Risks

- Vehicles still route through `/cars-transport`, which remains legacy. It is shown as a customer-facing path but is not counted as canonical transport proof.
- Finance and legal remain mixed by design until separate migration decisions are approved.
- Contact invitation and document-scoped access status remain separate from Phase 4A dashboard card proof.

## Test Plan

- Static unit proof:
  - `tests/category-dashboard-consistency.test.mjs`
  - `tests/phase3-product-governance.test.mjs`
  - `tests/phase4a-customer-dashboard-data-proof.test.mjs`
- Browser proof:
  - `tests/e2e/phase4a-customer-dashboard-consistency.spec.ts`
- Regression:
  - `npm test`
  - `npm run test:core`
  - `npm run test:stabilisation`
  - `npm run lint`
  - `npm run build`
  - existing Phase 3 and admin role-matrix Playwright tests

## Evidence

2026-07-13 local-only Phase 4A evidence:

- `npx tsc --noEmit --pretty false`: passed.
- `npm test`: passed.
- `npm run test:core`: passed.
- `npm run test:stabilisation`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `node --test tests/admin-phase1-foundation.test.mjs`: passed.
- `node --test tests/category-dashboard-consistency.test.mjs`: passed.
- `node --test tests/phase3-product-governance.test.mjs`: passed.
- `node --test tests/phase4a-customer-dashboard-data-proof.test.mjs`: passed.
- `curl -sS http://127.0.0.1:3012/api/health/schema`: passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 npx playwright test tests/e2e/phase3-dashboard-tile-consistency.spec.ts --project=desktop-chromium --reporter=line`: passed 2/2, including mobile viewport.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 npx playwright test tests/e2e/phase4a-customer-dashboard-consistency.spec.ts --project=desktop-chromium --reporter=line`: passed 7/7, covering empty, populated, mixed, isolation, selector-specific add navigation, UI create/retrieval, refresh and mobile viewport states.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 npx playwright test tests/e2e/admin-role-matrix-local.spec.ts --project=desktop-chromium --reporter=line`: passed 13/13 when rerun serially. A parallel run with another browser suite produced a transient disabled-sign-in-button timeout during shared fixture setup, so this suite should remain serial for release gates.
