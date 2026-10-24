# V5.1 changelog

> **Superseded where it conflicts.** `V5.2.md` and `design/Vault Master V5.2.dc.html` win. "Action Centre" / "Actions" is now **To do**; mobile Home has no To do panel; every icon tile is filled ink. Older Vault prototypes are in `design/history/` and are not to be built from.


> Continued in **V5.2.md** (mobile + web, accessibility, dark mode).

Design-only release. Visual reference: `design/V5.1 Mobile Refinement.dc.html`. Precedence: security and product-owner decisions > V5.1 > V5 docs > prototypes.

## Clarifications, 22 Oct 2026 (owner UAT)
Same V5.1 standard; no new version. Prototype artboards marked "Clarified" / "New 22 Oct". Authentication, permissions, database policy, architecture, security boundaries and the approved TEST launcher are unchanged.
1. **Record value in main form** (MOBILE_V5.1 › Add/Edit record form; AGENTS #24; 6c, 6h). Amount and As of move out of Optional details into a "Value · Optional" card. Still optional unless a validated business rule requires them.
2. **Action Centre row states** (MOBILE_V5.1 › Action Centre; AGENTS #26; 4b, 4e). Hover, pressed and inset focus-visible ring per the shared standard; Suggested dismiss is its own target.
3. **Task type distinctions** (MOBILE_V5.1 › Action Centre; AGENTS #25; 4a, 4b, 4e). Heading icon, tile shape/outline, weight, trailing control and accessible-name prefix per type.
4. **Linked people on the record** (MOBILE_V5.1 › Linked people on a record; AGENTS #27; 6b). One compact row of 36px avatars at the bottom of the record page; circle + warm tint = family & friends, rounded square + teal tint = professional; small bottom-right badge shows access (visibility / gavel / lock / link).
5. **Status and editing live in People & Access** (same refs; 6e). Tapping an avatar opens the person; their Records list shows per-record status (Can see · Limited · On release · Linked, no access) and the edit control. Acceptance/verification never shown as visibility.
7. **Record access states and icon rule** (MOBILE_V5.1 › Record access states; AGENTS #27, #29; 6b, 6k, 6m, 6e). Five states; badge = effective access, outline = connection; only record-relevant people appear; record-specific access sheet with owner actions. Replaces the 4 and 5 wording above where they differ.
8. **Record history and contributor approval** (MOBILE_V5.1 › Record history; AGENTS #28; 6b, 6n). Provenance section on every record, full history sheet, status chips, System vs person.
9. **Approval path for contributed documents** (MOBILE_V5.1 › Approval path; AGENTS #28; 7a–7f). Notification, To do, review with comments, reject with reason, approve and apply, history.
6. **Boundaries preserved.** Rules 14, 16 and 23 unchanged.

## Files
- **CONSISTENCY.md** — added Information hierarchy, Summary metrics, glossary terms (Action Centre, Notification, Suggestion), icons (`unfold_more`, `science`); rewrote the Mobile section.
- **ADMIN_PARTNER.md** — added "Mobile presentation (V5.1)": header, tab bar, menu, Overview, Verification queue, Case detail, Organisations, Partner Team & seats, desktop notes.
- **MOBILE_V5.1.md** (new) — Vault header, Home, Action Centre, Notifications, switcher, TEST launcher.
- **design/V5.1 Mobile Refinement.dc.html** (new) — 2a–2e Admin, 3a–3b Partner, 4a–4d Vault, 5a–5d headers, switcher, launcher, Admin menu, 6a–6f Vault category, record, form, People & Access, person, Settings.

## Superseded rules
| Old rule (file) | Replaced by |
|---|---|
| Admin/Partner mobile: "4-tab bottom bar (3 role-specific tabs + Menu)" (CONSISTENCY › Mobile) | 3 docked tabs; menu button in the header, left |
| Icon dictionary: `menu` = "Last tab on mobile admin and partner" | `menu` = header, left, all interfaces |
| "56px top bar (logo, badge, workspace switcher, avatar)" | No workspace switcher in Admin/Partner headers; search added |
| V4.1 #1: Vault switcher shows Personal · Linked · Work · Staff | Vault switcher shows Yours · Linked to you only |
| V4.1 #2 / Home: KPI "Actions" | KPI "To do" (owner tasks only); same count everywhere |
| V4.1 Layout › Home: Your Vault as 2-column tiles, then Next steps | Your Vault as one list card; To do preview (3) before it; Next steps removed |
| UAT banner 32px multi-line on mobile (ADMIN_PARTNER › Security) | 28px one-line strip on mobile; full text on sign-in |
| V5 Admin page template step 5: stat strip "one card, equal cells" | Three metric kinds (interactive / filter / informational) |
| Admin verification list as expanded cards | Compact 3-line rows; all evidence in detail |
| Organisations: large stat cards | One seats metric + filter chips with counts |

| V4.1 Category: three-cell summary card + "Add asset" pills | Informational total line; round (+) only |
| V4 forms: "Required" tag, helper and icon on every field | One Required heading and one helper per form |
| V4.1 People & Access: Add person button, search label, chip row | One row: search · filter · round person_add |
| V4.1 Person rows: status chip + access chip + progress bar | One furthest-state chip; progress on the person page |
| V4.1 Person page: centred identity block | Left-aligned identity row |

Unchanged: tokens, typography, colours, icons, buttons, forms, the confirm-with-reason dialog, roles, security constraints, desktop layout.

## Mobile screen inventory
Status: **Drawn** = V5.1 artboard exists · **Rules** = apply V5.1 rules, no new artboard needed · **Next** = to be drawn.

| Interface | Screen | Status | Reference |
|---|---|---|---|
| Vault | Home | Drawn | 4a |
| Vault | Action Centre | Drawn | 4b, 4e (types, states) |
| Vault | Notifications | Drawn | 4c |
| Vault | Drawer | Drawn | 4d |
| Vault | Switch Vault sheet | Drawn | 5b |
| Vault | TEST launcher | Drawn | 5c |
| Vault | Category (all six) | Drawn | 6a |
| Vault | Record | Drawn | 6b |
| Vault | Edit record, Close/Delete | Drawn | 6h, 6i |
| Vault | Add / Edit record | Drawn | 6c |
| Vault | People & Access · People | Drawn | 6d |
| Vault | People & Access · Requests, Sharing | Rules | 6d + V4.1 |
| Vault | Person page (incl. per-record status) | Drawn | 6e |
| Vault | Record access sheet | Drawn | 6m (icon rule 6k) |
| Vault | Record history sheet | Drawn | 6n |
| Vault | Approval path: notify, review, comment, reject, approve, history | Drawn | 7a–7f |
| Partner | Propose document / see decision | Next | — |
| Vault | Give access sheet, Revoke sheet | Rules | V4.1 |
| Vault | Settings | Drawn | 6f |
| Vault | Search | Rules | list pattern |
| Vault | Linked Fortress view | Next | — |
| Partner | Overview | Drawn | 3a |
| Partner | Team & seats | Drawn | 3b |
| Partner | Invitations, Registration links, Activity log | Next | — |
| Partner | Reports, Licence | Next | — |
| Partner | Client access | Next | — |
| Admin | Overview | Drawn | 2a |
| Admin | Verification queue + case | Drawn | 2b, 2c |
| Admin | Organisations + detail | Drawn | 2d, 2e |
| Admin | Menu | Drawn | 5d |
| Admin | Customer users, Invitations, Access requests, Support, Probate cases, Licences, Users & seats, Registration links, Reports, Audit, System health, Admin users, Settings | Next (one pattern board) | — |
| All | Sign-in | Rules | ADMIN_PARTNER › Sign-in |

## Acceptance checklist
Run on 320 × 568, 390 × 844, 402 × 874, 390 at 125% text, and desktop 1280 × 800.

**All screens**
- [ ] `document.documentElement.scrollWidth <= innerWidth` on every screen, sheet and menu.
- [ ] Every interactive target ≥ 44 × 44 (measure hit area, not visual).
- [ ] Header has exactly: menu or back · logo/context · ≤ 2 utilities. Nothing overlaps at 320px.
- [ ] Bottom tab labels fully visible at 320px and 125% text.
- [ ] Last item in each scroll region fully visible above the tab bar or footer.
- [ ] No hover-only behaviour; all disclosures work by tap, Enter and Space, with `aria-expanded`.
- [ ] Every interactive metric opens its listed destination; every non-interactive metric is not focusable.
- [ ] Screen reader reads metrics as "{value} {label}. Open {destination}".
- [ ] No page shows eyebrow + title + breadcrumb + description together on mobile.
- [ ] Copy contains none of: canonical, scope, governed, metadata, server-authorised, payload, workspace (Admin/Partner).

**Admin**
- [ ] No STAGING pill, Workspace card or Switch context panel on any mobile screen.
- [ ] Verification rows show only reference, type, pending action, status, reviewer, age.
- [ ] Case detail evidence opens only in the secure viewer; boundary note visible without scrolling the footer.
- [ ] Auditor sees no action buttons; metrics for sections they can't open are informational.

**Partner**
- [ ] Scope chip under every page title.
- [ ] No client Vault content anywhere without the client's Give access.

**Vault**
- [ ] Home has only: summary card, To do preview, Your Vault.
- [ ] To do count identical on Home metric, Actions badge and Action Centre chip.
- [ ] No suggestion duplicates a To do or Waiting item.
- [ ] Notifications have no decision buttons.
- [ ] With one context, the header label is not a button and the drawer has no switcher.
- [ ] TEST launcher absent in production builds and for every non-owner account.
- [ ] Page title appears once (not in both header and content).
- [ ] First real content starts within 300px of the scroll area top at 390 × 844 (Home, category, People & Access, Action Centre).
- [ ] Forms show one Required heading and one helper; no per-field Required tags.
- [ ] Category pages have no "Add asset" pills; totals never overlap at 320px.
- [ ] Record page has exactly one edit entry point (header Edit); close and delete are reached only through the edit form.
- [ ] Add and Edit record forms show Amount and As of in the main form; saving works with both empty.
- [ ] Action Centre types are distinguishable in greyscale and by screen reader ("To do: …", "Waiting on others: …", "Suggested: …").
- [ ] Action Centre rows show hover, pressed and keyboard focus-visible states; Tab reaches each row and each dismiss button.
- [ ] Record shows only people with a relationship to that record; ≤ 3 avatars + "+N"; each has a status badge and status in words; each opens 6m.
- [ ] No `lock_open` badge anywhere without an approved release; verification never appears as access.
- [ ] Record history section on every record type; full history lists pending, approved, rejected and applied entries with UK dates and times; System entries are separate from people.
- [ ] A contributor never sees an Approve control on their own proposal.
- [ ] Push/email for a proposal contain no names, record titles or file names.
- [ ] Reject can't be submitted without a reason; comments keep the proposal pending.
- [ ] A proposed document is not visible on the record, or downloadable, before approval.
- [ ] Person page lists each linked record with one status chip and an edit control.
- [ ] A person who has only accepted an invitation or verified identity is never counted or shown as "can see now".

## Open decisions
1. **TEST launcher security:** how the founding-owner flag is stored and checked, and whether opening the launcher is audited. (Needs security sign-off; design assumes server-side flag + audit entry.)
2. **Name on verification case detail:** shown to the assigned reviewer only, or to every verification role? Prototype shows it; list never does.
3. **"Clients registered" (Partner)** links to Reports. Confirm Reports can filter by registration link, otherwise make it informational.
4. **Active seats (Admin)** links to Users & seats. Confirm that page supports a "seat in use" filter.
5. **Suggested items:** confirm the list of suggestions and whether dismissals sync across devices.
6. **"Mark as closed" is a new record state.** Needs a `closed_at` field, exclusion from totals, and a decision on whether closed records still count toward estate release. If the backend can't support it yet, ship Delete only and hide 6i's first option.
8. **Linked people data:** confirm "linked to this record" can be derived (granted, attorney, designated for release, joint holder) without exposing other records. If "designated" isn't stored per record, show only people with a grant or attorney authority.
9. **Enforcement before claims:** access-control implementation, migrations, event persistence, versioning and approval enforcement must be verified before the UI ships these states as enforced.
10. **Authorised reviewer:** who other than the owner may approve a proposal (spec example uses "PY — Authorised reviewer"); prototype shows the owner approving.
7. **Delete undo:** 5-second toast Undo assumes a soft delete. Confirm, or replace Undo with a typed confirmation.
