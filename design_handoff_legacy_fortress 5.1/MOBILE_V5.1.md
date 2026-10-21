# Vault mobile V5.1 — supplement to MOBILE_V4.1.md

Reference: `design/V5.1 Mobile Refinement.dc.html` sections 4 and 5. Everything in MOBILE_V4.1.md still applies unless a row below replaces it. Real-device findings: `uploads/IMG_6540–6550` (UAT, 17 Oct).

## Findings from the iPhone build and the V5.1 answer
| Seen on device | V5.1 |
|---|---|
| Header shows bell, search and "Home" with the menu pushed to the right on pushed pages; controls crowd (IMG_6542, 6543, 6545) | One anatomy: **menu left · logo + context · search · notifications**. No page title in the root header. Pushed pages: back + parent title, optional (+). |
| Drawer header has a switch chevron that opens a menu containing only "Personal Vault" (IMG_6549) | Context label is a **plain label** when there is one context. It becomes a button with `unfold_more` only when the user has a linked Fortress. |
| Drawer repeats Dashboard, Action Centre, Settings and an account card (IMG_6549) | V4.1 rule stands: six areas + Add to my Fortress + Help & support. Account lives in Settings. |
| Six tall category cards on Home; "Nothing yet / Add first record" repeated five times (IMG_6548, 6550) | **Your Vault is one list card**, 56px rows: icon, name, "3 records" or "Nothing yet", chevron. About 340px instead of ~1,000px. |
| Home metric "12 Actions" while the drawer badge says 12 and Next steps lists others | One count: **To do** (owner tasks only). Same number on the Home metric, the Actions tab badge and the Action Centre filter. |
| "Add asset" pills on every section header; amounts collide with names (IMG_6543) | V4.1 round (+) rule stands; restated as acceptance item. |
| 3-line UAT banner takes ~110px (IMG_6542) | 28px one-line strip "UAT · synthetic data only". Full text on sign-in. |

## Home (4a)
Order, nothing else:
1. Header (52px).
2. Ink summary card: Total recorded value (28/700, wraps), Updated date, then 3 interactive metrics on the card: **Records** → Your Vault, **People** → People & Access, **To do** → Action Centre filtered to To do. Each 60px+, `#3A2622` fill, chevron.
3. **To do** preview: the top 3 To do items, same rows as the Action Centre, header link "See all n". Hidden when n = 0 (the metric shows 0).
4. **Your Vault**: one card with six rows.

Removed from Home: Next steps, Things worth your attention, Guidance recommendations, the large "Home" title.

## Action Centre (4b)
The only task list. Reached from the Actions tab, the To do metric and "See all".
- Title "Action Centre" + "Everything that needs you, in one place."
- Filter chips: All · To do · Waiting · Suggested (with counts).
- Groups, in this order:
  - **To do** — things only the owner can do (invite, reply to a request, add a missing core record, add a document, verify identity). Rows open the screen where it's done. Done items disappear and show a toast.
  - **Waiting on others** — informational; opens the related person or request. Never counted in To do.
  - **Suggested** — optional guidance. Dismissible (`close`, 44px, aria-label "Dismiss suggestion"). Never repeats a To do or Waiting item: if a suggestion becomes required (e.g. no executor at all), it moves to To do and leaves Suggested.
- Priority within To do: access requests, then invitations not sent, then identity, then missing records, then missing documents.

## Notifications (4c)
- Bell opens a sheet (from 44px below the status bar, grabber, Close · Notifications · Mark read). Groups: New, Earlier.
- A notification records an event. It has no Approve/Decline buttons. If the event created a task, the row shows **"Open in Action Centre"**, which opens that item.
- Bell badge = unread notifications. Actions badge = To do count. They are never added together.

## Context switching (5a, 5b)
- The Vault switcher shows only: **Yours** (My Vault) and **Linked to you** (each Fortress the user is connected to, with their relationship and "n records shared").
- **Supersedes V4.1 #1:** Work (Partner portal) and Legacy Fortress staff (Platform Admin) are no longer in the Vault switcher. They are separate sign-ins in separate security domains.
- Always-visible note in the sheet: being linked doesn't show records; values stay private until a release is approved.
- With one context the header label isn't a button and no sheet exists.

## TEST launcher (5c) — UX specification only
Purpose: let the founding owner move between independently signed-in UAT environments while testing.
- **Where:** a dashed "TEST · Test environments" row at the bottom of the Vault drawer (and of the Admin/Partner menu), only when `environment !== production` **and** the signed-in account is the founding owner. Absent from production builds, not hidden by CSS.
- **Sheet:** Close · TEST Environments. One row per environment: logo tile, name, badge, URL (monospace), and either "You're here ✓" or "Sign in ↗".
- **Behaviour:** "Sign in" opens that environment's own sign-in page in a new tab. No token, session, role or user id is passed. The user signs in again (with two-step for Admin).
- Always-visible note: "This only opens each environment's own sign-in. It doesn't carry your session, give permissions or act as another user."
- **Not specified here (needs a security decision):** how the founding-owner flag is set and checked, and whether the launcher is logged.

## Linked Fortress boundaries (unchanged rules, restated for UI)
- Connected ≠ access. Identity verified ≠ release. These stay three separate status rows on the person page.
- Financial values show as "Private until release" for anyone except the owner, before an approved post-death release.
- A verified financial attorney sees asset identification only (provider, type), never values or documents, and only after legal-authority verification (Admin case type "Legal authority").
- Estate release is per record, separately authorised. The UI never offers "release all".

## Other Vault screens (section 6)
Shared rule: the title appears once (never in the header and again in the page), and the first real content starts within 300px of the top of the scroll area at 390 × 844.

### Category page, e.g. Finances (6a) — fixes IMG_6543
- Header: back + parent ("Home"), round ink (+) "Add record" on the right. Tab bar stays.
- Title 30px + `info` button (the old "Keep accounts, pensions…" line moves behind it).
- **Total line, informational:** total (26/700, wraps) and "3 records · updated 17 Jul 2026" under it, with a 1px divider. Replaces the three-cell summary card whose values overlapped.
- One card per section that has records: header row (icon, name, "2 records · £132,245.00" sub-line that wraps, 32px round + in 44px hit area), then record rows (name wraps, sub-line ellipsis, amount `nowrap`, chevron). Below 360px the amount moves under the name.
- "Not added yet": one card, one 52px row per empty section with an outlined round +.
- Removed: "Add asset" pills (page and section), page description paragraph.

### Record page (6b)
- Header: back + category on the left, **Edit** pill on the right: 36px outlined pill (`#E3DAD3` border, white, 18px radius) with the `edit` icon and the word "Edit", inside a 44px hit area; hover `#F6EFEA`, pressed `#EBE0D8`. This is the only edit entry point.
- Title (wraps) + "type · section". Value line (same as the category total). Values are shown only to the owner; others see "Private until release".
- Details: the 3 most useful fields, then "Show n more details" disclosure. Sensitive numbers masked (`•• •• 21`) with a reveal in the detail sheet.
- Documents: heading + outlined round `note_add`. Who can see this: "Only you" or people rows, then "Give access".
- No buttons at the end of the page and no primary: the page is for reading. Add document and Give access stay inline in their sections.

### Changing or removing a record (6h–6i)
**One entry point: Edit** in the record header. No separate "Update value" link, no "more" sheet, no Edit button at the end of the page.

Edit form (6h): full-screen modal "Edit {name}".
1. **Value** first (Amount with £ prefix, "As of" date defaulting to Today), because updating the value is the most common edit.
2. **Details**: Section (moves the record, e.g. Banks → Investments), then the pre-filled required fields.
3. Collapsed **More details**.
4. A red row **Close or delete this record** that opens 6i.
Docked "Save changes". Toast "HSBC updated" with Undo.

Close or delete sheet (6i): title "Has this account closed?". Two choices, each with its consequence in one sentence:
- **Mark as closed** (recommended, primary): keeps the record, documents and history; removes the value from totals; moves it to a collapsed "Closed" group at the end of its section with a neutral "Closed {date}" chip. Reopen from its edit form.
- **Delete record** (red, outlined): removes the record and documents for everyone; anyone it was shared with loses access. Toast with Undo for 5 seconds.
- Cancel returns to the edit form. Delete never appears as a row swipe or a single tap.

The same pattern applies to every record type (Property "Sold", Insurance "Policy ended", Digital "Account closed").

### Add/Edit record form (6c) — fixes IMG_6544
- Full-screen modal, no tab bar (V4.1 #5). Cancel · title.
- One "Required" heading with the helper sentence under it **once**: "Choose the closest option in each list. Use Other only when none fit." Remove the per-field "Required" tag, per-field helper and per-field icon tiles.
- Required fields in one card; Country defaults to United Kingdom, Currency to GBP.
- "Optional details" is one collapsed row listing what's inside.
- Boundary note visible: "New records are private. Only you can see this until you give someone access."
- Docked "Save record".

### People & Access (6d) — fixes IMG_6545
- Root header (no title in the header). Title once, 30px.
- Segmented control People · Requests (badge) · Sharing.
- **One control row:** search field (flex) · filter button (`tune`, opens a sheet: All, Executors, Family, Advisers, Not invited) · round ink `person_add`. Replaces the "Add person" button, "Search contacts" label and chip row (about 300px saved).
- Groups by role with counts. Person row 68px: avatar, name (wraps), **one** status chip showing the furthest state (Not invited → Invited → Connected → Identity verified → Can see n records), relationship, round `send` only when not invited, chevron. The three-segment progress bar moves to the person page.

### Person page (6e)
- Header: back "People & Access", `more_horiz`.
- Left-aligned identity row (56px avatar, name, role) instead of a centred block.
- Three separate status rows: Connected · Identity verified · Access granted.
- One primary for the next step (Send invitation / Give access / Edit access). Boundary note visible: an invitation shares nothing.
- Can see (or "Nothing shared yet" + Give access), Contact, "Remove {name}" in red text at the end.

### Settings (6f)
- Account row (avatar, name, email) → profile.
- Groups: Security (Password, Two-step verification with state, Signed-in devices with count), Notifications (Email, Push), Your Vault (Download my data, Help & support, Privacy). 52px rows with the current value on the right.
- Sign out: outlined, red text, at the end.

## Desktop
Home and Action Centre use the same structure in the main column (metrics row of 3, To do preview, Your Vault grid of 3 × 2). The right rail keeps Notifications as a panel, not tasks.
