# V4 update: People & Access, record forms, interaction rules

Visual reference: `design/People and Access V4.dc.html` (ids like 1a, 4b match the badges). This supersedes the older People I Trust, Linked accounts and Add/Edit record form designs wherever they conflict. It has now been applied to every design file:
- `Legacy Fortress Redesign.dc.html`: round (+) Add asset on the dashboard, category and section headers; note_add on every record row and in record Documents; the working Add record form (try Finances › + or any section); one hover/pressed state set across the sidebar, rows and cards; "People & Access" with People / Requests tabs.
- `Legacy Fortress Journeys.dc.html`: Journey 4 rebuilt on this form template (the stepped form is withdrawn); hover states updated.
- `Finances Review.dc.html`: add controls and hover states updated. Mary Hale and the record names are sample data.

## A. Interaction rules (5a, 5b) — apply app-wide
**Add controls**
- Add asset: 36px filled ink (#2B1714) round button with `add` icon on section and page headers. Tooltip and aria-label "Add asset". On mobile, show the label next to it.
- Add document: 36px outlined round button with `note_add` icon on each asset row. Tooltip "Add document". It always attaches to that row's asset.
- Remove the page-level "Add documents" button and the separate "Add picture" button. Photos are uploaded as documents.
- The sidebar "Add to my Fortress" item stays as navigation to the type picker.

**States** (sidebar items, list rows, asset cards, Action Centre items, tabs)
- Rest: transparent. Hover: #F6EFEA. Pressed/touch: #EBE0D8. Selected: white + 1px #EBE4DE ring, 600 weight, filled icon. Focus-visible: 2px white + 4px #8C4A32 ring.
- Transition: background 120ms ease-out only. No movement, no shadow change.
- Round icon buttons: ink #2B1714 → #43231D on hover; outlined white → #F6EFEA.

## B. Record forms (4a–4c) — one template for every record type
- Header: back breadcrumb ("Finances › Investments"), title "Add {type}", close icon. Remove the duplicate top-right Cancel.
- **Required** block first: at most 3–4 fields, 2 columns, each label followed by a "Required" tag (11px/500, #F3EBE6 bg, #6E3A28 text). No asterisks.
- **Optional** groups below: collapsible 48px rows (icon, group name, "Optional · field list", chevron), all closed by default. Single optional fields outside a group get an "Optional" tag in neutral grey.
- Inputs 44px, radius 9px, border #D9CFC8 (required) or #E6DFD9 (optional). Focus: 1.5px #8C4A32 + 3px #F3E6DF ring. Error: 1.5px #B3261E + message below with `error` icon.
- Dropdowns: custom chevron (`expand_more`, 20px) in a 28px slot with 12px right padding. Hide the native arrow (`appearance:none`) so it never touches the edge.
- Currency is a prefix segment inside the value field, not a separate dropdown.
- One attachment area: dashed box, `note_add` round icon, "Add documents or photos", formats and size limit.
- Footer: lock note "Stored securely. Not shared with anyone." · Cancel (secondary) · Save record (primary).
- Mobile: grouped inset lists ("Required", "Optional"); optional groups push to sub-pages; sticky full-width Save record.
- Field map: Investment required = Provider, Investment type, Estimated value. Insurance required = Insurer, Policy type, Cover amount. Other types: name, type, value/amount, unless the backend requires more. Confirm with the product owner before changing a field's required status.

## C. People & Access workspace (1a–3d)
One page, three tabs: **People**, **Requests** (badge with pending count), **Sharing**. Primary: "Add person" (`person_add`).

**People tab (1a)**
- Search + role filter chips (All, Executors, Family, Advisers).
- Row: avatar, name, roles (a person can have several), a 3-segment progress strip for Connected · Identity verified · Access granted (grey = not started, amber = in progress, green = done) with a one-line status under it, then round actions: `send` (ink, only when not invited) and `key` (Give or Edit access).
- Row click opens the side panel. Selected = tint + 3px ink inset edge; hover = tint only.

**Person side panel (1a, mobile 3b)**
- Edit details (`edit`) and More (`more_horiz`) round buttons, close.
- Name, relationship and roles, email and phone.
- Three status rows, kept separate: Connected (`link`), Identity verified (`verified_user`), Access granted (`key`, record count).
- "Can see" list of records with category labels. Primary "Edit access" (or "Give access" if none), secondary red "Revoke all".
- Activity (3 latest) + "Full audit history" link.
- No nested drawers. Give access opens as a modal on desktop and a sheet on mobile.

**Give access (2c, 3c)**
- Intro: "Records you add later won't be shared unless you come back here."
- Record search. Expandable categories (Finances, Legal, Property, Business, Digital, Possessions, Personal) with a tri-state checkbox, "x of y" count and "Select all N current records".
- Footer: count selected · Cancel · Save access. Toast: "Saved. {Name} can now see N records".
- Never auto-share new records. "Select all" applies only to records that exist now.

**Add person (2d)**
- Required: First name, Last name, Email, Roles (multi-select chips). Optional: Relationship, Phone.
- "Send invitation now" checkbox (on by default) with "This doesn't share any records." Primary "Add and invite" (or "Add person" if unticked).

**Requests tab (2a, 3d)**
- Filter chips: Pending, Approved, Declined, History.
- Row: requester, what they asked for, verification chip, date. Detail panel: wants to see, reason, identity status, info note, Decline / "Approve and choose records".
- Approving opens Give access pre-filled with the requested records. It never grants access on its own and never skips identity verification.
- Executor/probate requests are shown with a `gavel` icon and a "Death verification" chip, and link to the existing controlled death-verification case (Journey 6). No approve button here.

**Sharing tab (2b)**
- Matrix: records grouped by category × people. Cells: green check = shared, "Requested" amber chip, "After death" neutral chip, dash = not shared. "Edit" under each person opens Give access.

**Revoke (2e)**
- Confirmation modal: "She'll lose access to N records straight away. She stays in your People list and remains verified." Red "Revoke access". Toast with Undo.

**Invitation stages** (chips): Not invited `schedule_send` neutral · Sent `hourglass_top` amber · Accepted `link` green · Verified `verified_user` green. Actions: send, resend, cancel invitation (in the More menu).

## Security constraints (do not change)
- Accepting an invitation ≠ verified ≠ access granted. Each is a separate state and a separate event in the audit log.
- Every grant, change and revoke writes an audit entry and takes effect immediately.
