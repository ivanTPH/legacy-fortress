# Version 3 design implementation plan — Phase 2 checkpoint

Status: **Phase 2 implemented; Phase 3 requires a separate owner checkpoint** (14 October 2026). The authoritative design source is `design_handoff_legacy_fortress 3/`; the repository root `AGENTS.md` remains intact. Version 3 takes precedence over earlier design handoffs for visual design, while `PROJECT_CONTEXT.md`, `LEGACY_FORTRESS_DATA_PROTECTION_GOVERNANCE.md`, existing security policy and the root `AGENTS.md` continue to govern access, privacy and environment safety. The HTML files are reference prototypes, not code or a source of customer data.

## Evidence and status key

Read the Version 3 `CODEX_MASTER_PROMPT.md`, `AGENTS.md`, `PROMPTS.md`, `README.md`, `JOURNEYS.md`, and rendered all three `design/*.dc.html` files in installed Chrome with their local `support.js` and `ios-frame.jsx`. Reviewed the route manifest, page tree, shared components, CSS tokens, Playwright config, core data/security modules, current root governance documents and `docs/CODEX_HANDOVER.md`. The legacy `Finances Review.dc.html` is rationale (1a–1d), while `Legacy Fortress Redesign.dc.html` is the approved core board (2a desktop, 2b iPhone, 2c rules). Journey IDs below refer to `Legacy Fortress Journeys.dc.html`.

`Exists` means a route/interface for the same task is present; `partial` means material design or workflow work remains; `missing` means no corresponding interface was found. Backend support `yes` means an existing persistence/API path for the basic task was found, **not** that the entire design flow has been proven. `Unclear` needs contract or browser verification; `no` means no matching support was found in this review. These are code-review assessments, not end-to-end UAT results.

## Application map and reusable seams

| Area | Current implementation | Design gap / safe seam |
| --- | --- | --- |
| Framework and routes | Next.js 16 App Router under `app/`; customer shell in `app/(app)/layout.tsx`; canonical nav in `config/routeManifest.tsx`; `/access`, `/enterprise`, `/admin` are distinct security domains. | Keep all existing routes and aliases. Decide new UI route placement before phase 3/4; do not relabel a security domain merely to match prototype navigation. |
| Styling | Tailwind 4 is installed; most app styling is `app/globals.css` plus inline styles. Phase 1 established Version 3 tokens and Rounded icons; current shell geometry remains 286px/76px until phase 3. | Phase 2 adds `app/v3-primitives.css` after the base stylesheet. Screen-specific inline styles remain to migrate when each screen is approved. |
| Shared UI | `components/ui/V3Primitives.tsx` now provides the Version 3 family; older `PlatformPrimitives`, `IconButton`, settings primitives, `Breadcrumbs`, `WorkspaceSwitcher` and `BrandMark` still serve existing screens. | Adopt the new family during screen phases, replacing duplicates at the call site after route and access regressions. Do not swap admin/auth/linked components wholesale without their phase gates. |
| Vault data | `components/records/UniversalRecordWorkspace.tsx`, `components/sections/SectionWorkspace.tsx`, `components/assets/DynamicAssetForm.tsx`, canonical asset helpers in `lib/assets/`, `lib/dashboard/summary.ts`, `lib/canonicalPersistence.ts`. | Reuse loaders/savers. Reconcile canonical `assets`/`records` with older `section_entries` and legacy detail tables before changing visual navigation or counts. |
| People/access | `/contacts` → `ContactsNetworkWorkspace`; `/access` and `/access-requests` → `AccessRequestsWorkspace`; `ViewerAccessContext`, `viewerAccess.ts`, contact/invitation services, `account_access_grants`, scoped RLS migrations. | Role, relationship, invitation, verification and record permission remain separate. Design drawer is a new presentation of existing concepts, subject to permission-model decision in QUESTIONS.md. |
| Identity/estate | `/invite/accept`, `/pending-invitations`, `/identity/verify`, `/estate/report-death`, `/admin/verification`, `/admin/probate`; API routes and services in `lib/identity-verification/`, `lib/estate-lifecycle/`. | Current IDV UI is explicitly a synthetic local/UAT simulator. Camera, selfie/liveness, QR hand-off, retention copy and provider claims require separate approved provider/security contracts. Estate access must remain separately reviewed. |
| Tests | `playwright.config.ts` has desktop Chromium, mobile Safari and mobile Chrome projects; Node tests under `tests/`; scripts in `package.json` include lint, build, `npm test`, `test:core`, `test:stabilisation`, `test:e2e`, `release:check`. | Use focused checks first, then phase gates; save 1440×900 and 390×844 screenshots under `test-results/design/` when implementation begins. Shared synthetic-account E2E suites run serially. |

## Core screen mapping — redesign board 2a/2b/2c

| Design screen/state | Existing route and main component | Status | Backend | Main discrepancy |
| --- | --- | --- | --- | --- |
| 2a Dashboard | `/dashboard` → `app/(app)/dashboard/page.tsx`, `DashboardAssetSummaryCard`, `ActionQueuePanel` | partial | yes | Dense current dashboard, different header/stats/tiles; legal count discrepancy in README needs a canonical count check. |
| 2a Add to my Fortress | No dedicated route; add actions/forms live in dashboard, category pages, `AssetCreateModal` and `UniversalRecordWorkspace` | missing | yes | Four-group destination page and mobile add sheet are absent. |
| 2a Action Centre | `ActionQueuePanel` inside `/dashboard`; workflow model in `lib/workflow/blockingModel.ts` | partial | yes | No dedicated route/list with status chips and secondary row actions. |
| 2a Finances | `/finances` → overview page, five `/finances/*` pages, `UniversalRecordWorkspace` | partial | yes | Category tiles and section pages differ from shared area template/stats/empty tiles. |
| 2a Legal | `/legal` → overview; `/legal/[category]`, `/identity-documents`, `/personal/wishes` | partial | yes | Category layout and some category names differ; protect legal document linkage. |
| 2a Property | `/property` → overview; `/vault/property`, `/property/documents` | partial | yes | Shared area template absent. |
| 2a Business | `/business` → overview and interests; `/employment` | partial | yes | Area and first section share `/business`; hierarchy needs a route decision. |
| 2a Digital | `/vault/digital` → overview; `/vault/digital/records`, `/personal/social-media`, `/personal/subscriptions` | partial | yes | Design has six sections; current routing and category model differ. |
| 2a Possessions | `/vault/personal` → overview; `/cars-transport`, `/vault/personal/records` | partial | yes | Design categories and current Personal/Cars routes need mapping without moving data. |
| 2a Section page (populated/empty) | `/finances/*`, `/legal/[category]`, `/vault/property`, `/employment`, `UniversalRecordWorkspace` / `SectionWorkspace` | partial | yes | Existing add/edit often occurs inline; consistent Area › Section breadcrumb/empty state absent. |
| 2a Record page | `/vault/[section]/[id]`, `UniversalRecordWorkspace` detail/attachment UI | partial | unclear | Generic detail route uses some legacy tables; design Details/Documents/Shared with hierarchy needs canonical record mapping and scoped access proof. |
| 2a People I Trust | `/contacts` → `ContactsNetworkWorkspace`; aliases `/trusted-contacts`, `/executors`, `/family` | partial | yes | Current grouped contacts/search/invites exist; design list, icon actions and stage chips differ. |
| 2a Person detail drawer | `/contacts?contact=…` and expanded contact management in `ContactsNetworkWorkspace` | partial | yes | 448px drawer, scrim and timeline absent. |
| 2a Person access drawer | Contact permission controls in `ContactsNetworkWorkspace` and canonical invitation/grant services | partial | unclear | Record checkbox/save draft design differs from current category plus view/edit model and high-risk step-up rules. |
| 2a Access Requests | `/access-requests` → `AccessRequestsWorkspace`; canonical `/access` shares component | partial | yes | Designed explainer/cards/empty state differ; `/access` also hosts estate/access operations. |
| 2a Support | `/support` → `SupportWorkspace` | partial | yes | Guided local answer list and persisted support request exist; design chat bubble/forms differ. “Send request” currently saves to `section_entries`, so delivery wording must remain accurate. |
| 2a Settings | `/profile` → profile/settings primitives and `/account/*`; `/settings` redirects to `/profile` | partial | yes | Current cards/forms differ from grouped settings list. |
| 2a My Vault | `/account/my-vault` → `MyVaultPage`, `VaultPreferencesContext` | partial | yes | Checkboxes instead of switches; design 9-area taxonomy does not match six-area sidebar. |
| 2b iPhone Home/value/next step | Responsive `/dashboard` and existing mobile drawer | partial | yes | No floating 4-tab bar, value card, single-step carousel or native-style grouped lists. |
| 2b mobile area/add/people/requests | Existing responsive area routes, `/contacts`, `/access-requests` | partial | yes | Push/back and sheet model absent; current navigation is a hamburger tree. |
| 2b mobile notifications | No notifications page/sheet found | missing | unclear | Event-only bell sheet and read state need a data contract. |
| 2c design language | `app/globals.css`, `Icon`, UI primitives | partial | yes | Tokens, rounded icon font, type scale, radii, 264px sidebar and 60px header differ. |
| Finances Review 1a critique | `/finances` plus current shell | partial | yes | Rationale for typography, category rows, duplicated chrome and unlabeled security state; 2a is the final target. |
| Finances Review 1b desktop | `/finances`, `app/(app)/layout.tsx` | partial | yes | Earlier 1280px finance reference; use final 2a sizes and hierarchy. |
| Finances Review 1c iOS | Responsive `/finances`, mobile drawer | partial | yes | Inset list and large-title rationale; final mobile target is 2b. |
| Finances Review 1d Android | Responsive `/finances`, mobile drawer | partial | yes | Material 3 app bar/FAB/nav rationale; no dedicated Android UI yet. |

## Journey mapping — every approved badge

| ID and designed state | Existing route/component or nearest seam | Status | Backend |
| --- | --- | --- | --- |
| 1a Switcher open | `WorkspaceSwitcher` in `app/(app)/layout.tsx` | partial | yes |
| 1b Linked permitted + locked overview | `/contact-wallet`, `ViewerAccessContext`, `viewerAccess.ts` | partial | yes |
| 1c Zero-access linked state | `/contact-wallet`, protected shell/`PlatformRestrictedState` | partial | yes |
| 1d Mobile switcher sheet | Mobile drawer + `WorkspaceSwitcher` | partial | yes |
| 2a Invitation email | `sendContactInvite`, Supabase OTP/invitation events | partial | unclear |
| 2b Invitation landing | `/invite/accept` → `InvitationAcceptPageClient` | partial | yes |
| 2c Sign in/create with invitation context | `/sign-in`, `/sign-up`, `PublicAuthEntry`/forms, invite redirect | partial | yes |
| 2d Verification hand-off | `/invite/accept` → `/identity/verify` | partial | yes |
| 2e Linked confirmation | `/invite/accept`, `/contact-wallet` | partial | yes |
| 2f Own Vault first run | `/onboarding`, `/dashboard`, `/pending-invitations` | partial | yes |
| 2g Desktop 520px flow | `/invite/accept` auth shell | partial | yes |
| 3a Consent | `/identity/verify` and IDV start API consent gate | partial | yes |
| 3b Choose document | `/identity/verify` document type control | partial | yes |
| 3c Document camera capture | IDV page/API synthetic document action | missing | no |
| 3d Review/retake capture | IDV page/API synthetic action | missing | no |
| 3e Live selfie/liveness camera | IDV page/API synthetic camera challenge | missing | no |
| 3f Checking progress | IDV request/decision states | partial | yes |
| 3g Failure/retry/help | IDV error/scenario states | partial | yes |
| 3h Verified result | IDV decision and assurance state | partial | yes |
| 3i Desktop QR-to-phone hand-off | No hand-off route/service found | missing | no |
| 4a Desktop Basics/Details wizard | `/finances/bank`, `UniversalRecordWorkspace`, asset fields | partial | yes |
| 4b Document step/upload states | `UniversalRecordWorkspace`, `AttachmentGallery`, storage helpers | partial | yes |
| 4c Mobile wizard/sticky footer | Responsive shared record forms | partial | yes |
| 4d Per-record-type step map | `workspaceCategoryConfig`, `fieldDictionary`, form controls | partial | yes |
| 5a Owner record detail/tabs | `/vault/[section]/[id]`, shared record detail/attachments | partial | unclear |
| 5b Linked permitted detail | Viewer filtering + `/contact-wallet` | partial | yes |
| 5c Fully locked mobile detail | Access guard/restricted state | partial | yes |
| 6a Executor role explainer | `/contact-wallet`, `/executors` | partial | yes |
| 6b Death report/evidence | `/estate/report-death` + `/api/estate/death-reports*` | partial | yes |
| 6c Desktop estate tracker | Estate claim APIs, `/admin/probate`, no claimant tracker found | missing | unclear |
| 6d Mobile estate tracker | Same estate service, no claimant mobile tracker found | missing | unclear |
| 7a Bell popover | No event notification component found | missing | unclear |
| 7b Full notifications/detail | No notifications route found | missing | unclear |
| 7c Empty notifications | No notifications route found | missing | unclear |
| 8a Search dropdown | Shell search field submits to dashboard search | partial | yes |
| 8b Results/no-results | `/dashboard?search=…`, `lib/records/discovery.ts` | partial | yes |
| 8c Mobile full-screen search | Mobile shell search/drawer only | missing | yes |
| 9a Sign in/error | `/sign-in`, `SignInForm` | partial | yes |
| 9b Six-box two-step code | Auth/session flows, no matching OTP code screen found | missing | unclear |
| 9c Recovery/check email | `/forgot-password`, `/reset-password`, `ResetPasswordPage` | partial | yes |
| 10a Organisation overview/team | `/enterprise` → `EnterpriseOperationsWorkspace`, organisation detail routes | partial | yes |
| 10b Personal/Work switcher | `WorkspaceSwitcher` | partial | yes |
| 11a Admin overview/probate queue | `/admin` → `AdminControlPlaneWorkspace`, `/admin/probate` | partial | yes |
| 11b Audit log | `/admin/audit`, admin workspace/API | partial | yes |
| 12a Banners/toasts | `PlatformNotice`, status notes and local page banners | partial | yes |
| 12b Expired/denied/unavailable | `/admin/access-denied`, invitation errors, `app/not-found.tsx` | partial | unclear |

## Completed function and design discrepancy summary

Existing, subject to local regression proof: authenticated customer shell; canonical assets/records and attachments; finance, legal, property, business, digital and personal sections; contacts, invitations and linked grants; scoped viewer access and RLS; identity request/assurance workflow with synthetic local provider; estate death reports, evidence, protective lock and probate/admin review; enterprise and admin shells; profile/My Vault preferences; support request persistence; dashboard search. The current repository has focused tests for many of these, but this planning pass did not run authenticated suites.

Largest UI gaps: dedicated Add and Action Centre pages; common area/section/record hierarchy; Person drawer; Version 3 mobile tab/sheet patterns; event notifications; search dropdown/full-screen mobile search; invitation stepper/first-run; camera/QR IDV; claimant estate tracker; central alerts. Screen-level inline styles and older icon usages still differ from the new foundation. Prototype data, example names, dates, amounts, stage counts, 30-day retention statement and organisation/admin numbers must never be copied as live values.

## Implementation phases and checkpoints

| Phase | Smallest safe deliverable | Gate before next phase |
| --- | --- | --- |
| 0 | Screen/route/backend map, decisions and local browser readiness | Completed; owner conditionally approved phase 1. |
| 1 | Tokens, system font and rounded icon foundation; preserve accessibility settings | Completed and pushed as `design/phase-1`. |
| 2 | Shared Icon/Button/Chip/Row/Card/PageHeader/Breadcrumb, switches, sheets, banners, toast, empty/locked/context/step/timeline primitives | Completed in isolated `design/phase-2`; evidence below. Await owner review before phase 3. |
| 3 | Customer shell: sidebar/header/search affordance, workspace switcher, nested back navigation, mobile tab bar | Owner/linked/enterprise navigation and route-security regressions. |
| 4 | Core desktop and mobile screens from 2a/2b: dashboard, Add, Action Centre, six vault areas/sections/records, People, Access Requests, Support, Settings/My Vault | Canonical counts/persistence/reload checks and desktop/mobile visual review. |
| 5 | Journey 1 linked Fortresses | Cross-user negative access, no locked name/value leakage, RLS check. |
| 6 | Journey 2 invitations | Local synthetic email/accept/decline/expiry/wrong-account/reload; acceptance alone leaves protected access locked. |
| 7 | Journey 3 IDV | Implement only provider-approved capabilities; keep simulator clearly labelled. Consent, assurance, replay, liveness and retention gates. Real biometric UI requires separate decision. |
| 8 | Journey 4 add/edit forms | Canonical save, draft, upload and immutable document/version constraints; no password/PIN capture. |
| 9 | Journey 5 record detail | Owner/linked/locked views, direct URL and document download scope tests. |
| 10 | Journey 6 executor/death | Level 3 step-up, protective lock, evidence, separate admin authority decision and immutable originals. |
| 11 | Journey 7 notifications | Event contract/read state and privacy-scoped delivery before UI. |
| 12 | Journey 8 search | Scope-aware results and no cross-vault leaks; mobile search. |
| 13 | Journey 9 auth | Reskin only; preserve Supabase session, recovery and redirect controls. |
| 14 | Journey 10 professional workspace | Tenant/capability isolation and no sponsor access to vault contents. |
| 15 | Journey 11 admin | Admin-only aggregate/queue/audit surfaces; no customer content route. |
| 16 | Journey 12 alerts | Shared banners/toasts/full-page errors with safe retry semantics. |
| 17 | Full consistency/accessibility/security audit | 1440×900 + 390×844 comparison, lint/typecheck/unit/Playwright, deviations and owner review. |

Each future phase is a separate owner checkpoint as required by the master prompt. Prefer targeted tests, then `npm run lint`, `npx tsc --noEmit --pretty false`, `npm test`, `npm run build`, focused Playwright and `npm run release:check` when relevant. Record approved differences in `docs/design-implementation/DEVIATIONS.md` during implementation. Phases 1–2 use isolated worktrees; the owner working tree is left intact. Do not deploy or change hosted services.

## Phase 1 implementation and proof

- Consolidated the foundation in the existing `app/globals.css` root tokens: Version 3 colour, spacing, radius, shadow and type values, plus aliases for existing components. The system font stack and 15/22 body rhythm apply at the root. The current 286px sidebar, 76px header and 1180px content width stay in place until the Phase 3 shell review, avoiding an unapproved layout change.
- Replaced the active Outlined icon font with a genuine locally served Rounded WOFF2; updated the shared `Icon` defaults and the one direct admin icon use. Source commit, Apache 2.0 license and SHA-256 are recorded in `FONT_SOURCE.md`. Added the reusable nine-dot `BrandGlyph`; replacing existing `BrandMark` across screens awaits Q19.
- Chrome/Playwright captured the source [desktop reference](screenshots/v3-reference-desktop-1440x900.png), [390×844 mobile viewport reference](screenshots/v3-reference-mobile-390x844.png) and [full mobile phone board](screenshots/v3-reference-mobile-phone.png). The viewport capture shows the fixed-width prototype board clipped at its edge; the full phone board preserves its intended design for comparison. Separate [desktop](screenshots/v3-foundation-desktop-1440x900.png) and [mobile](screenshots/v3-foundation-mobile-390x844.png) screenshots show an isolated harness using the actual CSS/font. These are foundation previews, not authenticated app screenshots. The reproducible harness is `scripts/verify-v3-foundation.mjs`.
- The browser harness passed Chrome and WebKit at 1440×900 and 390×844, including font load, computed tokens, mobile canvas, no horizontal overflow, high contrast and large-text settings. Focused dashboard/header tests passed 8/8, admin foundation tests 9/9, `npm run test:stabilisation` passed, TypeScript passed, lint passed with pre-existing warnings, and the production build completed. `npm test` still fails at a baseline `supabase/config.toml` local URL assertion; that config is outside this phase and differs in the owner's dirty tree. A separate admin shell test fails on an untouched enterprise-navigation source assertion. Neither failure is caused by the token/icon diff.
- Local Supabase auth health at `127.0.0.1:55421` is unreachable because the configured Colima Docker socket is unavailable. The committed base branch's `supabase/config.toml` also sets a hosted `site_url`; the owner working tree has an uncommitted local URL correction. That mismatch explains the core-test assertion failure and must be resolved through the approved local setup before authentication testing. The running process on `127.0.0.1:3012` could not be proved isolated from hosted services, so authenticated browser tests were not run. Start/verify the local stack and app runtime target before owner, linked, invitation, access-control or IDV testing. No hosted environment was touched.

## Phase 2 implementation and proof

- Verified remote `design/phase-1` at `b1a24d8` with `a4b4498` in its history, then based isolated `design/phase-2` on that commit. The owner working tree and three untracked tests were not touched.
- Added the shared Version 3 `Icon`, `Button`, `IconTile`, `Chip`, `Row`, `Card`, `PageHeader`, `Breadcrumb`, `Switch`, `Sheet`, `Banner`, `Toast`, `EmptyState`, `RestrictedState`, `ContextBanner`, `ContextSwitcher`, `Stepper` and `Timeline` foundation. Rounded icons, token colours/sizes and one component stylesheet are used. `Sheet` supports Escape, focus trap and return focus; mobile ContextSwitcher opens a real sheet. These are presentational components; no route, permission, authentication, data or estate policy was changed.
- [PHASE2_COMPARISON.md](PHASE2_COMPARISON.md) pairs actual Version 3 Chrome reference captures with desktop/mobile component screenshots. The reproducible browser script renders the real TSX and CSS and exercises hydrated interactions in Chrome and WebKit at 1440×900 and 390×844. It checked 44px mobile targets, focus rings, keyboard activation, sheet trapping/dismissal, context selection, contrast, large text, high contrast, comfortable spacing and no overflow. The fixture uses synthetic labels and does not exercise authenticated app routes.
- `npm run test:stabilisation` passed 81/81; focused header/dashboard/admin-prototype tests passed 9/9; admin foundation tests passed 9/9; TypeScript, lint and build passed. Lint has 18 existing warnings. `npm run test:core` remains blocked by the unchanged base `supabase/config.toml` hosted `site_url` versus the expected local URL; report this separately from passing suites.
- `colima status` reports not running, Docker cannot find the Colima socket, `supabase status` cannot inspect container health, and `127.0.0.1:55421/auth/v1/health` refuses connections. A process listening on `127.0.0.1:3012` did not respond to a short health probe. No authenticated browser or database tests were run, and no hosted target was substituted.

## Browser-testing readiness and isolation

- Installed Google Chrome launched successfully through Playwright and rendered the desktop redesign, journey board and Finances review locally. `@playwright/test` is 1.58.2; bundled Chromium and WebKit executables are present. The selected Chrome reference and foundation screenshots are included above for owner review.
- An existing process listens at `http://127.0.0.1:3012`, but its isolation and responsive health could not be established during Phase 1; do not use it for authenticated testing yet. `playwright.config.ts` defaults to port 3000 **unless** `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012` is set, so every future browser command must set that variable. Set explicit 1440×900 and 390×844 contexts; exercise desktop Chromium, mobile Chrome and mobile Safari/WebKit. Use Chrome's installed channel when reviewing the HTML reference.
- The approved local `.env.phase1.local` names were inspected without printing values; URL host checks passed for `BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` (port 55421) and `SUPABASE_DB_URL`. These checks do not prove the already-running app's live environment. Local Supabase health at `127.0.0.1:55421` is currently **unreachable**, so no auth/database or invitation/IDV browser test was run. Before those tests, start the local stack through the established local procedure, verify the local app/runtime target and health, use only synthetic accounts/files and run account-mutating suites serially.
- Browser matrix after readiness: owner desktop/mobile; linked viewer with granted/zero/revoked scope; invitation new/existing/wrong account/expired; synthetic IDV consent/success/failure/replay/step-up; estate reporter vs reviewer; admin/enterprise isolation. Capture screenshots at the master-prompt sizes and test direct URL/API denials, reload and fresh-session persistence. Never run these against production or hosted staging in this plan.

## Invariants and exact next checkpoint

Keep Supabase authentication/session flow, server and RLS enforcement, record-level permission boundaries, invitation/identity gating, audit events, signed document access, Death Lock/probate restrictions, estate immutability and linked-Fortress isolation. UI controls must reflect server decisions and never become their source of truth. Existing owner modifications and the three untracked test files (`tests/e2e/local-uat-review-access.spec.ts`, `tests/local-uat-review-access-doc.test.mjs`, `tests/staging-release-dispatch.test.mjs`) remain untouched. Production and hosted staging are out of scope; releases remain under the owner's Mac Terminal process.

**Checkpoint:** owner reviews the Phase 2 branch, comparison images, test limits and `QUESTIONS.md`, then explicitly approves or revises Phase 3 customer-shell work. Resolve or constrain Q1 (Add/Action routes), Q2 (sidebar taxonomy) and Q19 (brand placement) before adopting their corresponding shell elements. Before authenticated navigation and access tests, prove the local Supabase/Colima stack, local `site_url` and app runtime isolation. No Phase 3 implementation or staging deployment is authorised by this document.
