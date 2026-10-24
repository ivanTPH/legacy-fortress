# Consistency rules: words, icons, interaction (all interfaces)

> **Superseded where it conflicts.** `V5.2.md` and `design/Vault Master V5.2.dc.html` win. "Action Centre" / "Actions" is now **To do**; mobile Home has no To do panel; every icon tile is filled ink. Older Vault prototypes are in `design/history/` and are not to be built from.


These rules apply to Personal Vault, Partner portal and Platform Admin. Where older files disagree, this file wins.

## Voice and tone
- Plain, calm, direct UK English. Second person ("you", "your Vault"). Short sentences.
- Sentence case for everything: titles, buttons, tabs, table headings, chips. No ALL CAPS except the small `ADMIN` / `PARTNER` / `UAT` badges.
- Buttons are verbs that name the result: "Send invitation", "Save record", "Approve identity". Not "OK", "Submit" or "Confirm lifecycle action".
- Say what happens and what doesn't: "Approving confirms who someone is; it never grants access to records."
- No developer terms in UI copy: canonical, terminal state, server-authorised, scope, governed, metadata, payload, route (routes appear only in audit detail, in monospace).
- No exclamation marks, no "please", no "click". Use "select" or just name the action.
- Use curly apostrophes and quotes (’ “ ”). Use "e.g." in placeholders only.
- Dates: "17 Oct 2026" or "17 Oct, 21:58". Never 17/10/2026 in UI.
- Numbers: "12 of 20" for usage; "0 / 100" only inside stat cells.

## Glossary (use exactly these words)
| Term | Meaning | Don't say |
|---|---|---|
| Vault | A person's own space in Legacy Fortress | Account (for the space), dashboard |
| Fortress | Someone else's Vault you can see ("Ivan’s Fortress") | Linked account |
| Record | One asset or item (bank account, will, property) | Asset (in UI copy), entry |
| Document | A file attached to a record (photos included) | Picture, upload |
| People & Access | The one workspace for trusted people, requests and sharing | People I Trust, Linked accounts, Access Requests (as a page) |
| Connected · Identity verified · Access granted | The three separate states of a trusted person | Linked / verified / approved used interchangeably |
| Invitation | What is sent to a person; statuses: Saved, not sent · Invited · Accepted · Expired · Revoked | Invite (noun) |
| Give access / Edit access / Revoke | The only ways records are shared or unshared | Grant, permission (as a button) |
| Sign in / Sign out | Verb | Log in, login, log out |
| Two-step verification | Code from an authenticator app | MFA, 2FA, two-step sign-in |
| Organisation | A partner firm | Org, enterprise (in partner-facing copy) |
| Seat | One licensed user place | Entitlement |
| Platform Admin | Legacy Fortress staff console | Enterprise Operations, Probate Review (as workspaces) |
| Partner portal | A firm's own workspace | Enterprise dashboard |
| Action Centre | The one list of things the Vault owner needs to do (V5.1) | Next steps, Things worth your attention, Guidance (as separate lists) |
| Notification | Something that happened. Never a task; may link to an Action Centre item | Alert, task |
| Suggestion | Optional guidance inside the Action Centre, dismissible, never duplicates a To do | Recommendation, tip |

## Icon dictionary (Material Symbols Rounded; filled = selected or completed)
| Concept | Icon | Notes |
|---|---|---|
| Logo | `apps` on a rounded tile | Black tile on light, white tile on dark. Never "LF" text |
| Overview / dashboard | `space_dashboard` | All three interfaces |
| Action Centre / to-dos | `task_alt` | Vault only |
| Add a record | `add` in a filled ink circle | Only add-asset control |
| Add a document | `note_add` in an outlined circle | On the record it belongs to |
| Add a person | `person_add` | People & Access, Admin users, Team & seats |
| Send invitation | `send` | Round ink button on a row |
| Invitation not sent | `schedule_send` | Neutral chip |
| Waiting / in progress | `hourglass_top` | Amber chip |
| Done / healthy | `check_circle` | Green |
| Failed / rejected | `cancel` | Red |
| Identity verified | `verified_user` | Also the Identity verification nav item |
| Access / sharing | `key` | Give access button, Access requests nav |
| Connected | `link` | Person state; also Registration links |
| Locked / not shared / read-only | `lock` | |
| Edit | `edit` | Round outlined button on rows; on a page header, a 36px outlined pill with icon + "Edit" (V5.1) |
| More actions | `more_horiz` | Round outlined button |
| Delete / revoke | `block` (revoke access), `delete` (delete record) | Red |
| Probate / death | `gavel` | |
| Organisation | `domain` | Scope chip and nav |
| Licence | `workspace_premium` | |
| Seat | `event_seat` | |
| Reports | `bar_chart` | |
| Audit | `receipt_long` | One page in each interface |
| System health | `monitor_heart` | |
| Settings | `settings` | |
| Search | `search` | |
| Notifications | `notifications` | |
| Information note | `info` | Neutral box |
| Warning / security | `warning`, `shield` | Red context only |
| Mobile menu | `menu` | Header, left, in all three interfaces (V5.1) |
| Switch context | `unfold_more` | Only when more than one context exists |
| Test environment | `science` | UAT strip and TEST launcher |

## Interaction
- One primary (ink) button per view. Destructive actions are red text on white, placed left in a footer.
- Hover `#F6EFEA`, pressed `#EBE0D8`, selected = tint + 3px ink inside edge (rows) or white + ring (nav). Focus ring `#8C4A32`. 120ms background only.
- Rows: one action button at most; everything else is in the side panel (desktop) or full-screen sheet (mobile).
- Risky actions always use the confirm dialog with a required reason (admin and partner) or a plain confirm (Vault owner actions such as Revoke).
- Toast confirms every completed action, bottom centre, 3–5 seconds, optional Undo.
- Empty states say what will appear and, where possible, offer the next step.

## Information hierarchy (V5.1, all interfaces)
Reference: `design/V5.1 Mobile Refinement.dc.html` › 1a.

Every page is built in this order. Skip a level if it has nothing to say; never add a level twice.
1. **Summary.** Title, one line of description (max one sentence), then 2–4 summary metrics. No eyebrow label, breadcrumb, environment pill or workspace card on mobile.
2. **Priority actions.** At most three rows needing a decision: icon tile, title, one-line reason, count pill, chevron. Omit when empty; don't show "Nothing to do" cards.
3. **List.** Search (only if more than ~10 items), filter chips with counts, compact rows. Rows show title, one status chip, one sub-line and a chevron. At most one row action button.
4. **Detail.** Pushed page (mobile) or side panel (desktop). Evidence, history, key-values and decisions live here only.

Text rules:
- **Always visible (critical):** security boundaries, the consequence of the action on screen, legal notices, the UAT strip, errors. Use the neutral info box with `shield` or `lock`.
- **Collapsible (optional):** what the page is for, how counts are calculated, tips. Put behind a 44px `info` button next to the title (`aria-expanded`, opens inline below the title) or a disclosure row.
- Say a thing once. If the title says "Verification", the description doesn't repeat it, and no banner repeats the description.
- No hover-only behaviour. Anything revealed on hover on desktop is also reachable by tap and keyboard.

## Summary metrics (V5.1)
Three kinds, visually distinct. Don't mix kinds in one row.
| Kind | Looks like | Behaviour | Accessibility |
|---|---|---|---|
| **Interactive** | White card, 1px `#E3DAD3` border, 12px radius, value 22/600, label 13 `#6B5F5A`, `chevron_right` 18px top-right. Hover `#F6EFEA`, pressed `#EBE0D8`. Min 76px tall | Whole card is one link to a real, authorised destination (a page, or a page with a filter applied). | `<a>` with `aria-label` "{value} {label}. Open {destination}". Focus ring `#8C4A32`. |
| **Filter** | Pill chip 44px tall, label + count. Selected = ink fill, white text | Filters the list directly below. Exactly one selected. Count reflects the unfiltered total for that filter. | Group is `role="radiogroup"` or toolbar of `aria-pressed` buttons; list region is `aria-live="polite"` with result count. |
| **Informational** | No card, no border, no chevron; value 17/600 + label 13, divided by 1px lines | Not tappable, not focusable. | Plain text; read in order. |

- A metric is interactive only if the role can open its destination. If it can't, render it informational (not disabled-looking).
- If a source is unavailable, show "—" and the label "Unavailable" in the sub-line; never show 0.
- Never invent a destination: if the page doesn't exist yet, the metric is informational.
- Destinations used in V5.1: Verification requests → Verification queue · Organisations → Organisations · Active seats → Users & seats · Pending invitations → Invitations (filter: Pending) · Seats used (partner) → Team & seats · Registration links → Registration links · Clients registered → Reports · Records → Your Vault · People → People & Access · To do → Action Centre (filter: To do).

## Mobile (all three interfaces)
- Touch targets 44px minimum; list rows 64px (56px for single-line rows).
- **One header anatomy** (V5.1): menu button on the left · logo tile + context label · up to two 44px utility buttons on the right. Vault 52px, Admin and Partner 56px. Pushed pages replace the menu and logo with back chevron + parent title. See 5a.
- The context label is a button (with `unfold_more`) only when the user has more than one context to choose; otherwise it's plain text.
- Vault: large 30px titles (except Home), grouped lists, docked 4-tab bar: Home, Actions, People, Settings.
- Partner portal and Platform Admin: **3-tab docked bottom bar, role-specific; the Menu tab is removed** (menu lives in the header). Tables become compact list rows; side panels become pushed pages or full-screen sheets; primary action is a full-width 44px button under the page title.
- Admin tabs by role: Super admin = Overview, Verification, Audit · Support agent = Overview, Users, Support · Probate reviewer = Overview, Probate, Verification · Account manager = Overview, Organisations, Licences · Auditor = Overview, Audit, Health. Partner = Overview, Team, Invitations. Labels are these exact words; each tab is ≥ 106px wide at 320px so none clip.
- UAT strip on mobile: 28px, `#8C1D18`, one line "UAT · synthetic data only" with `science` icon, not interactive. The full warning is shown on the sign-in page.
