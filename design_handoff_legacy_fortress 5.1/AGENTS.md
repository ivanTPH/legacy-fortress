# AGENTS.md — Legacy Fortress UI rules (for Codex)

Copy this file to the repo root. Codex reads it automatically on every task.

## Source of truth
- `design_handoff_legacy_fortress/README.md` — tokens, type, icons, components
- `design_handoff_legacy_fortress/V4_UPDATE.md` — **latest; wins over older docs where they conflict**: People & Access, record forms, add controls, hover states
- `design_handoff_legacy_fortress/CONSISTENCY.md` — voice, glossary, icon dictionary, interaction and mobile rules for every interface
- `design_handoff_legacy_fortress/ADMIN_PARTNER.md` — Platform Admin + Partner portal architecture, roles and page template (V5)
- `design_handoff_legacy_fortress/JOURNEYS.md` — journeys 1–12 (Journey 4 now uses the V4 form template)
- `design_handoff_legacy_fortress/design/*.dc.html` — visual reference (open in a browser)

## Non-negotiable rules
1. Use only the colour, spacing, radius and type tokens in README.md. No hard-coded hex, px font sizes or one-off shadows in components.
2. One font family (as specified in README). Weights 400 / 500 / 600 / 700 only.
3. Icons: Material Symbols Rounded only (SF Symbols equivalents on native iOS). 20px in lists/nav, 18px in buttons, 24px in headers. No emoji, no mixed icon sets.
4. Buttons: one primary (ink #2B1714) per view. Row actions are 36px round icon buttons with tooltip + aria-label.
5. Status = one Chip component (neutral / amber / green / red). Never plain coloured text.
6. Every sub-page has a back affordance: desktop breadcrumb, mobile back chevron with parent title.
7. Mobile: 44px minimum hit targets, grouped inset lists, bottom tab bar, sheets for add/edit.
8. Logo: the 9-dot `apps` glyph on a black rounded tile. Do not alter.
9. Reuse shared components (Icon, Button, Chip, Row, Card, PageHeader, ContextBanner, LockedRow, Stepper, Banner, Toast, EmptyState). Never duplicate one inline.
10. Don't change data fetching, auth, routing or business rules while restyling.
11. Adding: the round (+) `add` button is the only "Add asset" control; outlined `note_add` on each asset row is the only "Add document" control. No page-level add-document or add-picture buttons.
12. Interactive surfaces share one state set: hover #F6EFEA, pressed #EBE0D8, selected white + ring, focus ring #8C4A32. Background change only, 120ms.
13. Forms: Required block first with "Required" tags; optional fields in collapsed groups; max 2 columns; custom dropdown chevron with 12px right padding; one Cancel.
14. Connected, Identity verified and Access granted are always separate states. Nothing grants record access except an explicit Give access save.
15. If anything in the design is unclear or the data isn't available, ask before building. Log questions in docs/design-implementation/QUESTIONS.md.
16. Three interfaces only: Personal Vault, Partner portal, Platform Admin (see ADMIN_PARTNER.md). Probate Review and Enterprise Operations are not separate workspaces; they are sections of Platform Admin. Platform Admin has its own sign-in with required two-step verification.
18. Copy, terminology and icons follow CONSISTENCY.md exactly (glossary + icon dictionary). Flag any screen that uses another word or icon for the same concept.
20. Vault mobile follows MOBILE_V4.1.md, which overrides V4_MOBILE_SUPPLEMENT.md where they differ.
19. Admin and partner consoles must have the mobile layout in CONSISTENCY.md › Mobile.
17. Admin and partner pages use the shared page template: breadcrumb, page-name title, one-line description, one primary action, then table. One row action button maximum; everything else in the side panel. Risky actions need a confirm dialog with a required reason.

## Definition of done
- `npm run lint` and `npm test` pass (use the repo's actual scripts).
- No new hard-coded colours: `grep -rnE "#[0-9a-fA-F]{3,6}" src --include=*.tsx --include=*.css` returns only the token file.
- Changed screens checked at 1440px and 390px wide.
- PR description lists files changed and any deviation from the design, with the reason.
