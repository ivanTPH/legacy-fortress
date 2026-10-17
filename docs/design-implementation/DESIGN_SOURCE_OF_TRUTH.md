# Legacy Fortress V4/V5 design source of truth

The complete current design package is [`design_handoff_legacy_fortress 5/`](../../design_handoff_legacy_fortress%205/). Its nine HTML prototypes and adjacent `support.js` / `ios-frame.jsx` are **visual references, not application code**. Keep their relative paths intact. Consult this index first; read only the relevant spec and screen for a bounded implementation task.

## Precedence

1. Root [`AGENTS.md`](../../AGENTS.md), established security/release controls and explicit owner decisions govern implementation. A prototype never authorises an auth, role, RLS, schema, persistence or route migration.
2. For visual conflicts, V5 [`CONSISTENCY.md`](../../design_handoff_legacy_fortress%205/CONSISTENCY.md) governs common copy, icons and interaction; [`ADMIN_PARTNER.md`](../../design_handoff_legacy_fortress%205/ADMIN_PARTNER.md) governs admin/partner presentation; [`MOBILE_V4.1.md`](../../design_handoff_legacy_fortress%205/MOBILE_V4.1.md) overrides the retained [V4 mobile supplement](V4_MOBILE_SUPPLEMENT.md); [`V4_UPDATE.md`](../../design_handoff_legacy_fortress%205/V4_UPDATE.md) governs forms and People & Access; [`README.md`](../../design_handoff_legacy_fortress%205/README.md) supplies global tokens and desktop screens; [`JOURNEYS.md`](../../design_handoff_legacy_fortress%205/JOURNEYS.md) supplies journeys. The package [`AGENTS.md`](../../design_handoff_legacy_fortress%205/AGENTS.md) and [`CODEX_MASTER_PROMPT.md`](../../design_handoff_legacy_fortress%205/CODEX_MASTER_PROMPT.md) explain its intent, subject to rule 1.
3. The complete [V4 handoff](../../design_handoff_legacy_fortress%204/), incremental [`design_update_v4/`](../../design_update_v4/), [`V4_CANONICAL.md`](V4_CANONICAL.md) and [mobile supplement](V4_MOBILE_SUPPLEMENT.md) remain as history. Use them only where V5 is silent.

## Screen map

| Area | V5 specification and visual reference | Current application anchor |
| --- | --- | --- |
| Personal Vault desktop | `README.md`, `V4_UPDATE.md`; [`Legacy Fortress Redesign.dc.html`](../../design_handoff_legacy_fortress%205/design/Legacy%20Fortress%20Redesign.dc.html), [`Finances Review.dc.html`](../../design_handoff_legacy_fortress%205/design/Finances%20Review.dc.html), [`Legacy Fortress Journeys.dc.html`](../../design_handoff_legacy_fortress%205/design/Legacy%20Fortress%20Journeys.dc.html) | `app/(app)/`, `components/navigation/WorkspaceSwitcher.tsx`, shared V3/V4 tokens and controls |
| Personal Vault mobile | `MOBILE_V4.1.md`; [`Vault Mobile.dc.html`](../../design_handoff_legacy_fortress%205/design/Vault%20Mobile.dc.html), [`Vault Mobile Checks.dc.html`](../../design_handoff_legacy_fortress%205/design/Vault%20Mobile%20Checks.dc.html) | `app/(app)/layout.tsx`, `app/globals.css`, `app/v3-screens.css` |
| People & Access and forms | `V4_UPDATE.md`, `MOBILE_V4.1.md`; [`People and Access V4.dc.html`](../../design_handoff_legacy_fortress%205/design/People%20and%20Access%20V4.dc.html) | `/people-access`, existing contact/access workspaces, `components/forms/asset/` |
| Platform Administration | `ADMIN_PARTNER.md`, `CONSISTENCY.md`; [`Admin Console.dc.html`](../../design_handoff_legacy_fortress%205/design/Admin%20Console.dc.html), [`Admin and Partner Mobile.dc.html`](../../design_handoff_legacy_fortress%205/design/Admin%20and%20Partner%20Mobile.dc.html) | `/admin/*`, `components/admin/AdminWorkspaceShell.tsx` |
| Partner Portal | `ADMIN_PARTNER.md`, `CONSISTENCY.md`; [`Partner Portal.dc.html`](../../design_handoff_legacy_fortress%205/design/Partner%20Portal.dc.html), [`Admin and Partner Mobile.dc.html`](../../design_handoff_legacy_fortress%205/design/Admin%20and%20Partner%20Mobile.dc.html) | Existing `/enterprise/*` organisation operations; no V5 route or identity change approved |

## Boundaries and status

- Baseline for this handoff integration: remote staging `0557f28cf7312b40650e3c8e674f9dde9c36c97b`. V4 mobile and workspace-header corrections are in that commit. The retained V4 supplement was committed separately at `f327ae2`; V5 corrects it on the points enumerated in `MOBILE_V4.1.md`.
- The existing application supplies customer, contact, invitation, grant, identity, admin and enterprise functions. This handoff records **new visual requirements**; it does not assert that V5 screens are already implemented or accepted. See [`V4_V5_IMPLEMENTATION_GAPS.md`](V4_V5_IMPLEMENTATION_GAPS.md).
- Preserve Supabase Auth, RLS, authorised record-level counts and data, invitation lifecycle, identity assurance separate from access grants, linked-Fortress isolation, estate/probate restrictions, audit and organisation boundaries. Never substitute prototype names, figures or fixtures for live data.
- Proposed three-interface consolidation, separate staff sign-in/two-step verification, route/role changes and new audited actions require separate decisions. The V5 files conflict on whether staff Admin appears in the customer workspace sheet; see [`QUESTIONS.md`](QUESTIONS.md).
- Deliver in reviewed stages per [`V4_V5_DELIVERY_PLAN.md`](V4_V5_DELIVERY_PLAN.md). No V5 application code, hosted configuration or database change is included in this documentation integration.
