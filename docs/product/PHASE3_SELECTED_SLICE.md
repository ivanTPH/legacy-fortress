# Phase 3 Selected Slice

## Problem

Customer category dashboards were drifting in layout and empty-state behaviour. Owner review repeatedly found that empty tiles duplicated "No records yet", used inconsistent Add/Open actions, and made it unclear whether a tile opens a list or starts a new record.

## Evidence

- Finance, Legal, Property, Business, Digital and Possessions now use `DashboardAssetSummaryCard`, but the shared empty-state contract needed to be recorded and regression-tested.
- Phase 2 stabilisation already added static tests for this pattern, making it a safe first refinement slice.
- The issue affects frequent customer onboarding and review flows without requiring new database tables or hosted services.

## Affected Users

- Customer vault owner.
- Scoped reviewer where customer overview access is granted.

## Current Behaviour

- Populated cards show title, value/count, recent row and open action.
- Empty cards should show a single Add record action and route directly to the relevant add form.
- Some pages previously showed repeated empty copy or secondary "open category" actions before the add form.

## Required Behaviour

- Top-level customer category dashboards use one shared card pattern.
- Empty asset-class tiles show:
  - icon and title;
  - one large, muted Add record action in the value/summary position;
  - a small plus icon in the top-right action position;
  - no duplicate "No records yet" detail/date/footer copy.
- Populated tiles show:
  - icon and title;
  - value/count and active-record detail;
  - recent row where available;
  - open icon in the top-right action position.
- Tile helper text must sit close enough to the card it describes.

## Out Of Scope

- Full dashboard redesign.
- Enterprise/licence dashboard implementation.
- New contact, invitation, document, or metric persistence models.
- Hosted staging or production testing.

## Architecture Approach

- Keep `DashboardAssetSummaryCard` as the single shared card.
- Keep category overview pages on `.lf-finance-summary-tile` so spacing and mobile behaviour are shared.
- Add tests around shared empty/populated action semantics instead of screenshot-only expectations.

## Privacy Impact

No new data is returned. This slice is UI-only and does not alter access-control, Supabase queries, attachments or invitations.

## Acceptance Criteria

- Empty customer dashboard tiles have one Add record semantic action.
- Empty tiles route to `?add=1` where supported.
- Populated tiles retain the open action.
- Summary helper spacing remains controlled by shared CSS.
- Static regression tests cover Finance, Legal, Property, Business, Personal, Digital and Possessions.
- Existing role matrix, build, lint and unit checks still pass.

## Test Plan

- `node --test tests/category-dashboard-consistency.test.mjs tests/phase3-product-governance.test.mjs`
- Full Phase 3 required regression commands.
- Local browser checks where the local app and Supabase stack are reachable.

## Rollback Considerations

- Revert `DashboardAssetSummaryCard.tsx`, `app/globals.css`, `tests/category-dashboard-consistency.test.mjs`, `tests/phase3-product-governance.test.mjs` and Phase 3 documentation if this slice causes regression.
- No database rollback is required.
