# Version 3 decisions for owner review

Status: **Phase 1 conditionally approved** (14 October 2026). This file distinguishes the authorised foundation work from later product directions. Add explicit owner answers under the open questions before their implementation phases.

## Approved Phase 1 decisions

- Establish the Version 3 palette, spacing, typography, radius and shadow tokens in the existing CSS architecture; use the specified system font stack.
- Bundle genuine Material Symbols Rounded locally after verifying Google's source and Apache 2.0 license. Keep accessibility settings and responsive behaviour working.
- Use an isolated worktree, preserve unrelated owner files, diagnose local Supabase, capture desktop/mobile design reference screenshots, run focused checks, and commit/push only verified Phase 1 files.
- Preserve routes, data operations, Supabase authentication, RLS, audit and estate/linked-access boundaries. Do not deploy staging or change production/hosted services.

## Provisional product directions

The proposals in Q1–Q17 remain useful design directions, **not approvals** for a route change, backend feature, identity provider, migration, permission policy or customer-facing claim. The phase approval did not supply written answers to those questions in this file. Version 3 references guide visual work only where they do not conflict with current security and operational policy.

## Decisions still requiring explicit owner approval

- Q1–Q17 require answers before the named later phases introduce the relevant product behaviour; Q5–Q9 and Q12 are especially security/identity/estate sensitive.
- Q19 is approved for the local Rounded icon font and a reusable nine-dot glyph. Replacing `BrandMark` across customer, auth or admin screens remains open.
- Any backend capability, identity-provider selection, data migration, production change or hosted release needs its own approval. Phase 1 does not grant it.

## Resolved precedence and safety facts

- Your instruction names `design_handoff_legacy_fortress 3/` as authoritative and says preserve root `AGENTS.md`; therefore the master prompt's older “rename handoff 2” and “append UI rules to root AGENTS.md” setup steps are superseded for this task. The Version 3 UI rules are read as design requirements without changing root guidance.
- Version 3 visuals supersede earlier design handoffs. Current `PROJECT_CONTEXT.md` and governance documents still require authentication, identity-gated access, RLS, audit, estate lock and privacy controls that a static prototype cannot override.
- The master prompt requests `design/phase-<n>` branches and small commits. Phase 1 uses an isolated `design/phase-1` worktree because the owner working tree contains unrelated changes, including three untracked test files. The release process remains owner-controlled in Mac Terminal.
- `Finances Review.dc.html` (1a–1d) is the rationale; `Legacy Fortress Redesign.dc.html` (2a/2b/2c) and `JOURNEYS.md` are the implementation visual target. Example names, dates, amounts, organisation figures, timings and retention text are placeholders.

## Decisions needed before or during implementation

### Q1 — Core navigation routes (before phase 3/4)

The design adds top-level “Add to my Fortress” and “Action Centre”, but the current app has no dedicated routes: add happens within dashboard/category forms and Action Centre lives in `ActionQueuePanel` on `/dashboard`. Which canonical paths should these use? Proposed: `/add` and `/actions`, keeping existing entry points as links.

**Owner answer:**

### Q2 — Vault taxonomy and visibility (before phase 4)

The sidebar prototype has six vault areas, while My Vault in the same prototype has nine areas (Legal, Finances, Personal, Digital, Tasks, Property, Business, Cars & Transport, Executors & Trustees). Current navigation and preferences also include Personal, Cars and Executors routes. Which taxonomy and visibility controls should customers see, and where do those extra areas appear in the redesigned sidebar/mobile navigation?

**Owner answer:**

### Q3 — Area › Section › Record route model (before phase 4)

The prototype assumes a uniform three-level route hierarchy. The current app uses `/finances/*`, `/legal/[category]`, `/vault/*`, `/employment`, and `/business` for both area and interests; some record detail paths read legacy tables rather than canonical records. May phase 4 add presentation routes/aliases while leaving persisted data and existing URLs intact? Which routes should be canonical for Business Interests, Digital subsections, Possessions categories and record details?

**Owner answer:**

### Q4 — Dashboard counts and money (before phase 4)

The README flags a current Dashboard/Legal Will count disagreement. The prototype's “4 records”, “£652,590.00” and “12 actions” are synthetic. Which canonical count/value rules should drive the new stats, including visibility filtering for linked users, excluded/archived records, debts and currencies? Proposed: audit `lib/dashboard/summary.ts` and area loaders with local synthetic fixtures before changing labels.

**Owner answer:**

### Q5 — People permission scope and capability (before phase 4/5)

The Person access drawer says “view only” and new records are not shared automatically. Current Contacts can grant category-level access and some edit permissions; approved product policy permits Professional Adviser document contribution in narrow cases. Should the drawer show the full existing permission model, or only a view-only subset with an advanced path? Any permission change still needs server-side policy and step-up checks.

**Owner answer:**

### Q6 — Locked-record disclosure (before phase 5)

Journey 1 shows “N records not shared with you”, while also saying names, values and section counts must remain hidden. Is showing a total count of withheld records within an otherwise visible area approved for a linked viewer? Proposed privacy default: show a generic locked row without a count unless the existing server policy explicitly permits that aggregate.

**Owner answer:**

### Q7 — Invitation sequence and email/SSO (before phase 6)

The design calls for a branded invitation email, locked/prefilled invite email, Apple/Google account creation, Decline on every step and an own-Vault first run. The current contact invitation accepts through `/invite/accept`, uses Supabase OTP delivery and routes to IDV, with auth screens that have their own behaviour. Which of these prototype steps and providers are approved for the current release? What should Decline do to persisted invitation/grant state and audit events?

**Owner answer:**

### Q8 — Identity provider and biometric screens (blocking phase 7)

The current `/identity/verify` page says **STAGING IDENTITY SIMULATOR** and submits synthetic document/camera actions. The Version 3 design shows real document camera, selfie/liveness, auto-capture, retry and QR phone hand-off. Is phase 7 intended to style the synthetic UAT flow only, or is a separately approved provider/capture integration planned? Real biometric processing needs the approved provider, privacy notice, Article 9 basis/DPIA, retention and manual-review controls. Do not show real-verification claims while only simulation exists.

**Owner answer:**

### Q9 — IDV copy, limits and retention (blocking phase 7)

The journey prototype says a partner deletes images after 30 days, “usually under a minute”, and “attempt x of 3”. These are not verified contracts in the current simulator. What approved provider-specific retention, duration and retry limits should appear? Proposed: omit unsupported numbers and use accurate simulator wording until a provider contract exists.

**Owner answer:**

### Q10 — Form drafts, autosave and upload policy (before phase 8)

Journey 4 promises “Draft saved hh:mm”, “Save & finish later”, 20 MB PDF/JPG/PNG uploads and a uniform four-step form. Current shared forms save through existing canonical handlers and some record/document types allow different formats; estate evidence is currently limited to 15 MB. Is persisted draft/autosave required for every record type, and should the 20 MB/format rule apply to vault records only? This may require backend/schema changes, which the master prompt says to ask about first.

**Owner answer:**

### Q11 — Owner and linked record detail (before phase 9)

The README shows Details/Documents/Shared with; Journey 5 adds Overview/Documents/History/Access tabs. Which is the final owner-detail layout? Which existing audit events should populate History, and what may a linked viewer see? Proposed: Journey 5 augments the simpler README detail design, with no History/Access tabs for linked viewers as specified.

**Owner answer:**

### Q12 — Executor reporter and claimant tracker (before phase 10)

`/estate/report-death` currently asks for an account-owner user ID and can upload evidence after report submission. The design instead starts from “My role” in a linked Fortress and shows a claimant-facing tracker. How should a claimant select the owner safely, and which estate/claim states and evidence requests may be shown before and after admin review? Keep the current Level 3, protective lock, probate authority and separate access approval requirements.

**Owner answer:**

### Q13 — Event notifications (before phase 11)

No canonical customer notification inbox/read-state route or API was found. Which events, delivery sources, retention, read state and deep links are approved? The core mobile design explicitly separates events from to-dos; the current Action Centre is a workflow queue. Proposed: do not populate bell UI with action tasks or fabricated events.

**Owner answer:**

### Q14 — Search scope and indexing (before phase 12)

Current header search submits to `/dashboard?search=…`; the design needs grouped dropdown, page route, mobile recent searches and active-Fortress scope. Should search include document titles or content, contact fields and linked-vault records? Where may recent queries be stored? Proposed: only server/RLS-visible metadata; avoid restricted names, counts and content in hints or history.

**Owner answer:**

### Q15 — Auth OTP and account recovery (before phase 13)

Journey 9 includes a six-box two-step code and resend countdown. The existing auth uses Supabase sessions, sign-in and password recovery. Which existing OTP/MFA challenge is this screen meant to represent, and should it be available to all users or only when a current challenge requires it? Proposed: style only an existing real challenge, with no new auth rule during a design pass.

**Owner answer:**

### Q16 — Professional/admin example data and capabilities (before phases 14–15)

Journeys 10–11 show organisation names, licence counts, service-health stats, probate queue and CSV export. Which real, permission-scoped API fields and capabilities are approved for those views? Some current admin/prototype pages are placeholders. Proposed: show “unavailable” where source data is absent, never synthetic values that appear operational, and keep admin out of customer vault content.

**Owner answer:**

### Q17 — Support assistant and request wording (before phase 4)

The README says “wire to the existing assistant” and “Send request”. `SupportWorkspace` currently provides guided canned answers and saves a request in `section_entries`; it does not prove a human delivery channel. Should the redesigned wording describe saved requests, or is an approved support-delivery service available? Proposed: preserve accurate current behaviour until a delivery contract exists.

**Owner answer:**

### Q18 — Working tree, branches and phase commits (before phase 1)

The master prompt asks for `design/phase-<n>` branches and per-component commits. The current branch is `hosted-uat-preparation-20260715` and the working tree contains unrelated modified/untracked owner work, including three untracked tests. Should implementation use a separate worktree/branch after preserving that state, or continue in place without commits until the owner has reviewed the dirty-file boundary? No existing changes will be reset, cleaned, overwritten or staged as part of this plan.

**Owner answer:** Approved for Phase 1: use an isolated worktree or equivalent safe process, and commit/push only verified in-scope files. The existing owner working tree is untouched.

### Q19 — Visual assets and fonts (before phase 1)

The design specifies Material Symbols Rounded, the black 9-dot `apps` logo and a system font stack. The app currently bundles Material Symbols Outlined and has `BrandMark` plus older `NavIcons`. Is bundling the Rounded font locally approved for consistent offline/local rendering, and should the existing brand mark be replaced in every customer/auth/admin context or only the customer shell? Proposed: bundle the icon font and map the logo per approved context without altering security indicators.

**Owner answer:** Approved for Phase 1: locally bundle genuine Material Symbols Rounded after source/license verification and implement the icon foundation. The scope for replacing existing `BrandMark` across customer, auth and admin contexts is still open; the nine-dot glyph can be built as a reusable foundation component.

## Browser readiness issue, not a design decision

Chrome, bundled Chromium and WebKit work for isolated visual tests. A process listens at `127.0.0.1:3012`, but its runtime isolation and responsive health were not established in Phase 1. Local Supabase at `127.0.0.1:55421` is currently down, so authenticated browser tests are pending. The local environment file's URL hosts were checked as local without printing values; the already-running app's runtime target must still be verified before any auth/database test. No hosted URL will be substituted for a missing local service.

**Next checkpoint:** review the Phase 1 commit and `PLAN.md`, then explicitly approve or revise **Phase 2**. Answer Q1–Q17 before the later phases that depend on them; decide remaining Q19 branding scope before replacing `BrandMark`.
