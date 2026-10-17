# Consistency rules: words, icons, interaction (all interfaces)

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
| Edit | `edit` | Round outlined button |
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
| Mobile menu | `menu` | Last tab on mobile admin and partner |

## Interaction
- One primary (ink) button per view. Destructive actions are red text on white, placed left in a footer.
- Hover `#F6EFEA`, pressed `#EBE0D8`, selected = tint + 3px ink inside edge (rows) or white + ring (nav). Focus ring `#8C4A32`. 120ms background only.
- Rows: one action button at most; everything else is in the side panel (desktop) or full-screen sheet (mobile).
- Risky actions always use the confirm dialog with a required reason (admin and partner) or a plain confirm (Vault owner actions such as Revoke).
- Toast confirms every completed action, bottom centre, 3–5 seconds, optional Undo.
- Empty states say what will appear and, where possible, offer the next step.

## Mobile (all three interfaces)
- Touch targets 44px minimum; list rows 64px.
- Vault: iOS-style large titles, grouped lists, bottom tab bar.
- Partner portal and Platform Admin: 56px top bar (logo, badge, workspace switcher, avatar), 4-tab bottom bar (3 role-specific tabs + Menu), tables become two-line list rows (title, sub-line, status chip, meta), side panels become full-screen sheets, primary action is a full-width 44px button under the page title.
- Admin tabs by role: Super admin = Overview, Verification, Audit · Support agent = Overview, Users, Support · Probate reviewer = Overview, Probate, Verification · Account manager = Overview, Organisations, Licences · Auditor = Overview, Audit, Health. Partner = Overview, Team, Invitations.
