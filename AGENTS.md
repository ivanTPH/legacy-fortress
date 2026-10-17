# Legacy Fortress Agent Guide

Legacy Fortress is a Next.js/Supabase estate-record vault for customer records, documents, contacts, executors, linked access, and partial admin/probate operations.

## Safety Boundary

- Local review URL: `http://127.0.0.1:3012`
- Production URL: `https://legacy-fortress.vercel.app`
- Production is read-only and out of scope for Codex sessions unless the user explicitly approves a separate production task.
- Never deploy, mutate hosted Supabase/Vercel/Stripe, send real email/SMS/payment events, run destructive migrations, or use real user/customer data without explicit approval.
- If local/production isolation cannot be proven, stop and report the uncertainty.

## Pre-Work Checks

Before meaningful work, run targeted checks:

- `pwd`
- `git branch --show-current`
- `git status --short`
- inspect relevant env names only, never values
- confirm browser testing targets `127.0.0.1:3012`
- confirm Supabase targets local `127.0.0.1:55421` before auth/database testing

## Commands

Use commands that exist in `package.json`:

- Local app: `PORT=3012 npm run dev` after loading the approved local env file
- Lint: `npm run lint`
- Build: `npm run build`
- Core tests: `npm run test:core`
- Stabilisation tests: `npm run test:stabilisation`
- E2E tests: `npm run test:e2e`
- Release check: `npm run release:check`

Prefer targeted tests before full suites.

## Working Style

- Preserve uncommitted work; do not revert or overwrite dirty files unless explicitly requested.
- Make small, targeted changes that follow existing shared components and canonical services.
- Use `rg` and `git diff` rather than rereading the whole repository.
- Read `docs/CODEX_HANDOVER.md` when continuing prior work.
- Read `docs/AI_PROJECT_STATE.md` only when broader architecture context is needed.
- Update `docs/CODEX_HANDOVER.md` after substantial work.
- Keep secrets out of source, logs, reports, screenshots, and commits.

## Design authority

- Use [`docs/design-implementation/DESIGN_SOURCE_OF_TRUTH.md`](docs/design-implementation/DESIGN_SOURCE_OF_TRUTH.md) as the concise index to the complete [`design_handoff_legacy_fortress 5/`](design_handoff_legacy_fortress%205/) handoff. It supersedes older V4/V3 visual guidance where they conflict. Retain [`docs/design-implementation/V4_CANONICAL.md`](docs/design-implementation/V4_CANONICAL.md), the V4 mobile supplement, [`design_handoff_legacy_fortress 4/`](design_handoff_legacy_fortress%204/) and [`design_update_v4/`](design_update_v4/) as design history.
- Preserve the project, security, database and release instructions above. Brand Guardian guidance in [`design/brand-guardian/DESIGN_AUTHORITY.md`](design/brand-guardian/DESIGN_AUTHORITY.md) and [`design/brand-guardian/BRAND_APPLICATION_GUIDE.md`](design/brand-guardian/BRAND_APPLICATION_GUIDE.md) applies where consistent with V5. Existing enterprise, admin, probate and linked-access boundaries remain in force until explicitly approved changes are implemented and verified.
- Every UI change should identify its V5 source screen/state, use shared tokens and components, preserve canonical data and security behaviour, check relevant desktop and mobile states, and run `npm run design:check` plus focused tests when relevant. Record a concrete browser blocker if rendering cannot be checked.

## V4 UI rules 11–15

11. The round `add` button is the only Add asset control. An outlined `note_add` action on an asset row is the Add document control. Do not add page-level document or picture actions.
12. Interactive surfaces use one state set: hover `#F6EFEA`, pressed `#EBE0D8`, selected white with a ring, visible focus ring `#8C4A32`. Animate background only for 120 ms; respect reduced motion.
13. Record forms put required fields first with “Required” tags. Put optional fields in collapsed groups where supported, use at most two columns, a custom dropdown chevron with 12 px right padding, and one Cancel action. Preserve backend-required fields and validation.
14. Connected, Identity verified, and Access granted are separate states. Only an explicit saved record selection grants record access; invitation acceptance or verification never does.
15. When the design is unclear or current data or services cannot support it, ask before inventing behaviour and log the concrete question in [`docs/design-implementation/QUESTIONS.md`](docs/design-implementation/QUESTIONS.md).

## V4.1 / V5 UI rules

16. The owner has approved three separate security entry points: Personal Vault, Platform Administration and Partner Portal. Ordinary users must not cross these domains through a workspace switcher. Customer switching is limited to Personal and authorised linked Vault contexts. Separate staff/partner authentication and any TEST-only master-owner exception require a separately approved, server-enforced and audited security implementation. Do not consolidate Admin, Enterprise or Probate routes, alter authentication, or change roles during visual work.
17. For admin and partner visual work, use the shared page pattern in `ADMIN_PARTNER.md`: breadcrumb, title, short description, one primary action and a suitable table or empty state. Keep existing capability checks. Show a confirmation and require an audited reason for risky actions only where the existing service supports it; otherwise raise a decision.
18. Use the wording, Material Symbols Rounded names and interaction states in V5 `CONSISTENCY.md` across customer, admin and partner presentation. Keep existing security and user-facing behavior intact.
19. Apply `CONSISTENCY.md` mobile layouts to admin and partner screens, including bounded rows, full-screen panels, safe-area clearance and role-authorised navigation.
20. Use V5 `MOBILE_V4.1.md` for Personal Vault mobile where it conflicts with the retained V4 mobile supplement. Preserve real authorised data, accessible focus and existing routes.

## Incremental delivery

Implement one approved stage at a time from the latest confirmed staging code: Personal Vault mobile; People & Access and mobile forms; Platform Admin mobile; Partner Portal mobile; then desktop consistency and separately approved architecture changes. Commit and push focused work, deploy to TEST only with owner authorisation through the protected process, verify the live SHA and hosted acceptance, and wait for owner visual review before the next stage.
