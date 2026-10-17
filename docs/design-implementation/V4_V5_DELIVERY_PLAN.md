# V4/V5 incremental delivery plan

This document sequences **future, separately approved** implementation packages. This handoff commit is reference material only. Each stage starts from the latest confirmed TEST staging code, protects owner worktrees, implements only its approved scope, runs focused checks, commits and pushes a review branch, and deploys through the protected release only after owner authorisation. Verify the live SHA and hosted acceptance, then wait for actual owner visual review before starting the next stage.

| Stage | Bounded outcome | Focused evidence and checkpoint |
| --- | --- | --- |
| 1. Personal Vault mobile | Header, workspace sheet, dashboard/finance grids, drawer/tab separation, safe-area scrolling and overlays from `MOBILE_V4.1.md`, reusing the customer shell. | Role-filtered switcher and record isolation, keyboard/overlay dismissal, 390/320/402px plus 125% text geometry, real-data desktop regression. Owner approves TEST preview and visual result. |
| 2. People & Access and mobile forms | Pushed person state, explicit saved sharing, request/identity separation, full-screen form/sheet chrome and bottom actions. | Synthetic invitation, identity, grant edit/revoke and wrong-user checks; save/reload and mobile viewport proof. No implicit grants or schema changes. Owner approves TEST preview and visual result. |
| 3. Platform Admin mobile | Shared admin shell, role-filtered mobile navigation, readable lists/panels and safe-area actions. | Admin role/capability isolation, probate restrictions, keyboard and 390px proof; unchanged desktop action checks. Owner approves TEST preview and visual result. |
| 4. Partner Portal mobile | Existing enterprise functions presented with V5 mobile navigation, pages and panels where backed by current services. | Synthetic organisation/seat/invitation scope and admin isolation, 390px proof. Product-only or unsupported controls remain gated. Owner approves TEST preview and visual result. |
| 5. Desktop V5 consistency | Shared copy/icons/states, forms and admin/partner page templates across approved desktop surfaces. | Targeted 1440px visual/keyboard checks and relevant functional regressions. Architecture changes, new sign-in/two-step flows, consolidation and migrations require distinct scope and approval. |

For every stage, record the source screen, before/after screenshots, exact branch/SHA, test results and remaining deviations. Run broad suites only where code risk or the release gate requires them. Never infer security compliance from a prototype or unauthenticated screenshot.
