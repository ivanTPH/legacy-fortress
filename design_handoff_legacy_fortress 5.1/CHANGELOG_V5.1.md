# V5.1 changelog

Design-only release. Visual reference: `design/V5.1 Mobile Refinement.dc.html`. Precedence: security and product-owner decisions > V5.1 > V5 docs > prototypes.

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
| Vault | Action Centre | Drawn | 4b |
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
| Vault | Person page | Drawn | 6e |
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

## Open decisions
1. **TEST launcher security:** how the founding-owner flag is stored and checked, and whether opening the launcher is audited. (Needs security sign-off; design assumes server-side flag + audit entry.)
2. **Name on verification case detail:** shown to the assigned reviewer only, or to every verification role? Prototype shows it; list never does.
3. **"Clients registered" (Partner)** links to Reports. Confirm Reports can filter by registration link, otherwise make it informational.
4. **Active seats (Admin)** links to Users & seats. Confirm that page supports a "seat in use" filter.
5. **Suggested items:** confirm the list of suggestions and whether dismissals sync across devices.
6. **"Mark as closed" is a new record state.** Needs a `closed_at` field, exclusion from totals, and a decision on whether closed records still count toward estate release. If the backend can't support it yet, ship Delete only and hide 6i's first option.
7. **Delete undo:** 5-second toast Undo assumes a soft delete. Confirm, or replace Undo with a typed confirmation.
