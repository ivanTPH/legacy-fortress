# Phase 3 customer-shell comparison

Version 3 source: `design_handoff_legacy_fortress 3/design/Legacy Fortress Redesign.dc.html` board 2a/2b, with [desktop reference](screenshots/v3-reference-desktop-1440x900.png) and [full mobile reference](screenshots/v3-reference-mobile-phone.png). The application captures below are authenticated with a synthetic account against local Supabase at `127.0.0.1:55421`; the Next app ran at `127.0.0.1:3012`. The browser script is `scripts/verify-v3-shell.mjs`. The Next development indicator alone was hidden during capture.

| View | Chrome application | WebKit application | Shell comparison |
| --- | --- | --- | --- |
| Owner desktop, 1440×900 | [Dashboard](screenshots/v3-phase3-owner-desktop-1440x900-chrome.png) | [Dashboard](screenshots/v3-phase3-owner-desktop-1440x900-webkit.png) | 264px sidebar, 60px header, six Vault areas, grouped Sharing, Support/Settings footer, search, security chip, account menu and nine-dot brand are present. |
| Owner mobile, 390×844 | [Dashboard](screenshots/v3-phase3-owner-mobile-390x844-chrome.png) | [Dashboard](screenshots/v3-phase3-owner-mobile-390x844-webkit.png) | Large Home title, grouped canvas, bell/add controls and four safe-area tabs are present. The menu remains available until Phase 4 supplies the designed Vault list. |
| Canonical routes | [Actions desktop](screenshots/v3-phase3-actions-desktop-1440x900-chrome.png) · [Actions mobile](screenshots/v3-phase3-actions-mobile-390x844-chrome.png) | [Actions desktop](screenshots/v3-phase3-actions-desktop-1440x900-webkit.png) · [Actions mobile](screenshots/v3-phase3-actions-mobile-390x844-webkit.png) | `/add` and `/actions` resolve and link to existing secure destinations. Their complete Version 3 screen layouts are Phase 4 work. |

## Measured interaction results

- Chrome and WebKit authenticated owner navigation reached `/dashboard`, `/add` and `/actions`; desktop Add navigation was activated with Enter. Desktop sidebar/header dimensions were 264px/60px. Mobile tabs were four and at least 44px high. Neither the default nor enlarged-text/high-contrast shell overflowed at the tested widths.
- The mobile customer drawer implements a Tab focus trap; browser checks confirmed Escape closed it and returned focus to the menu button. The role-aware customer context switcher opened the shared Sheet on mobile; Escape closed it and returned focus. Desktop primary links and account sign-out were exercised. Supabase logout returned 204 and the page navigated to `/sign-in`.
- Browser request inventory contained only the approved loopback app and Supabase hosts. Chrome reported no page errors. WebKit met the shell interaction assertions but reported local API access-control and auth-lock/load errors during dashboard loading and sign-out. The local database lacks newer columns/tables; WebKit data loading is therefore not claimed clean.
- Direct `/admin` navigation with the synthetic standard account showed “Admin access is restricted” in both engines. `/enterprise` showed “Enterprise workspace unavailable”; because the local enterprise schema is incomplete, that is not a definitive enterprise authorization proof. No privileged workspace content appeared.
- An authenticated linked-context visual comparison remains blocked: the local `account_access_grants` table lacks `required_identity_level`, so an approved zero-scope synthetic grant could not be prepared. No pending migration was applied. Unit checks cover owner-only route exclusion, assigned-area filtering and zero-scope area hiding.

## Remaining visual and product discrepancies

- The Dashboard still uses the older overview/action cards. Version 3 stats, compact area tiles, attention rows and the iPhone value/next-step cards belong to Phase 4. At 390px the existing dashboard card titles are compressed; that is a screen-level defect for Phase 4.
- The desktop Action Centre badge count is not shown in the new sidebar because a canonical privacy-scoped count is unresolved (Q4). The mobile tab also omits an unverified count.
- The mobile bell currently opens notification settings; event notifications and their Sheet require the later event contract (Q13). The desktop global search uses the existing dashboard discovery route; full scope-aware search awaits Q14.
- The local UAT banner wraps above the mobile shell, taking more vertical space than the fixed-height prototype label. Its safety copy is retained.
- The full Add and Action Centre page designs, six area templates, People, Access Requests, Support, Settings and My Vault screens need Phase 4 implementation against existing data and permissions. Other categories remain in My Vault and their existing routes.
