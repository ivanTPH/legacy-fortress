# AGENTS.md — Legacy Fortress UI rules (for Codex)

Copy this file to the repo root. Codex reads it automatically on every task.

## Source of truth (highest first)
0. Security and product-owner decisions (access, release, verification, roles). Never overridden by design files.
1. `design_handoff_legacy_fortress/CHANGELOG_V5.1.md` — **current standard**: what V5.1 changed, superseded rules, screen inventory, acceptance checklist, open decisions
2. `design_handoff_legacy_fortress/MOBILE_V5.1.md` — Vault mobile (wins over MOBILE_V4.1.md where they differ)
3. `design_handoff_legacy_fortress/ADMIN_PARTNER.md` — Platform Admin + Partner portal architecture, roles, page template; "Mobile presentation (V5.1)" section wins over the rest of the file for mobile
4. `design_handoff_legacy_fortress/CONSISTENCY.md` — voice, glossary, icon dictionary, information hierarchy, summary metrics, interaction and mobile rules for every interface
5. `design_handoff_legacy_fortress/MOBILE_V4.1.md` — Vault mobile base layout, icons, overlays
6. `design_handoff_legacy_fortress/V4_UPDATE.md` — People & Access, record forms, add controls, hover states
7. `design_handoff_legacy_fortress/JOURNEYS.md` — journeys 1–12 (Journey 4 uses the V4 form template)
8. `design_handoff_legacy_fortress/README.md` — tokens, type, icons, components
- `design_handoff_legacy_fortress/design/*.dc.html` — visual reference (open in a browser). `V5.1 Mobile Refinement.dc.html` is the newest; where an older prototype differs from it, V5.1 wins.

## Non-negotiable rules
1. Use only the colour, spacing, radius and type tokens in README.md. No hard-coded hex, px font sizes or one-off shadows in components.
2. One font family (as specified in README). Weights 400 / 500 / 600 / 700 only.
3. Icons: Material Symbols Rounded only (SF Symbols equivalents on native iOS), self-hosted. 20px in lists/nav, 18px in buttons, 24px in headers. No emoji, no mixed icon sets.
4. Buttons: one primary (ink #2B1714) per view. Row actions are 36px round icon buttons with tooltip + aria-label. Page-header Edit is a 36px outlined pill with icon + "Edit".
5. Status = one Chip component (neutral / amber / green / red). Never plain coloured text.
6. Every sub-page has a back affordance: desktop breadcrumb, mobile back chevron with parent title.
7. Mobile: 44px minimum hit targets, grouped inset lists, docked bottom tab bar, sheets or full-screen modals for add/edit.
8. Logo: the 9-dot `apps` glyph on a black rounded tile (white on dark Admin). Do not alter.
9. Reuse shared components (Icon, Button, Chip, Row, Card, PageHeader, Metric, ContextBanner, LockedRow, Stepper, Banner, Toast, EmptyState). Never duplicate one inline.
10. Don't change data fetching, auth, routing, database policies or business rules while restyling.
11. Adding: the round (+) `add` button is the only "Add record" control; outlined `note_add` on each record is the only "Add document" control. No "Add asset" pills, no page-level add-document buttons.
12. Interactive surfaces share one state set: hover #F6EFEA, pressed #EBE0D8, selected white + ring, focus ring #8C4A32. Background change only, 120ms. Nothing is hover-only.
13. Forms: one "Required" heading and one helper sentence per form (no per-field Required tags); optional fields in one collapsed group; max 2 columns; custom dropdown chevron with 12px right padding; one Cancel. Edit forms put Value first.
14. Connected, Identity verified and Access granted are always separate states. Nothing grants record access except an explicit Give access save.
15. If anything in the design is unclear or the data isn't available, ask before building. Log questions in docs/design-implementation/QUESTIONS.md.
16. Three interfaces only: Personal Vault, Partner portal, Platform Admin, each a separate sign-in and security domain. Probate Review and Enterprise Operations are sections of Platform Admin. The Vault switcher lists only the user's own Vault and Fortresses linked to them.
17. Admin and partner pages use the shared page template: title, one-line description, one primary action, then list/table. One row action button maximum; everything else in the side panel (desktop) or detail page (mobile). Risky actions need a confirm dialog with a required reason.
18. Copy, terminology and icons follow CONSISTENCY.md exactly (glossary + icon dictionary). Flag any screen that uses another word or icon for the same concept.
19. Every page follows Summary → Priority actions → List → Detail (CONSISTENCY.md › Information hierarchy). Title appears once. Critical safety text stays visible; optional explanation goes behind an `info` disclosure.
20. Summary metrics are one of three kinds: interactive (card + chevron, opens a real authorised destination), filter (chip with count), informational (no card, not focusable). Never make a metric look tappable without a destination.
21. Mobile header anatomy is the same in all three interfaces: menu left · logo + context · up to two utilities. Admin and Partner have 3 docked role tabs and no Menu tab.
22. The Vault has one task list, the Action Centre. Home shows its top three. Notifications are events, never tasks. Suggestions never duplicate a task.
23. The TEST launcher exists only in non-production builds and only for the server-verified founding owner. It opens each environment's own sign-in and passes no session, role or user id.
24. Record forms show the Value block (Amount, As of) in the main form under "Value · Optional", never inside Optional details. Optional for saving unless an existing validated business rule says otherwise.
25. Action Centre task types (To do, Waiting on others, Suggested) differ by heading icon, tile shape/outline, title weight and trailing control, plus a type prefix in the accessible name. Colour is never the only cue.
26. Action Centre rows (desktop and mobile) use the shared state set from #12, with an inset focus-visible ring. Suggested rows have a separate dismiss button with its own states.
27. Record access: linked isn't access. Only people with a relationship to that record appear on it (designated, limited authority, released). Avatar badge = effective access (lock · edit_note/id_card · lock_open, distinct by glyph and fill); dashed outline = not connected. Status always in words. Avatar opens the record-specific access sheet. Never show lock_open before an approved release.
28. Every record has a collapsed Record history disclosure (expands to created, last updated, approved + View full history) and a full append-only history sheet. Distinguish the person acting from the System applying a change. Proposals follow Proposed → Pending approval → Approved/Rejected → Applied; no self-approval; no values or documents in history. Approval path (7a–7f): content-free push/email, To do first, review with comments, reject needs a reason, approval applies via System.
29. The UI never claims a restriction or audit guarantee is enforced until the backend implementation is verified.
30. V5.2.md is authoritative for record pages, access, history, approvals, accessibility and dark mode on both mobile and web.
31. Web: sheets → 440px right side panels; full-screen forms → centred dialogs; record page = main column + 380px right rail (people, history).
32. Minimum 13px text; inputs 16px; 44 × 44 targets; contrast 4.5:1 text, 3:1 borders and focus, in light, dark and increased contrast. Support Dynamic Type to the largest size, Bold text, Reduce motion, forced colours.
33. Colours come only from semantic tokens with light, dark and increased-contrast values (V5.2.md › Appearance). Theme: Automatic (default) · Light · Dark.

## Definition of done
- `npm run lint` and `npm test` pass (use the repo's actual scripts).
- No new hard-coded colours: `grep -rnE "#[0-9a-fA-F]{3,6}" src --include=*.tsx --include=*.css` returns only the token file.
- Changed screens pass CHANGELOG_V5.1 › Acceptance checklist at 320 × 568, 390 × 844, 402 × 874, 390 at 125% text, and 1280 × 800.
- PR description lists files changed, artboard ids, and any deviation from the design with the reason.
