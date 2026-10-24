# Vault mobile V4.1 — corrections to the V4 mobile supplement

> **Superseded where it conflicts.** `V5.2.md` and `design/Vault Master V5.2.dc.html` win. "Action Centre" / "Actions" is now **To do**; mobile Home has no To do panel; every icon tile is filled ink. Older Vault prototypes are in `design/history/` and are not to be built from.


Reference: `design/Vault Mobile.dc.html` (one clickable phone) and `design/Vault Mobile Checks.dc.html` (the same prototype at 390 × 844, 320 × 568, 402 × 874 and 390 with 125% text). This keeps every rule in `V4_MOBILE_SUPPLEMENT.md` on `design/v4-mobile-supplement` and corrects the points below. Where they conflict, V4.1 wins. Names and figures are synthetic.

## What changed from the supplement
| # | Supplement | V4.1 |
|---|---|---|
| 1 | Workspace sheet shows Personal Vault, Platform Administration, Enterprise Operations, Platform Probate Review | Shows **Personal · Linked to you · Work (Partner portal) · Legacy Fortress staff (Platform Admin)**, filtered by `getAvailableWorkspaces`. Probate review and Enterprise Operations are sections inside Platform Admin (see ADMIN_PARTNER.md). Platform Admin has its own sign-in. |
| 2 | KPI tiles: Records, People, Debts | **Records, People, Actions** (as the brief asks). Each tile links to its destination. |
| 3 | Floating, inset tab bar | **Docked** tab bar: full-width, white, top border, `padding-bottom: env(safe-area-inset-bottom)`. The scroll region ends at its top edge, so the bar can never cover content. |
| 4 | Section header with a large "+ Add asset" pill (seen in IMG_6543) | **36px round ink (+) button in a 44px hit area**, aria-label "Add record". Header (+) on a category page opens the form with a Record type selector, so the user chooses the section. |
| 5 | Form keeps the customer tab bar (IMG_6544) | Add/Edit forms are **full-screen modals**: Cancel · title, no tab bar, docked **Save record** footer above the safe area. |
| 6 | Drawer repeats Dashboard, Action Centre, Settings (IMG_6549) | Drawer contains **only** the six Vault areas (with counts), Add to my Fortress, and Help & support. Width `min(320px, 100vw − 56px)`. |
| 7 | Icons render as text when the font is missing | See Icons below. |

## Layout
- **Header (root screens):** 52px. Menu button (44), then the brand trigger (logo + "Legacy Fortress" / "My Vault ▾", which opens the workspace sheet), Search (44) and Notifications (44, with badge). The page title is a large 30px title in the content, never repeated in the header.
- **Header (pushed screens: category, record, person):** 52px. A back chevron + the parent page's title (ellipsis) on the left, and an optional round (+) on the right. The tab bar stays visible.
- **Content:** 16px gutters, 16px gap between blocks. Every block is `flex: none` (or the container is `display: block`) so cards can never shrink to 0 height inside the scroll container.
- **Home:** an ink summary card at full width (value wraps with `overflow-wrap: anywhere`), then the KPI grid (`repeat(3, minmax(0,1fr))`, or below 360px `repeat(2, …)` with the third tile spanning both), then Your Vault (`repeat(2, minmax(0,1fr))`, one column below 360px, 96px minimum tile height), then Next steps (2 items + "See all actions").
- **Category:** a summary card (total, count, updated), one card per section that has records (header row: icon, name, "n records · £total" wrapping, round +; then record rows of 60px with name / sub-line ellipsis, amount `nowrap`, chevron), then a single "Not added yet" card listing the empty sections, each with a 32px round + in a 44px hit area.
- **Names never truncate:** record, person and document names wrap (`overflow-wrap:anywhere`). Only secondary sub-lines may ellipsize. Below 360px effective width, amounts move under the record name instead of sitting beside it.
- **Record:** a value card, a Details list, Documents (with an outlined `note_add` round button), Who can see this, and an Edit record button.
- **People & Access:** a 3-segment control (People / Requests with badge / Sharing), each segment 40px tall, `minmax(0,1fr)` columns with ellipsis. Person rows are 72px (avatar, name, roles, status chip + access chip). They show a round `send` button only when the person hasn't been invited.
- **Person page:** a pushed page, never a drawer. Centred identity, then three separate status rows (Connected · Identity verified · Access granted), then primary Give/Edit access (or Send invitation) with Revoke all, then Can see, then Contact.
- **Give access:** a sheet from 52px below the top, grabber, Cancel · title. Categories have a tri-state checkbox (a 48px button), "x of y" and an expand chevron. Record rows are 48px. Docked footer: selected count + Save access. A toast confirms with Undo. Records added later stay private.
- **Revoke:** a bottom confirm sheet with a red Revoke access button and Cancel. A toast follows, with Undo.
- **Toast:** 16px from each side, 96px above the bottom (clear of the tab bar), auto-dismisses after 4s.

## Icons
- Load Material Symbols Rounded **from the app's own origin** (self-host the woff2 and use `font-display: block`), not only from Google Fonts. The broken icons in the screenshots are icon names showing as text because the font failed to load.
- Give every icon element a fixed box: `width: 1em; height: 1em; overflow: hidden; flex: none`. If the font fails, the name is clipped instead of breaking the layout.
- Hide icon-bearing UI until `document.fonts.load("24px 'Material Symbols Rounded'")` resolves (with a 3s timeout), as the prototype does.
- For PNG export and email, use inline SVG versions of the same Material Symbols, not the font.

## Overlays
Drawer, workspace sheet, Give access and confirm sheets:
- A scrim covers the tab bar, making it inert.
- Each has its own bounded scroll area and bottom padding for the safe area.
- Focus moves to the first control and is trapped while open; Escape, Close or tapping outside closes it, and focus returns to the opener.
- Only one is open at a time.

## Acceptance (all four sizes)
- `document.documentElement.scrollWidth <= innerWidth` on every screen and overlay.
- No text overlaps; amounts are `nowrap` and names ellipsize; titles wrap.
- Every interactive target is at least 44 × 44 (the round buttons have 36px visuals inside 44px hit areas).
- The last item in each scroll region is fully visible above the tab bar or Save bar.
- Icons render (or are clipped boxes, never words) with fonts blocked.
- Desktop at 768px and above is unchanged.
