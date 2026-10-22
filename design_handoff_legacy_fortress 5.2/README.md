# Handoff: Legacy Fortress — UI/UX redesign (web + mobile)

> **Latest: V5.2.** Read `V5.2.md` first, with `design/V5.2 Records Access and Approvals.dc.html`. It covers record pages, access, history and approvals on mobile and web, plus the accessibility standard and dark mode. V5.1 documents remain valid where V5.2 doesn't overlap.

## Overview
A consistent redesign of every screen in the Legacy Fortress web app (desktop) plus an iPhone layout. It fixes typography hierarchy, removes duplicated chrome, replaces empty cards with compact "Not added yet" tiles, and applies one component system across Dashboard, Add to my Fortress, Action Centre, the six vault areas, People & Access, Access Requests, Support, Settings and My Vault.

## About the design files
The files in `design/` are **design references built in HTML**. They are prototypes that show the intended look and behaviour. They are **not production code to copy**. Recreate them inside the existing Legacy Fortress codebase using its framework, component library, routing and data layer. Keep existing business logic, APIs and copy unless this document says otherwise.

To view: open `design/Legacy Fortress Redesign.dc.html` in Chrome or Safari (keep `support.js` and `ios-frame.jsx` beside it). Pan/zoom the canvas. Option **2a** = desktop prototype, **2b** = iPhone prototype, **2c** = design rules. `Finances Review.dc.html` is the original review with the before/after rationale.

## Fidelity
**High fidelity.** Colours, type sizes, spacing, radii and states are final. Match them, mapping to existing tokens/components where they already exist.

---

## Design tokens

### Colour
| Token | Hex | Use |
|---|---|---|
| ink | `#2B1714` | Primary buttons, selected switches, active tab icon |
| ink-hover | `#43231D` | Primary button hover |
| text | `#1F1715` | Body and headings |
| text-secondary | `#6B5F5A` | Descriptions, meta, labels (≥4.5:1 on white) |
| text-tertiary / chevrons | `#9A8F8A` (desktop), `#B3A9A4` (iOS) | Chevrons only, never body text |
| accent | `#8C4A32` | Badges (Action Centre count), "new" dots |
| link | `#7A3D27` | Text links / text buttons |
| tint | `#F3EBE6` | Icon tile background |
| tint-icon | `#6E3A28` | Icon colour on tint |
| canvas | `#FAF8F6` | App background (desktop) |
| canvas-ios | `#F6F3F0` | App background (iOS grouped) |
| sidebar | `#F5F1ED` | Sidebar background |
| surface | `#FFFFFF` | Cards, header |
| border | `#EBE4DE` | Card borders, header/sidebar dividers |
| border-input | `#E6DFD9` | Inputs, secondary buttons |
| divider | `#F3EEEA` | Row separators inside cards |
| dashed | `#D9CFC8` | "Not added yet" tile dashed border |
| success-bg / success | `#E9F3EC` / `#225C3A` | "Vault secured", "Verified" chips |
| warn-bg / warn | `#FBEEE6` / `#8C4A32` | "New", "Invitation not sent" chips |
| switch-off | `#D9D1CB` | Switch track off |
| UAT banner | `#9B1C1C` | Test environment bar only |

### Typography
System font stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif`.

| Role | Size / line-height | Weight | Notes |
|---|---|---|---|
| Page title (desktop) | 28 / 34 | 700 | letter-spacing −0.02em |
| Large title (iOS) | 34 / 41 | 700 | |
| Amount / stat | 22 | 600 | `font-variant-numeric: tabular-nums` |
| Section headline | 17 | 600 | Card titles, category names |
| Body | 15 / 22 | 400 | Row titles 15/600 when a row has a description |
| Nav item | 14 | 400; selected 600 | |
| Button | 14 | 600 primary, 500 secondary | |
| Meta / description | 13 / 18 | 400 | text-secondary |
| Group label | 13 | 600 | text-secondary (desktop); iOS uses 13 uppercase, +0.02em |
| Sidebar group label | 11 | 600 | uppercase, +0.06em |

Bold only for titles, totals and the selected nav item. All money uses tabular numerals and the format `£76,213.00`. Dates are `17 Jul 2026` and always labelled ("Updated 17 Jul 2026").

### Spacing, radii, shadows
- Spacing scale: 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 40.
- Page padding: 32px top, 40px sides; content max-width 960px, centred. Vertical gap between page blocks: 24px.
- Radii: cards 12; inputs/buttons 8–9; icon tiles 9 (36px) / 8 (32px) / 7 (iOS 30px); chips 4–6; pills/avatars full.
- Card: `1px solid #EBE4DE`, no shadow. Hover on clickable cards: border `#D6C9C0` + `0 2px 8px rgba(43,23,20,.06)`.
- Selected nav item: white bg + `0 1px 2px rgba(43,23,20,.08), 0 0 0 1px #EBE4DE`.

### Icons
**Google Material Symbols Rounded** (Apache 2.0) — `https://fonts.google.com/icons?icon.style=Rounded`. Outline (`FILL 0`, weight 400) at 20px; filled (`FILL 1`) only for the selected nav item/tab. On native iOS, swap for the SF Symbols equivalents.

| Use | Material Symbol |
|---|---|
| Logo tile | `apps` (white, filled, on `#111` 34px rounded square) |
| Dashboard | `space_dashboard` |
| Add to my Fortress | `add_circle` |
| Action Centre | `task_alt` |
| Finances | `account_balance_wallet` |
| Legal | `gavel` |
| Property | `home` |
| Business | `work` |
| Digital | `devices` |
| Possessions | `inventory_2` |
| People & Access | `group` |
| Access Requests | `key` |
| Support | `help` |
| Settings | `settings` |
| Banks / Pensions / Investments / Insurance / Debts | `account_balance` / `savings` / `trending_up` / `health_and_safety` / `credit_card` |
| Wills / Trusts / POA / Funeral / Marriage / Identity / Other / Personal wishes | `history_edu` / `account_tree` / `shield_person` / `local_florist` / `family_restroom` / `badge` / `description` / `volunteer_activism` |
| Property records / documents | `home` / `folder` |
| Business interests / Employment | `domain` / `work` |
| Social / Subscriptions / Email & cloud / Domains / Crypto / Other digital | `alternate_email` / `subscriptions` / `cloud` / `language` / `currency_bitcoin` / `devices_other` |
| Vehicles / Watches / Art / Household / Collections / Other | `directions_car` / `watch` / `palette` / `chair` / `collections_bookmark` / `category` |
| Row chevron / add / edit / search / bell | `chevron_right` / `add` / `edit` / `search` / `notifications` |

---

## Global layout (desktop)
- Optional UAT bar: 28px, `#9B1C1C`, 12px white text, centred ("UAT / TEST" 700 +0.06em, then message).
- Grid: sidebar **264px** + main `minmax(0,1fr)`.
- **Sidebar** (`#F5F1ED`, right border): padding 18/12/14. Brand row: logo tile 34px (`apps` icon) + "Legacy Fortress" 15/600 + workspace "Personal Vault" 12 secondary + `unfold_more` (this is the workspace switcher — remove the separate header switcher). Nav items 36px tall, 12px horizontal padding, 12px icon gap, radius 8. Groups: (no label) Dashboard, Add to my Fortress, Action Centre [badge 12] · **VAULT** Finances, Legal, Property, Business, Digital, Possessions · **SHARING** People & Access, Access Requests. Footer above a divider: Support, Settings.
- **Header** 60px white, bottom border, padding 0 28px: global search field (340px, 36px, `#F7F4F1` bg, "Search your vault", ⌘K hint) · spacer · "Vault secured" chip (success) · bell icon button 36px · avatar 32px + "Ivan Yardley" + `expand_more` (opens account menu / Settings).
- **No Back button on top-level pages** (anything in the sidebar). **Every nested page** shows, above the H1, a 30px round back button (`arrow_back`, white, `1px #E6DFD9`) followed by a breadcrumb trail: ancestors are links (14/500 `#7A3D27`), the current page is plain (14 `#6B5F5A`), separated by `chevron_right` 16px `#9A8F8A`. Examples: `← Finances › Banks`, `← Finances › Banks › Barclays`, `← Settings › My Vault`. The back button always goes up one level (not browser history).
- **Page header** on every screen: H1 28/700, description 15/22 secondary (max 640px), right-aligned action: the round (+) "Add asset" button on Vault pages and sections (see V4_UPDATE.md §A), or one labelled primary where adding isn't an asset (e.g. "Add person").
- **Stats strip** (where data exists): white card, 3 equal columns, 16/20 padding, label 13 secondary, value 22/600, optional 14 secondary suffix; columns split by `1px #F0EBE7`.

## Screens

### Dashboard
Stats: Records 4 (across 2 areas) · People 2 (1 not yet invited) · Open actions 12 (4 new). "Your vault" 3-column grid of area tiles (icon tile, name 17/600, chevron; below a divider: "3 records" 15/600 or "Nothing yet" secondary, right "Updated 17 Jul 2026" / "Add first record"). Whole tile navigates to the area. Card "Things worth your attention" with the top 3 actions as rows (status dot, title 15/600, description 13, chevron) and "View Action Centre" link.

### Add to my Fortress
2×2 grid of group cards: Money & property · Legal & important documents · People · Personal, digital & wishes. Each row: 36px icon tile, title 15/600, description 13, chevron; row navigates to the relevant area/form. Remove the duplicated eyebrow + second heading from the current page.

### Action Centre
One card, rows 16/20 padding: 8px dot (accent if new, `#D9CFC8` if read) · title 15/600 + "New" chip · description 13 (max 620px) · **secondary** button with the action label. Last row "More things to consider · 7 ›". No black buttons in this list.

### Vault areas (Finances, Legal, Property, Business, Digital, Possessions) — one shared template
1. Page header + "Add record" primary.
2. Stats strip only if the area has records (Finances: Total recorded £652,590.00 · Records 3 in 2 of 5 sections · Last updated 17 Jul 2026).
3. One card per **populated** section: header row (icon tile, name 17/600, count "2 accounts" with real plurals, section total right 20/600 tabular, 32px "+" secondary icon button). Record rows 56px, indented 70px: name 15, "Updated 17 Jul 2026" 13, amount 15 tabular, chevron.
4. "Not added yet" (or "Start with any of these" when the area is empty): 3-column grid of dashed tiles (icon tile, name 15/600, hint 13, `add_circle` in link colour). Hover: white bg.

Navigation hierarchy: **Area › Section › Record**. Clicking a section header or an empty tile opens the Section page; clicking a record row opens the Record page.

### Section page (e.g. Finances › Banks)
Breadcrumb + back to the area. Title = section name; description = "2 accounts · £132,245.00" (or the section hint if empty). Primary "Add record". Records as 64px rows (icon tile, name 15/600, "Updated …" 13, amount, chevron). Empty: centred state (48px icon tile, "Nothing in Banks yet", hint, primary "Add first record").

### Record page (e.g. Finances › Banks › Barclays)
Breadcrumb + back to the section. Title = record name; description = "Banks · Updated 17 Jul 2026". Primary **Edit** (`edit` icon). Two columns (1.5fr / 1fr): **Details** card (48px rows: Name, Section, Value, Reference [Add], Last updated); right column: **Documents** card (empty text + secondary Upload), **Shared with** card (who can view this record, link "Manage in People & Access"), then "Delete record" in `#B3261E`.

### People & Access
Toolbar: search input (filters by name/role live) + "Access & sharing" secondary button. Groups (Executors, Family) with a count pill; each person row: 40px initials avatar, name 15/600, role · access 13, **status chip with icon** by invitation stage — grey `#F3EEEA`/`#3A2C28` "Not invited" (`schedule_send`) → amber `#FDF1D8`/`#7A4F00` "Invited · awaiting acceptance" (`hourglass_top`) → green `#E9F3EC`/`#225C3A` "Accepted" / "Linked · Verified" (`check_circle`). Row actions are **36px round icon buttons**, not text buttons: Send invitation = white `send` (paper plane) on an ink `#2B1714` circle, shown only while "Not invited"; Edit = `edit` in an outlined white circle. Both have tooltips/aria-labels. "Add person" stays the page's single primary button (icon `person_add` + label). Empty search shows "No one matches “…”". Each row's subtitle shows role · access ("No vault access" / "Can view 3 records"); the whole row opens the person panel.

### Person panel (People & Access › person)
Right-side drawer, 448px, white, shadow `-12px 0 40px rgba(31,23,21,.14)`, over a `rgba(31,23,21,.24)` scrim covering the main area (sidebar stays visible). Click scrim or ✕ (36px round, `#F3EEEA`) to close.
- **Detail view**: header (48px avatar, name 20/600, role 14 secondary, close). "Invitation" label + stage chip; 5-segment progress bar (Prepared · Sent · Accepted · Verified · Linked), 4px bars, ink when complete, `#E6DFD9` otherwise, current label 600. Facts card (46px rows): Email, Relationship, Role, Identity; "Add" link when missing. **Vault access** card: icon tile (`visibility_off` / `visibility`), "No access" + "{First} can’t see any of your records yet." with full-width primary **Give access**; once shared: "View only · N records", area chips, secondary **Change access**. Actions list: Edit details, Send/Resend invitation, Remove {First} (`#B3261E`).
- **Access view** ("Choose what {First} can see"): back link to the person, note "Access is view only. New records aren’t shared automatically." Count line ("2 records selected"). One card per area (Profile, Finances, Legal, Property, Business, Digital, Possessions): icon tile, name, "x of n selected" or "No records yet" (dimmed, no switch), a **share-all switch**, then record rows (20px rounded checkbox, ink when checked; name 14; meta 12 e.g. "Banks · £76,213.00"). Sticky footer: **Save access** (disabled colour until changed), Cancel, and "Remove all" in red when anything is selected.
- State: `drawerPersonId`, `drawerView` ('detail' | 'access'), `shared{personId: {recordKey: bool}}` (server), `draft{}` (local copy while editing).

### Access Requests
Collapsible "How access requests work" (3 short steps). "Awaiting your decision" empty state: 48px tint circle with `inbox`, "No requests waiting" 17/600, explanation 14. Two cards side by side: "Current access" (button "Manage people and permissions" → People & Access) and "Death certificate escalation" (info only).

### Support
Card "Help assistant": message list (bot bubbles white with border, radius 16/16/16/4; user bubbles ink, radius 16/16/4/16), suggested prompt chips (30px pills), input + "Ask" primary (Enter submits). Card "Contact support": Request type select + Subject (2 columns), Message textarea, "Send request" primary + "Clear" text button.

### Settings
Profile card: 64px avatar, name 20/600, email · address, chips (Ready for trusted review / Identity / Contact / Address saved), "Edit profile" secondary. Detail rows 48px: label (200px, secondary) · value · "Add" link when "Not set". Then grouped list cards (replacing the 7-card grid): **Account** Security, Billing and account · **Preferences** My Vault, Accessibility, Communications, Reminders · **Legal** Terms and conditions. Rows: 32px icon tile, name 15/500, description 13, chevron.

### My Vault (Settings › My Vault)
"9 of 9 areas shown". One card per area: icon tile, name 15/600, description 13, **switch** (42×26, ink when on). When on and the area has sub-sections, show them in a 2-column list with small switches (34×20). Turning an area off dims it (opacity .5) and hides its sub-sections. Sticky bottom bar: "Save changes" (disabled colour `#B9ACA4` until dirty), "Reset", status text "Unsaved changes" / "Changes saved". Replace all checkboxes with switches.

## Mobile (iPhone, 402×874 reference)
- Grouped background `#F6F3F0`, inset grouped lists (16px side margin, radius 12, rows ≥48px / 44pt minimum, 0.5px separators), 34/41 large titles.
- Floating tab bar (62px pill, white 92%, shadow): **Home, Actions [12], People, Settings**. Selected icon filled, ink; others `#8A7F7A`.
- **Home**: top-right bell (with accent dot) + ink "+" (opens Add). Value card (ink bg, radius 20): "Total recorded value" £652,590.00 34/700, updated date, proportional bar by section (Pensions 79.7% `#E9C9B6`, Banks 20.3% `#B7795C`) with legend, then Records / People / Debts. **Next step** card: one action at a time with "1 of 5", primary pill CTA, "Not now" (advances), page dots, "See all". "Your vault" list of areas with counts → pushes area screen.
- **Notifications** are events only (verified, updated, added), shown as a floating sheet from the bell. To-dos stay in Next step / Action Centre — they should not float.
- Area screen: Back pill, large title + description, one inset group per populated section (header shows section total), "Not added yet" group with "Add" in link colour.
- People: segmented control People | Requests.
- Android: same structure using Material 3 equivalents (top app bar, navigation bar with pill indicator, extended FAB "Add record").

## Interactions & state
- `screen` (current route) — sidebar, tiles, action CTAs and settings rows all navigate. Scroll main area to top on route change.
- People search query → client-side filter.
- My Vault: `areaVisibility{}`, `sectionVisibility{}`, `dirty`, `saved`. Save persists to the existing vault-visibility API; Reset restores server state.
- Support chat: `messages[]`, `draft`. Wire to the existing assistant.
- Mobile: `tab`, `pushed` (area id | 'add'), `stepIndex`, `notificationsOpen`, `peopleSegment`.
- Transitions: 150ms ease for switch track/knob and hover backgrounds.

## Data check
Current Dashboard shows 0 legal records / 3 total, while the Legal page shows a Will (16/07/26). The design assumes 4. Verify how dashboard counts are calculated.

## V5.1 (current standard, October 2026)
Read in this order: `CHANGELOG_V5.1.md` (what changed, superseded rules, screen inventory, acceptance checklist, open decisions) → `CONSISTENCY.md` → `ADMIN_PARTNER.md` › Mobile presentation (V5.1) → `MOBILE_V5.1.md`. Visual reference: `design/V5.1 Mobile Refinement.dc.html` (sections 1–6; ids like 2b and 6h match the badges). Where V5.1 and older files disagree, V5.1 wins; security and product-owner decisions win over everything.

## Files
- `design/V5.1 Mobile Refinement.dc.html` — V5.1 mobile standard: shared patterns, Admin, Partner, Vault, headers, switcher, TEST launcher, record edit/close/delete.
- `design/Legacy Fortress Redesign.dc.html` — all screens (2a desktop, 2b iPhone, 2c rules). Data and copy live in the `<script>` logic class at the bottom.
- `design/Finances Review.dc.html` — original critique and type scale.
- `design/support.js`, `design/ios-frame.jsx` — needed only to open the HTML locally.
- `design/Legacy Fortress Journeys.dc.html` + `JOURNEYS.md` — journeys 1–12 (linked Fortresses, invitations, identity verification, forms, record detail, executor/death reporting, notifications, search, auth, professional workspace, admin, alerts).
- `design/People and Access V4.dc.html` + `V4_UPDATE.md` — **latest**: People & Access workspace, record forms, add controls and hover states. Wins over older sections where they conflict.
- `design/Admin Console.dc.html` + `ADMIN_PARTNER.md` — **V5**: Platform Admin (with probate and commercial merged in) and the Partner portal, roles, page template.
- `CONSISTENCY.md` — voice and tone, glossary, icon dictionary, interaction and mobile rules (applies everywhere)
- `design/Partner Portal.dc.html` — opens the partner portal at its sign-in
- `AGENTS.md` — rules file for OpenAI Codex (copy to repo root)
- `PROMPTS.md` — copy-paste prompts for Claude Code, Cursor or other AI coding tools.
