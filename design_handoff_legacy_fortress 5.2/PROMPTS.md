# How to hand this to an AI coding tool

## Recommended tools
- **Claude Code** (terminal agent, works directly in your repo) — best for multi-file refactors like this.
- **Cursor** or **Windsurf** (AI code editors) — good if you prefer reviewing diffs in an IDE.
- **GitHub Copilot agent mode** in VS Code — fine for smaller, screen-by-screen passes.

## Setup (5 minutes)
1. Unzip this folder into the root of your app repo, e.g. `/design_handoff_legacy_fortress`.
2. Create a branch: `git checkout -b redesign/design-system`.
3. Open the repo in your tool. With Claude Code: `cd your-repo && claude`.
4. Paste **Prompt 1**. Review and commit. Then run the remaining prompts one at a time, committing after each.

Work in small steps. Don't ask for everything in one go.

---

## Prompt 1 — Audit and plan (no code changes)
```
Read design_handoff_legacy_fortress/README.md fully, then skim
design_handoff_legacy_fortress/design/Legacy Fortress Redesign.dc.html
(the data and copy are in the logic class at the bottom).

Then explore this codebase and tell me:
1. Framework, styling approach and where shared components/tokens live.
2. Which existing components map to: AppShell/Sidebar, Header, PageHeader,
   StatsStrip, Card, ListRow, IconTile, EmptyTile, Chip, Switch, Button
   (primary/secondary/text), Avatar.
3. Which routes/files implement each screen listed in the README.
4. A step-by-step implementation plan, smallest safe steps first.

Do not change any code yet.
```

## Prompt 2 — Tokens, font and icons
```
Implement the design tokens from the README "Design tokens" section in this
codebase's existing token/theme system (CSS variables, Tailwind config, or
theme file — whatever is already used). Switch the UI font to the system
stack given. Add Google Material Symbols Rounded and create a single <Icon>
component (outline by default, `filled` prop). Do not restyle screens yet.
Show me the diff summary when done.
```

## Prompt 3 — Shared components
```
Build or update these shared components to match the README exactly
(sizes, colours, radii, states): Button (primary/secondary/text/icon),
IconTile (36/32/30), Card, ListRow (icon, title, description, trailing
value, chevron, whole-row click), EmptyTile (dashed "Not added yet"),
Chip (neutral/success/warn), Switch (42x26 and 34x20), Avatar (initials),
StatsStrip, PageHeader (title, description, optional single primary
action, optional back link). Reuse existing components where possible.
Add them to Storybook if the project has it.
```

## Prompt 4 — App shell
```
Update the app shell per README "Global layout (desktop)": 264px sidebar
with the apps-icon logo tile and workspace switcher under the brand, grouped
nav (no label / VAULT / SHARING), Support + Settings footer, header with
global search, "Vault secured" chip, bell and avatar menu. Remove the Back
button from top-level pages and the duplicate workspace switcher in the
header. Keep all existing routes and auth logic.
```

## Prompt 5 — Vault area template
```
Create one shared VaultAreaPage template per README "Vault areas" and use it
for Finances, Legal, Property, Business, Digital and Possessions. Populated
sections render as section cards with record rows; empty sections render as
EmptyTiles under "Not added yet" (or "Start with any of these" when the area
has no records). Use real plurals ("2 accounts"), labelled dates
("Updated 17 Jul 2026") and tabular numerals for money. Keep existing data
fetching and add/edit handlers.
```

## Prompt 6 — Remaining screens
Run once per screen, replacing SCREEN:
```
Restyle the SCREEN page to match the README section for SCREEN and the
matching state in the HTML reference (option 2a). Use the shared components.
Keep existing data and handlers; only change layout, components and copy
where the README says so. List any copy you changed.
```
SCREEN = Dashboard, Add to my Fortress, Action Centre, People I Trust,
Access Requests, Support, Settings, My Vault.

## Prompt 7 — Mobile
```
Implement the mobile layout per README "Mobile": below 768px, replace the
sidebar with a bottom tab bar (Home, Actions, People, Settings), use inset
grouped lists, large titles, the Home value card + Next step card, and the
notifications sheet from the bell. Area screens push with a back control.
Ensure all tap targets are at least 44px.
```

## Prompt 8 — QA pass
```
Compare every screen against the README and the HTML reference. Check:
contrast (body text ≥4.5:1), tap targets ≥44px on mobile, keyboard focus
states, no text wrapping inside buttons/chips, consistent icon set, one
primary button per screen. Fix issues and give me a checklist of what you
verified.
```

---

## Prompt 9 — Journeys (run once per journey, 1 → 12)
```
Read design_handoff_legacy_fortress/JOURNEYS.md (shared patterns + section N)
and open design/Legacy Fortress Journeys.dc.html at the matching screens.
First build any shared patterns section N needs (context banner, locked row,
stepper, step rail, status timeline, alert components) as reusable
components. Then implement journey N on desktop and mobile using existing
routes, APIs and auth. Keep business rules unchanged; flag any screen where
the design assumes data or behaviour the backend doesn't support yet.
Replace placeholder data with real values. List files changed.
```
N = 1 Linked Fortresses, 2 Invitation acceptance, 3 Identity verification,
4 Add/Edit forms, 5 Record detail, 6 Executor/death reporting,
7 Notifications, 8 Search, 9 Auth, 10 Professional workspace,
11 System admin, 12 Alerts.

## Prompt 10 — Codex consistency audit (run first, read-only)
```
Read AGENTS.md and design_handoff_legacy_fortress/README.md. Do not edit
code yet. Audit every screen and shared component in the app against the
rules and write AUDIT.md: a table of file, line, rule broken, current value
and fix. Group by rule (tokens, type, icons, buttons, chips, back
navigation, mobile targets, duplicated components). Finish with a ranked
list of the 10 fixes that remove the most inconsistency.
```

## Prompt 11 — Codex fix pass (one rule group per task)
```
Using AUDIT.md, fix only the "<rule group>" issues. Centralise values in the
token file and shared components; replace inline duplicates. Don't change
behaviour, data or routes. Run lint and tests, check 1440px and 390px, and
open a PR listing files changed and anything you couldn't fix.
```
Order: tokens → type → icons → buttons/chips → back navigation → mobile → duplicates.

## Prompt 12 — Codex PR review
```
Review this PR against AGENTS.md and the design reference for the screens it
touches. Flag hard-coded values, wrong icon set or size, more than one
primary button, missing back navigation, status shown as plain text, and
hit targets under 44px. Reply with blocking and non-blocking comments.
```

## Prompt 13 — V4 update (People & Access, forms, add controls, hover)
```
Read the updated AGENTS.md (rules 11–15) and
design_handoff_legacy_fortress/V4_UPDATE.md, and open
design/People and Access V4.dc.html. V4 wins wherever it conflicts with
older docs. Do not edit yet: list in QUESTIONS.md anything that is unclear
or that the backend doesn't support (multiple roles per person, record-
level grants, request records, audit events), and stop for my answers.
Then implement in this order, one PR each, stopping after each:
A. Interaction rules (add controls, hover/pressed/selected/focus states)
B. Record form template + field maps for each record type
C. People & Access workspace (People, panel, Give access, Add person,
   Requests, Sharing, Revoke) on desktop and mobile
Keep Connected / Verified / Access granted separate. Never auto-grant.
Run lint, tests and 1440/390 screenshots; list files changed.
```

## Prompt 14 — Admin & Partner (V5)
```
Read AGENTS.md (rules 16–17) and design_handoff_legacy_fortress/ADMIN_PARTNER.md,
and open design/Admin Console.dc.html (try each role in "Preview as role" and
the partner portal via the logo switcher). Do not edit yet:
1. Map every current admin, probate-review and enterprise-operations route to
   its new home in ADMIN_PARTNER.md. Write docs/design-implementation/
   ADMIN_MAP.md (old route → new section → keep / merge / remove).
2. List in QUESTIONS.md anything the backend can't support yet: separate admin
   sign-in, role-filtered navigation enforced server-side, one merged audit
   query, partner-scoped commercial screens, reason capture on risky actions.
Stop for my answers. Then implement in this order, one PR each:
A. Admin shell (dark sidebar, logo, ADMIN badge, UAT bar, role-filtered nav)
B. Page template, table, side panel, confirm-with-reason dialog, empty state
C. Operations · D. Probate & verification · E. Commercial · F. Oversight
G. Partner portal (Commercial screens scoped to one organisation)
Keep all server-side permission checks as they are. Lint, test, screenshot at
1440 and 1024, list files changed.
```

## Prompt 15 — Consistency pass (words, icons, mobile)
```
Read design_handoff_legacy_fortress/CONSISTENCY.md and AGENTS.md rules 18–19.
Search the whole app for every term in the glossary's "Don't say" column,
every icon used for a concept listed in the icon dictionary, Title Case or
ALL CAPS labels, numeric dates (dd/mm/yyyy) and developer wording. List them in
docs/design-implementation/AUDIT_COPY.md, then fix in one PR per interface
(Vault, Partner portal, Platform Admin). Then build the mobile layout for the
partner portal and Platform Admin. Screenshots at 1440 and 390 wide.
```

## Prompt 16 — Vault mobile V4.1
```
Read design_handoff_legacy_fortress/MOBILE_V4.1.md (it corrects
V4_MOBILE_SUPPLEMENT.md) and open design/Vault Mobile.dc.html and
design/Vault Mobile Checks.dc.html. Do not edit yet: list in QUESTIONS.md any
point you can't meet with the current shell. Then fix in this order, one PR
each: 1) self-hosted icon font + fixed icon boxes, 2) docked tab bar and
scroll-region/safe-area rules, 3) header, drawer and workspace sheet,
4) Home, 5) category, record and full-screen forms, 6) People & Access,
person page, Give access and Revoke sheets. After each PR, attach screenshots at
390x844, 320x568, 402x874 and 390 with 125% text, and the scrollWidth check.
```

## Tips
- If the tool drifts, paste the relevant README section again and say "match this exactly".
- Attach a screenshot of the HTML reference for the screen you're working on. Most tools accept images.
- Ask for one screen per commit so you can roll back easily.
- For a native iOS app later: ask it to map Material Symbols to SF Symbols and use SwiftUI `List(.insetGrouped)`, `TabView` and `.navigationTitle` with large titles.


---

## Prompt 17 — V5.1 mobile consolidation (implement after approval)

You are implementing the approved V5.1 design for Legacy Fortress. This is a refinement of V5, not a rebuild.

**Read first, in order:** `design_handoff_legacy_fortress/CHANGELOG_V5.1.md`, `CONSISTENCY.md`, `ADMIN_PARTNER.md` (section "Mobile presentation (V5.1)"), `MOBILE_V5.1.md`, and `AGENTS.md`. Open `design/V5.1 Mobile Refinement.dc.html` in Chrome or Safari with `support.js` beside it; artboard ids (2a, 6h…) are referenced throughout the docs.

**Before writing code:** add any questions to `QUESTIONS.md`, including your answer to each item in CHANGELOG_V5.1 › Open decisions (what the backend supports today). Do not invent backend capabilities: if a metric's destination or a record state (e.g. "Mark as closed") isn't supported, render the informational/fallback version described in the docs and note it.

**Do not change** database policies, RLS, legal or release workflows, roles or permissions. Navigation filtering in the UI must match what the server already enforces.

**Build as small PRs, each passing the acceptance checklist at 320 × 568, 390 × 844, 402 × 874, 390 at 125% text, and 1280 × 800:**
1. Shared: header anatomy (all three interfaces), 28px mobile UAT strip, docked tab bars (Admin/Partner 3 tabs, no Menu tab), metric components (interactive / filter / informational), info disclosure.
2. Vault: Home (4a), Action Centre consolidation (4b), Notifications sheet (4c), drawer and switcher rules (4d, 5b).
3. Vault: category (6a), record (6b), edit form with value first and Section field (6h), close/delete sheet (6i), add form (6c).
4. Vault: People & Access (6d), person page (6e), Settings (6f).
5. Admin: Overview (2a), Verification queue + case detail (2b, 2c), Organisations + detail (2d, 2e), menu (5d).
6. Partner: Overview (3a), Team & seats (3b).
7. TEST launcher (5c) only after the founding-owner check is confirmed server-side; must be absent from production builds.

**Each PR description:** screens changed, artboard ids, screenshots at the four mobile sizes, checklist items ticked, and anything deferred.

Screens marked "Next" in the inventory are not in scope.


## Prompt 18 — V5.2 records, approvals, accessibility and dark mode

Read `V5.2.md`, `AGENTS.md` rules 24–33 and `design/V5.2 Records Access and Approvals.dc.html`. Do not change authentication, permissions, database policy or architecture. Ship as small PRs, each with screenshots on iPhone (light, dark, largest text) and desktop:
1. Add `tokens.css` / `tokens.json` from the handoff as-is; replace every hard-coded colour and font size with tokens. Theme setting (Automatic · Light · Dark) via `data-theme`.
2. Accessibility baseline: 13px minimum text, 16px inputs, 44px targets, contrast fixes, Dynamic Type reflow, Reduce motion, focus rings, labels. Add an automated contrast check.
3. Record page on mobile and web: Value in main form (Add/Edit), People linked to this record with access badges, collapsed Record history.
4. Record access sheet / side panel and Person page record status (display only, from existing data).
5. Record history sheet / side panel (read from the audit source once verified; hide the section if it isn't).
6. Action Centre types and row states, mobile and web.
7. Approval path for contributed documents (notify, review, comment, approve/reject, apply). Behind a flag until backend persistence, versioning and approval enforcement are independently verified.
