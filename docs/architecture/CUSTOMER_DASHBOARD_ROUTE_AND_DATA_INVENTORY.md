# Customer Dashboard Route And Data Inventory

Last updated: 2026-07-13

Phase 4A records which customer-facing dashboard routes can be safely proven with canonical local data and which routes still rely on legacy or mixed persistence. This document is an inventory, not a claim of enterprise/admin readiness.

## Baseline

- Branch inspected: `uat-remediation-preview`.
- Local customer app URL: `http://127.0.0.1:3012`.
- Local Supabase category: isolated local API at `127.0.0.1:55421`.
- Local env category: `.env.phase1.local`.
- Schema health: `/api/health/schema` returned OK locally before Phase 4A code changes.
- Existing browser proof before Phase 4A changes:
  - `tests/e2e/phase3-dashboard-tile-consistency.spec.ts`: passed on desktop Chromium.
  - `tests/e2e/admin-role-matrix-local.spec.ts`: passed on desktop Chromium.

## Missing Referenced Source Documents

The Phase 4A prompt referenced these files, but they were not present in the repository during inspection:

- `README_PROJECT_OPERATING_RULES_SNIPPET.md`
- `Legacy_Fortress_Inclusion_Exclusion_Specification.docx`
- `Legacy_Fortress_UX_Data_Capture_Interaction_Standards.docx`

Existing repo documentation was used instead, especially `docs/product/DASHBOARD_BOUNDARIES_AND_PRIVACY.md`, `docs/architecture/DASHBOARD_COMPONENT_STANDARD.md`, and `docs/CODEX_HANDOVER.md`.

## Route Inventory

| Route | Primary component | Data source | Persistence classification | Count status | Empty CTA | Populated card status | Mobile status | Attachments | Contacts | Inconsistency / risk | Phase 4A safe to change |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/dashboard` | `app/(app)/dashboard/page.tsx`, `DashboardAssetSummaryCard` | canonical `assets`, documents, contacts projections | canonical plus dashboard aggregations | proven in Phase 3 for core cards | existing action-centre/card actions | existing | existing Phase 3 proof | summarized only | summarized only | broad page with more behaviour than Phase 4A selected slice | No, observe only |
| `/finances` | `app/(app)/finances/page.tsx`, `DashboardAssetSummaryCard` | `loadFinanceDashboardRows` from canonical `assets` plus legacy finance `records` | mixed canonical/legacy compatibility | proven in Phase 3 | `?add=1` links | real values/counts | existing Phase 3 proof | not counted | none | intentionally mixed while finance migration compatibility remains | No code change |
| `/finances/bank` | `UniversalRecordWorkspace` | canonical `assets` | canonical | source of finance dashboard counts | supported | supported | inherited workspace behaviour | shared attachment architecture | no contact proof in Phase 4A | form/workspace not in dashboard scope | No |
| `/finances/pensions` | `SectionWorkspace`/finance record workspace path | legacy/mixed finance records | legacy/mixed | not selected | supported but not canonical-proofed | supported | not Phase 4A-proofed | section/workspace attachments | not proven | not safe for new canonical dashboard claims | No |
| `/finances/investments` | finance record workspace | legacy/mixed finance records | legacy/mixed | not selected | supported but not canonical-proofed | supported | not Phase 4A-proofed | section/workspace attachments | not proven | not safe for new canonical dashboard claims | No |
| `/legal` | `app/(app)/legal/page.tsx`, `DashboardAssetSummaryCard` | canonical `assets` plus legacy `records` | mixed canonical/legacy | real mixed count | `?add=1` links | real mixed count where available | visually aligned with shared card | not counted | legal linked contacts in workspace | mixed persistence; legal forms still being product-refined | No code change |
| `/legal/[category]` | `SectionWorkspace` or legal canonical adapter depending category | mixed | mixed | per-category workspace only | supported | supported | not Phase 4A-proofed | shared/legacy attachment paths | legal linked contact cards | category-specific logic remains in flux | No |
| `/property` | `CanonicalAssetOverviewGrid`, `DashboardAssetSummaryCard` | canonical `assets` for property records; neutral tile for property documents | canonical for records, neutral document tile | Phase 4A selected | Add record links to `/vault/property?add=1` | count-only, no private snippets | Phase 4A selected | not counted | none | property documents remain separate document route | Yes |
| `/vault/property` | `UniversalRecordWorkspace` | canonical `assets` | canonical | source for `/property` | `?add=1` supported | supported | inherited workspace behaviour | shared attachment architecture | none | canonical workspace only | No dashboard change |
| `/property/documents` | document/section route | document-focused | document route | neutral tile only | Add document link | not counted | not Phase 4A-proofed | shared document architecture expected | none | do not count files as asset records | No |
| `/business` | `CanonicalAssetOverviewGrid`, `DashboardAssetSummaryCard` | canonical `assets` for business interests; neutral employment tile | canonical for business, legacy for employment | Phase 4A selected for business interests only | Add record links to `/vault/business?add=1` | count-only, no private snippets | Phase 4A selected | not counted | none | employment remains legacy/section route | Yes |
| `/vault/business` | `UniversalRecordWorkspace` | canonical `assets` | canonical | source for `/business` | `?add=1` supported | supported | inherited workspace behaviour | shared attachment architecture | none | canonical workspace only | No dashboard change |
| `/employment` | `SectionWorkspace` | `section_entries` | legacy | not dashboard-count safe | supported | supported | not Phase 4A-proofed | section attachments | none | legacy persistence | No |
| `/vault/digital` | `CanonicalAssetOverviewGrid`, `DashboardAssetSummaryCard` | canonical `assets` filtered by `metadata_json.digital_asset_type` | canonical | Phase 4A selected | Add record links to `/vault/digital/records?add=1&digitalType=...` | count-only, no private snippets | Phase 4A selected | not counted | none | “Other” tile catches unknown digital asset types | Yes |
| `/vault/digital/records` | `UniversalRecordWorkspace` | canonical `assets` | canonical | source for `/vault/digital` | query-param add/type supported | supported | inherited workspace behaviour | shared attachment architecture | none | category type integrity applies | No dashboard change |
| `/personal` | `DashboardAssetSummaryCard` overview | mostly static routing | mixed/neutral | not selected | links to personal areas | not count-proofed | not Phase 4A-proofed | not counted | contacts routed separately | personal route mixes possessions, wishes and tasks | No |
| `/vault/personal` | `CanonicalAssetOverviewGrid`, `DashboardAssetSummaryCard` | canonical `assets` filtered by `metadata_json.category` / `possession_category` | canonical for possession records only | Phase 4A selected | Add record links to `/vault/personal/records?add=1&possessionCategory=...` | count-only, no private snippets | Phase 4A selected | not counted | none | Vehicles tile points to current cars/transport route until transport is canonicalized | Yes, with noted limitation |
| `/vault/personal/records` | `UniversalRecordWorkspace` | canonical `assets` | canonical | source for `/vault/personal` | query-param add/type supported | supported | inherited workspace behaviour | shared attachment architecture | none | possessions canonical path | No dashboard change |
| `/cars-transport` | `SectionWorkspace` | `section_entries` | legacy | not selected | supported | supported | not Phase 4A-proofed | section attachments | none | transport remains outside canonical possession mapping | No |
| `/personal/wishes` | `SectionWorkspace` | `section_entries` | legacy | not selected | supported | supported | not Phase 4A-proofed | section attachments | none | legacy persistence | No |
| `/contacts` | `ContactsNetworkWorkspace` | canonical contacts plus projections/invitations | canonical contact direction plus invitation state | not an asset count route | contact actions | supported | not Phase 4A-proofed | none | primary page | contact sync work is separate from dashboard card proof | No |
| `/access-requests` | access request workspace | access/probate request data | controlled access model | not an asset count route | existing | existing | not Phase 4A-proofed | evidence scoped elsewhere | linked access | security-sensitive, outside Phase 4A | No |
| `/support` | `SectionWorkspace`/support page | support records | legacy/support | not selected | existing | existing | not Phase 4A-proofed | none | none | support/admin split remains separate track | No |

## Phase 4A Counting Rules

- Count only active canonical `assets` rows owned by the active customer or explicitly selected owner context.
- Do not count attachments, filenames, invitation records, contact notes, document contents, account numbers or unrelated owner data.
- Empty tiles show one primary `Add record` path.
- Populated selected tiles show count-only summaries and the latest updated date, not private record snippets.
- Legacy routes remain available but are not promoted as canonical dashboard proof.

## Route Behaviour Summary

- Canonical overview cards now use `CanonicalAssetOverviewGrid` on selected safe routes.
- The selected grid reads via `waitForActiveUser`, `useViewerAccess`, `resolveWalletContextForRead` and `fetchCanonicalAssets`.
- The selected grid never writes records and never reads document bodies or contact invitation payloads.
- Finance and legal retain their current tested/known mixed behaviour pending broader migration decisions.
