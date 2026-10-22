# Admin & Partner architecture (V5, with V5.1 mobile refinements)

V5.1 changes are in the "Mobile presentation (V5.1)" section at the end and in CHANGELOG_V5.1.md. Everything else in this file is unchanged V5.

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
Both consoles work on phones (Admin Console → "Mobile preview", or set the `preview` prop to mobile; below 760px wide it switches automatically). See CONSISTENCY.md › Mobile for the pattern and the tabs per role. **V5.1 below supersedes the header, tab bar and list presentation.**

## Security constraints (unchanged)
- Admins never see Vault record names, values, notes or documents; counts only.
- Verification approval ≠ access. Probate access is released only after evidence, death verification and executor authority are all confirmed.
- Last master admin can't be suspended or downgraded; nobody can suspend themselves.
- Settings stay read-only until each has its own audited change flow.
- UAT banner: 32px `#8C1D18` bar, sticky, only in non-production environments (28px one-line strip on mobile, V5.1).

## Mobile presentation (V5.1)
Reference: `design/V5.1 Mobile Refinement.dc.html` sections 2, 3 and 5. Words and metric rules: CONSISTENCY.md › Information hierarchy and › Summary metrics.

### Header (every Admin and Partner screen)
- 56px. Left to right: **menu** (44) · logo tile 28 + "Legacy Fortress" + badge (`ADMIN` red / `PARTNER` teal) · search (44) · account avatar (44, opens account sheet: name, role, Sign out).
- Hamburger sits on the **left**, the same place as the Vault, so all three interfaces share one muscle memory. Decided over right-hand placement because the Vault already ships left and the right side holds utilities.
- Admin: dark ink `#1F1715` header and tab bar, white text. Partner: white header, 1px `#EBE4DE` bottom border.
- Pushed detail pages: back chevron + parent title on the left, badge and `more_horiz` on the right.
- **Removed on mobile:** the `Menu` text button, the "LEGACY FORTRESS ADMIN" eyebrow, breadcrumb, the STAGING pill, the Workspace card and the in-page Switch context panel. The environment is shown once, in the UAT strip.
- No workspace switcher in Admin or Partner headers. Moving between interfaces is a separate sign-in (see TEST launcher in MOBILE_V5.1.md for UAT).

### Tab bar
- 3 role tabs (list in CONSISTENCY.md › Mobile), docked, safe-area padded. The 4th "Menu" tab is removed because the menu is in the header.
- Screens reached from the menu (e.g. Organisations for a Super admin) show the tab bar with no tab selected.

### Menu (full screen, from the header)
- Header: logo, "Menu", close (44). Groups as cards: Operations, Probate & verification, Commercial, Oversight (filtered by role). Rows 48px with icon and count pill where a queue exists. Account card with Sign out at the bottom. (5d)

### Overview (2a, 3a)
1. Title "Overview" + one line + `info` button (privacy explanation collapsed).
2. 2×2 interactive metrics. Admin: Verification requests, Organisations, Active seats, Pending invitations (filtered to sections the role can open). Partner: Seats used, Pending invitations, Active sign-up links, Clients registered.
3. Needs a decision / Needs attention: max 3 rows.
4. Admin only: one-line system health status (green/amber/red) linking to System health.
5. Partner only: Recent activity (3 rows) + "Activity log" link.

### Verification queue (2b)
- One queue for identity, probate evidence and legal authority (financial attorney) checks. Title "Verification".
- Filter chips with counts: All · Needs review · In review · Waiting on customer. A "Type" control opens a sheet to filter by case type. Default sort: oldest first.
- **Row (76px min):** line 1 reference (monospace) + case type; line 2 pending-action summary (wraps); line 3 status chip + reviewer · age; chevron. No evidence, scores, document thumbnails or customer data in the list.
- Probate reviewer sees only Probate evidence and Legal authority types; filters adapt.

### Case detail (2c)
- Pushed page. Header: back "Verification", `more_horiz` (Reassign, Request more information, Copy reference).
- Reference, pending-action title, status + type chips.
- Key-values: customer ref (monospace), name (only for roles permitted to see it), submitted, reason. Reviewer row with "Assign to me".
- Checks: Document · Liveness · Face match (identity) or Evidence received · Death verified · Executor authority (probate) · Authority document · Scope confirmed (legal authority).
- Evidence: count only + "Open secure viewer" (watermarked, logged, no download). Never inline.
- Activity: collapsed disclosure with event count; opens the audit trail for this case.
- Always-visible boundary note: "Approving confirms who someone is. It never gives access to records." For legal authority: "Approving lets them see which assets exist. It never shows values or documents."
- Docked footer: Reject (red text, outlined) + one primary (Approve identity / Accept evidence / Confirm authority). Both open the reason dialog (unchanged).

### Organisations (2d) and organisation detail (2e)
- Title + one line, full-width "Add organisation" primary, then one interactive seats metric ("312 of 400 seats in use" with bar → Users & seats), search, filter chips All · Active · Trial · Suspended, then rows.
- **Row (68px min):** `domain` tile, organisation name (wraps, never truncates), status chip + licence · "18 of 20 seats", chevron.
- Detail: name (wraps), status chip + licence and renewal; 3 interactive metrics (Seats used → seats filtered to this organisation, Invitations → invitations filtered, Sign-up links → registration links filtered); Details key-values; Organisation admins; boundary note; Suspend (red) + Edit details. No primary button: the page is for review.
- Create organisation: full-screen modal using the Required/Optional form template (Name, Licence, Seats, First admin email required; billing and notes in "More details"). Docked footer "Create organisation".

### Partner Team & seats (3b)
- Title + scope chip, full-width "Invite team member", informational seat card ("12 of 20 seats used", bar, "Invitations hold a seat", "Request more seats" link), filter chips All · Active · Invited · Admins, rows (avatar, name wraps, status chip + role, round `send` only for Invited/Expired, chevron).
- Invitations, Registration links, Reports, Licence and Activity log follow the same list pattern; Licence is key-values + "Request more seats".

### Desktop (≥ 1024px)
- Unchanged layout (sidebar, 440px side panel). Apply: the metric kinds, max-3 Needs a decision, one description line, `info` disclosure, and the compact queue columns (Reference · Type · Pending action · Status · Reviewer · Age). Remove the Staging pill and Workspace card from the page header; the sidebar badge already identifies the interface.
