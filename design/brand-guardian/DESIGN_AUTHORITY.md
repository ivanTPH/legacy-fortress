# Legacy Fortress Design Authority

Status: approved and version-controlled.

This directory is the repository copy of the approved Legacy Fortress design handoff. The source HTML is the visual authority for customer-facing layout, component hierarchy, responsive states and interaction intent. The existing application architecture remains authoritative for authentication, persistence, permissions, RLS, invitations, identity verification, audit, probate, death authority, quorum and estate locking.

## Authority order

1. Security, legal and canonical data architecture.
2. This governed source copy and its checksums.
3. `LEGACY_FORTRESS_DESIGN_SYSTEM.md`.
4. Existing shared production components and interaction standards.
5. Page-local implementation only where it does not conflict with the sources above.

## Source set

- `README.md`: final tokens, structures, terminology and screen requirements.
- `PROMPTS.md`: implementation sequence and reusable patterns.
- `JOURNEYS.md`: journeys 1–12 and shared security-sensitive states.
- `design/Legacy Fortress Redesign.dc.html`: desktop option 2a, iPhone option 2b and design rules option 2c.
- `design/Legacy Fortress Journeys.dc.html`: journey screens and states.
- `design/Finances Review.dc.html`: Finance composition and rationale.
- `design/support.js`, `design/ios-frame.jsx`: prototype runtime/support only; never production data or business logic.

The originals were copied without modification from the approved handoff path recorded in `DESIGN_SOURCE_MANIFEST.json`.

## Non-negotiable implementation rules

- Match source structure, not only palette or typography.
- Use canonical shared components and tokens.
- Preserve real data, handlers and permission boundaries.
- Do not copy prototype personas, counts, values or dates into production.
- Record intentional source exceptions in `DESIGN_CHANGE_CONTROL.md`.
- A screen is not visually complete without same-viewport browser evidence or an explicit runtime blocker.

