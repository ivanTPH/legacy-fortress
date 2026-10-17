# Admin & Partner architecture (V5)

Visual reference: `design/Admin Console.dc.html`. Words, icons and interaction rules: CONSISTENCY.md. Use the "Preview as role" select (bottom of the sidebar) and the logo switcher to see each role and the partner portal. All tokens, icons, chips, buttons, forms and hover states are the same as `README.md` and `V4_UPDATE.md`. Organisation names, people and counts are sample data.

## Three interfaces
| Interface | Who | Sign-in | Sidebar |
|---|---|---|---|
| Personal Vault | Customers and the people they trust | Customer sign-in; linked Fortresses via the switcher | Light warm `#F5F1ED` |
| Partner portal | A firm's organisation admins and advisers | Customer sign-in; appears under "Work" in the switcher | Light warm + teal `PARTNER` badge (`#E3EEEC` / `#1F5A55`) |
| Platform Admin | Legacy Fortress staff only | **Separate sign-in**, two-step verification required, short session, never in the customer switcher | Dark ink `#1F1715` + red `ADMIN` badge (`#B3261E`) |

Same 9-dot `apps` logo tile in all three (white tile on the dark admin sidebar, black tile on light sidebars).

## Merges (remove duplication)
- **Platform Probate Review workspace → removed.** Its pages become the "Probate & verification" section of Platform Admin. A probate reviewer signs in to Admin and sees only that section.
- **Enterprise Operations workspace + admin "Platform Enterprise" → one "Commercial" section** in Platform Admin (Organisations, Licences, Users & seats, Registration links, Reports).
- **Audit, Enterprise audit, Probate audit → one Audit page** with a source filter (Admin / Commercial / Probate / Failed only).
- **Partner portal reuses the Commercial screens limited to one organisation**: no Add organisation, no Create licence; licence is read-only with "Request more seats".
- Invitations and Support no longer show the same five stat cards: Invitations shows invitation stats; Support shows issue stats.

## Platform Admin navigation
- Overview
- Operations: Customer users, Invitations, Access requests, Support
- Probate & verification: Probate cases, Identity verification
- Commercial: Organisations, Licences, Users & seats, Registration links, Reports
- Oversight: Audit, System health, Admin users, Settings

## Roles (navigation is filtered; the server must enforce the same rules)
| Role | Sees |
|---|---|
| Super admin | Everything |
| Support agent | Overview, Operations, Audit |
| Probate reviewer | Overview, Probate & verification, Audit |
| Account manager | Overview, Commercial, Audit |
| Auditor (read-only) | Overview, Audit, System health; every action button hidden |
Overview "Needs a decision" items are filtered to the sections the role can open.

## Partner portal navigation
Overview · Team & seats · Invitations · Registration links · Reports · Licence · Activity log. A scope chip "Hale & Co Solicitors" (teal) sits next to every page title. Partners see client Vaults only through the client's own Give access permissions (V4 §C).

## Page template (every admin and partner page)
1. Breadcrumb (section › page), 13px.
2. Title 28/700 + optional scope chip + one-line plain-English description (max 720px). **No eyebrow label, no repeated title below the header, no "authorised organisation context" panel.** The page title is the page name, never "Enterprise Operations".
3. One primary action at top right where relevant (Add organisation, Create licence, Create link, Invite administrator, Invite team member). Labelled ink button: these are not assets, so the round (+) rule doesn't apply.
4. Optional info banner (neutral `#F7F4F1`, icon + one sentence) for a boundary rule.
5. Optional stat strip: one card, equal cells, label 13px + value 22/600. Max 5. No "Filtered by current scope" text, no blue links.
6. Optional "Needs a decision" list (Overview): icon tile, title, one-line reason, count pill, chevron. Hover tint `#F6EFEA`.
7. Table: search (only if useful) + filter chips (ink when selected); header row 12/600 sentence case (not all caps); rows min 56px; first column 600 + 12px secondary line; status as Chip; IDs/routes in monospace; long values ellipsis, never wrapped mid-word. Trailing column: **one** small outlined action button (Review, Send, Resend, Export) or a chevron. All other actions live in the side panel.
8. Empty state: dashed box, 44px icon circle, title, one sentence about what will appear here.

## Side panel (440px, right)
Title, sub-line, status chip, close (36px round). Content blocks as needed: status timeline (done green / current amber / to-do grey / locked / failed red), check list (Document · Liveness · Face match with tick/cross/clock), key-value list (IDs monospace), info note. Footer: destructive action in red text on the left, secondary, then one primary on the right.

## Risky actions
Suspend, Remove, Reject, Approve identity, Accept evidence, Cancel licence, Change role and similar actions open a confirm dialog: icon, title as a question, one-sentence consequence, **Reason (Required)** textarea saved to the audit log, Cancel + action button (red for destructive, ink otherwise). Disabled until a reason is entered. Result is a toast.

## Forms
Create/invite forms open in the side panel using the V4 Required/Optional template: required fields first with "Required" tags, optional fields in one collapsed "More details" group, custom dropdown chevron with 12px right padding, info note for consequences (e.g. "This reserves 1 seat until they accept"), footer Cancel + submit.

## Copy rules for admin
Plain English. Replace developer terms: "canonical API", "terminal state transitions", "server-authorised", "Effective permissions: 55", "Governed CSV". Say what happens and what doesn't (e.g. "Approving confirms who someone is; it never grants access to records").

## Sign-in
- Platform Admin: dark ink page, white logo tile + ADMIN badge, card "Sign in to Platform Admin", email + password, then a 6-digit code (two-step verification is always required). Footer link to the main sign-in for non-staff.
- Partner portal: light page, black logo tile + PARTNER badge, card "Sign in to the partner portal", same two steps. Note: the partner portal and the person's own Vault use one account; they switch after signing in.
- Reference: Admin Console → Sign out icon, or open `design/Partner Portal.dc.html` (starts at the partner sign-in).

## Mobile
Both consoles work on phones (Admin Console → "Mobile preview", or set the `preview` prop to mobile; below 760px wide it switches automatically). See CONSISTENCY.md › Mobile for the pattern and the tabs per role.

## Security constraints (unchanged)
- Admins never see Vault record names, values, notes or documents; counts only.
- Verification approval ≠ access. Probate access is released only after evidence, death verification and executor authority are all confirmed.
- Last master admin can't be suspended or downgraded; nobody can suspend themselves.
- Settings stay read-only until each has its own audited change flow.
- UAT banner: 32px `#8C1D18` bar, sticky, only in non-production environments.
