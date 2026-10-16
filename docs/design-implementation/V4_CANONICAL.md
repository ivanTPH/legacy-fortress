# Canonical V4 customer design reference

The complete, versioned source is [`design_handoff_legacy_fortress 4/`](../../design_handoff_legacy_fortress%204/). Its [`README.md`](../../design_handoff_legacy_fortress%204/README.md) defines tokens, shell, components and responsive layouts; [`V4_UPDATE.md`](../../design_handoff_legacy_fortress%204/V4_UPDATE.md) governs People & Access, record forms, add controls and interaction states wherever earlier guidance conflicts. The visual states are in [`design/People and Access V4.dc.html`](../../design_handoff_legacy_fortress%204/design/People%20and%20Access%20V4.dc.html), with the rest of the customer screens in `design/Legacy Fortress Redesign.dc.html`. [`design_update_v4/`](../../design_update_v4/) preserves the incremental source pack; its update and People & Access HTML are byte-identical to the complete handoff.

## Implementation map

| V4 concern | Existing implementation |
| --- | --- |
| Tokens and shared interaction states | `app/globals.css`, `app/v3-primitives.css` |
| Buttons, chips, rows, sheets and focus management | `components/ui/V3Primitives.tsx` (shared implementation retained) |
| Record fields, labels, select controls and optional groups | `components/forms/asset/AssetFormControls.tsx`, `ConfigDrivenAssetFields.tsx` |
| People, invitations, identity, grants and requests | `components/people-access/PeopleAccessWorkspace.tsx`, `components/contacts/ContactsNetworkWorkspace.tsx`, `components/access-requests/AccessRequestsWorkspace.tsx` |
| Canonical records and permission enforcement | Existing asset/contact services, Supabase RLS and server access checks; V4 presentation does not replace them. |

## Rules to carry forward

Use the full handoff for layout and tokens, then apply `V4_UPDATE.md` for updated states. The approved paths and canonical persistence remain in place. Invitation acceptance, identity verification and saved record access are distinct. New records are never shared automatically. Only the owner may change grants, and linked viewers see only authorised records. Mobile controls need at least 44 px touch targets and visible keyboard focus. Avoid prototype names, counts and amounts in application UI.

## Current compatibility boundaries

The canonical contact model has one primary role, so V4 multi-role editing needs a product/data decision. Request decisions cannot imply record grants. A time-limited Undo after revocation and full per-record audit history need verified service support before being offered. See [`QUESTIONS.md`](QUESTIONS.md).
