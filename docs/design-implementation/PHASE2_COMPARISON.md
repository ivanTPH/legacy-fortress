# Phase 2 visual comparison and verification

Source: Version 3 `README.md`, `JOURNEYS.md` and `design/Legacy Fortress Journeys.dc.html`. The reference cards were captured from the owner-provided HTML with Chrome. Phase 2 images render the actual `V3Primitives.tsx` markup and `v3-primitives.css` in an isolated local fixture. They are component evidence, not authenticated application screens.

| Version 3 reference | Phase 2 evidence | Checked result |
| --- | --- | --- |
| [Switcher 1a](screenshots/v3-phase2-reference-context-switcher.png) | [Desktop open](screenshots/v3-phase2-context-desktop-1440x900.png), [mobile sheet](screenshots/v3-phase2-context-mobile-390x844.png) | Grouped choices, selected check, keyboard selection; mobile opens a focus-trapped sheet. No auth or route decisions are encoded in the primitive. |
| [Form step rail 4a](screenshots/v3-phase2-reference-step-rail.png) | [Desktop gallery](screenshots/v3-phase2-gallery-desktop-1440x900.png), [mobile gallery](screenshots/v3-phase2-gallery-mobile-full.png) | 260px desktop rail, 24px state icons, 4px flow bars, responsive one-column layout. |
| [Estate timeline 6c](screenshots/v3-phase2-reference-timeline.png) | [Mobile gallery](screenshots/v3-phase2-gallery-mobile-full.png) | 24px done/current/pending/locked icons and 2px connectors. Status text is available to screen readers. The primitive does not infer probate authority or unlock access. |
| [Alerts 12a](screenshots/v3-phase2-reference-alerts.png) | [Desktop gallery](screenshots/v3-phase2-gallery-desktop-1440x900.png) | Token-based neutral, amber and red banners and an ink toast with icon, action and dismiss. |
| Person drawer pattern in Version 3 README | [Desktop sheet](screenshots/v3-phase2-sheet-desktop-1440x900.png), [mobile sheet](screenshots/v3-phase2-sheet-mobile-390x844.png) | 448px desktop side sheet, mobile bottom sheet; Escape, Tab trap and focus return pass in hydrated Chrome and WebKit. |

Chrome and WebKit passed at 1440×900 and 390×844. The local Rounded font loaded; card radius was 12px, desktop step rail 260px, flow bars 4px, switch track 42px and switch hit target 44px. Desktop primary button measured about 36px; mobile measured 44px. Visible mobile controls met the 44px target. The secondary text token passed the 4.5:1 contrast check against white. No horizontal overflow occurred. High contrast, enlarged text and comfortable spacing were checked in both engines. The check is reproducible with `node scripts/verify-v3-primitives.mjs`.

The mobile linked-context pill is 44px tall instead of the prototype's 36px so its action meets the 44px touch target. The fixture uses synthetic labels and has no data access. Existing screen-specific primitives are left in place until their screen phases; Phase 2 introduces one shared implementation rather than broad changes to admin, auth or vault routes.
