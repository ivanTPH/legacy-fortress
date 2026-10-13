# Legacy Fortress Design System

This document is the customer-facing visual and interaction authority for Legacy Fortress. It is implemented on top of the existing canonical data, authentication, access-control, identity-verification, invitation, audit, and estate-authority architecture.

## Principles

- Keep the product calm, trustworthy, premium, simple, and progressively disclosed.
- Ask before assuming and show one useful next step.
- Deep-link actions to the exact canonical workflow.
- Keep recording a person, inviting, linking, verifying, and granting access as separate events.
- Treat mobile as a first-class layout, not a compressed desktop page.
- Reuse shared components and keep security state understandable without weakening it.

Customer terms are `Personal Vault`, `Your Fortress`, `People I Trust`, `Linked Fortresses`, `Action Centre`, and `Access & sharing`. Do not expose raw grant IDs, RLS, assurance internals, or database terminology.

## Tokens

The authoritative palette is defined in `app/globals.css`: ink `#2B1714`, ink hover `#43231D`, text `#1F1715`, secondary text `#6B5F5A`, accent `#8C4A32`, link `#7A3D27`, tint `#F3EBE6`, canvas `#FAF8F6`, mobile canvas `#F6F3F0`, sidebar `#F5F1ED`, surface `#FFFFFF`, border `#EBE4DE`, input border `#E6DFD9`, divider `#F3EEEA`, dashed `#D9CFC8`, success background `#E9F3EC`, success `#225C3A`, warning background `#FBEEE6`, warning `#8C4A32`, and UAT banner `#9B1C1C`.

Use the system stack `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif`. Desktop page titles are 28/34, mobile titles 34/41, body text 15/22, and metadata 13/18. Cards use 12px radii and restrained borders rather than decorative shadows.

## Interaction language

Rows and cards represent existing objects. `+` adds, a pencil edits, a chevron opens, a lock indicates restricted access, switches persist preferences, checkboxes select records, and small information controls explain unfamiliar security or product concepts. Use accessible labels for icon-only controls and maintain 44px minimum mobile targets.

People and sharing must keep relationship, role, document context, identity, linkage, and access independent. Linked does not mean access; verified does not mean authority; an executor does not receive living access to a Will. “Select all” resolves to explicit current record IDs only and never creates future access.

## Shell and responsive structure

Desktop uses a 264px sidebar, 60px global header, global `Search your vault`, secured-vault state, notifications, account control, and a centred content area. The sidebar groups Dashboard, Add to my Fortress, Action Centre, Vault areas, People I Trust, Access Requests, Support, and Settings. Linked Fortresses appears only when canonical relationships exist.

Below 768px, use the mobile presentation: no desktop sidebar, pushed area screens, sheets/drawers, safe-area spacing, and bottom navigation for Home, Actions, People, and Settings. Do not permit horizontal overflow or rely on hover.

## Notifications, actions, and estate safety

Notifications mean something happened. The Action Centre contains readiness actions. Alerts are reserved for conditions requiring attention. A death certificate is evidence, not an unlock credential: relationship, evidence, identity, role, authority, quorum, and estate-locking controls remain authoritative.

The approved HTML handoff remains the visual reference for geometry and composition. When it conflicts with canonical security or data architecture, preserve the architecture and adapt the presentation.
