# Journeys spec (screens 1–12)

Visual reference: `design/Legacy Fortress Journeys.dc.html` (open in Chrome/Safari; ids like 3g match the badges). All tokens, type, icons and components come from `README.md`. Placeholder data (org names, admin counts, timings, retention periods) must be replaced with real values.

## New shared patterns
- **Context banner**: 44px ink `#2B1714` bar at the top of main content whenever the user is inside someone else's Fortress. Icon `visibility` (or `visibility_off` when no access) + "**{Owner}'s Fortress** · {role} · {access}" + right link "Switch to my Vault". Mobile: 36px ink pill under the status bar.
- **Locked row**: background `#FCFAF8`, `lock` icon, "N records not shared with you", meta "Names and values are hidden", trailing text link "Request access". Never reveal names/values/counts per section beyond this.
- **Restricted panel**: dashed `#D9CFC8` card with `lock` icon, title, one-line reason, "Request access".
- **Flow stepper**: N equal 4px bars (ink done/current, `#E6DFD9` todo) + "Step x of N · Label" 13px.
- **Step rail (desktop forms)**: 260px left rail; done = filled green `check_circle`, current = ink numbered circle in a white selected tile, todo = outlined numbered circle.
- **Status timeline**: vertical list, 24px state icon (done green filled, current spinner, todo `radio_button_unchecked`, final `lock`), 2px connector (green done, `#E6DFD9` todo).
- **Camera screens**: dark full-bleed, 2000px spread shadow to darken outside the frame, 3px white frame radius 16, 44px translucent round controls, green "Hold still… capturing" chip, 76px shutter.
- **Alert levels**: inline banner (red `#FDF3F2`/`#F2CFCB` security & errors · amber `#FEF8EC`/`#F1DFB4` warnings & pending · neutral `#F7F4F1`/`#EBE4DE` info), toast (ink pill, bottom-centre, 5s, optional Undo/Retry), full-page state (52px icon circle, 20/700 title, one-line reason, one primary).

## 1. Linked Fortresses (1a–1d)
Switcher (sidebar brand row / mobile title "My Vault ▾" → sheet). Groups: Your Fortress (checked when active) · Work (professional orgs) · Linked to you (role · access · records you can see; amber chip if invitation pending). Selecting reloads the shell in that context: sidebar shows only shared areas with counts + "My role" + "Back to my Vault". Overview: stats (Relationship, Your access, Role), area cards mixing permitted rows and one locked row. Zero access (1c): centred state, relationship card, "Request access" + "Back to my Vault".

## 2. Invitation acceptance (2a–2g)
Email → landing (what you can do / what stays private) → create account (email locked & prefilled, password with live rule check, Apple/Google) → verify hand-off → linked confirmation → own Vault first-run with linked-Fortress card and "Start your own Vault". 4-step stepper throughout. Desktop: same content in a centred 520px card. Decline is always available as a text button.

## 3. Identity verification (3a–3i)
Consent (3 explained points + checkbox) → choose document (Passport / Driving licence / National ID) → camera with auto-capture → review with 3 quality checks (Use this photo / Retake) → liveness oval with progress ring and single instruction → checking list → failure (plain reason, tips, attempt x of 3, Try again / Use a different document / Get help) → verified. Desktop offers QR hand-off to phone with webcam fallback.

## 4. Add/Edit record forms (4a–4d) — V4 template
Replaces the earlier stepped form (step rail, Save & continue, Save & finish later); those are withdrawn. Use the single-page template in V4_UPDATE.md §B: breadcrumb + title + close; Required block (Record type, name, type, value) with "Required" tags; collapsed Optional groups; one attachment area; footer with lock note · Cancel · Save record. 4b shows the attachment upload states (uploaded, progress, error with retry). Mobile: Required / Optional grouped lists, optional groups push to sub-pages, sticky Save record. Edit (4d): same template prefilled, groups show "x of y added", footer Delete record (red text) · Cancel · Save changes. Never request passwords or PINs.

## 5. Record detail (5a–5c)
Owner: breadcrumb, title + meta, Edit primary + overflow menu, tabs Overview · Documents · History · Access. Overview = details card + "Who can see this" + "Recent activity". Linked person: context banner, no Edit, no History/Access tabs, restricted panels for unshared parts. Fully locked: centred lock state, section name only.

## 6. Executor / death reporting (6a–6d)
"Your role as executor" page (Now / If Ivan dies / After verification) with "Report a death" as a secondary card action. Report form: date of death, relationship, evidence list (death certificate required; grant of probate can follow), notice that submitting doesn't grant access, Save & finish later / Submit report. Tracker: Death reported → Evidence being reviewed → Death verified → Executor authority confirmed → Access granted, with inline "Upload grant of probate" when needed and a persistent lock note.

## 7. Notifications centre (7a–7c)
Bell popover 400px: All / Unread chips, Today / Earlier groups, unread = accent dot + 600 title, "Mark all read", "View all". Full page: filter chips (All, Unread, Security, People, Records), list + 400px detail pane (security events offer "This was me" / "Secure my account" in red). Empty: "You're all caught up".

## 8. Global search (8a–8c)
Header field shows scope ("in My Vault" / "in Ivan's Fortress"). Dropdown grouped Records / People / Pages, max 4 each, match highlighted bold, keyboard hints footer, "All results". Results page: count line, filter chips with counts, rows with breadcrumb path. No results: "Nothing matches '…'" + "Add '…'". Mobile: full-screen search with Cancel, grouped results, recent searches.

## 9. Auth (9a–9c)
Reskin only; keep existing behaviour. 400px card, logo above, inline field errors in `#B3261E` with `error` icon, 6-box OTP with resend countdown, recovery "Check your email" that doesn't confirm account existence.

## 10. Professional workspace (10a–10b)
Org badge tile teal `#E3EEEC` / `#1F5A55` (only use of teal; marks work context). Org nav: Overview, Clients, Team, Licences, Organisation settings, "Switch to my Vault". Overview stats with licence usage bar; team table (name+email, role, clients, status chip, overflow). Primary: "Invite team member".

## 11. System administration (11a–11b)
Separate shell: dark sidebar `#1F1715`, white logo tile, red ADMIN badge, 44px dense table rows. Nav: Overview, Probate & deaths (count), Organisations, Users, Invitations, Audit log. Overview: 4 stats incl. service health, death & probate queue with stage chips and Review/Open. Audit log: monospace rows, filters, CSV export, failures tinted red. No route into customer record content.

## 12. Alerts & exceptional states (12a–12b)
Banners: security sign-in, failed invitation, service degraded. Toasts: success with Undo, error with Retry. Full-page: expired link (request new), permission denied (Go to my Vault / Request access), service unavailable (Try again). Verification failure = 3g.
