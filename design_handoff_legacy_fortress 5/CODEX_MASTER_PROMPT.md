# Codex master prompt — Legacy Fortress design implementation

Repo: /Users/ivan-imac/legacy-fortress-web
Paste everything inside the fence into Codex (CLI: run `codex` from the repo root; IDE/Cloud: open this repo).

```
You are implementing the Legacy Fortress redesign in this repo. Work in
phases, stop at every checkpoint, and ASK rather than guess.

## 0. Setup (do first, then stop and report)
- Rename the folder "design_handoff_legacy_fortress 2" to
  "design_handoff_legacy_fortress" (update nothing else).
- The repo already has AGENTS.md, PROJECT_CONTEXT.md and LEGACY_F*.md
  files. Read them all. Do NOT overwrite AGENTS.md. Append the
  "UI rules" section from design_handoff_legacy_fortress/AGENTS.md if
  present; if that file is missing, append the rules from the handoff
  README.md "Rules" section and tell me.
- Read the handoff README.md, JOURNEYS.md and PROMPTS.md fully.
- Open design/*.dc.html in a browser (npx playwright, or describe if you
  can't) to see the visual reference. Screen ids (e.g. 3g) match badges.
- Map the app: list routes (app/ or pages/), shared components
  (components/), styling approach, data layer (supabase/, lib/), and
  test setup (playwright.config.ts, tests/).
- Write docs/design-implementation/PLAN.md: a table of every design
  screen id → existing route/component → status (exists / partial /
  missing) → backend support (yes / no / unclear).
- Write docs/design-implementation/QUESTIONS.md with every point where
  the design, repo docs and code disagree or information is missing.
- STOP. Show me PLAN.md and QUESTIONS.md. Wait for my answers.

## Phases (one phase per session; stop after each)
1. Foundations: tokens (colour, type, spacing, radius, shadow), font,
   Material Symbols Rounded, logo (9-dot apps tile). No screen changes.
2. Shared components: Icon, Button (primary/secondary/text/icon-round),
   Chip (neutral/amber/green/red), Row, Card, PageHeader + Breadcrumb,
   mobile back bar, Sheet, Banner, Toast, EmptyState, ContextBanner,
   LockedRow, Stepper, StepRail, StatusTimeline.
3. App shell: sidebar, header (search, bell, avatar), mobile tab bar,
   Fortress switcher, back navigation on every sub-page.
4. Core screens from Legacy Fortress Redesign.dc.html (dashboard, each
   side-menu section, add/edit asset, People I Trust).
5-16. Journeys 1-12 from JOURNEYS.md, one per phase, in order.
17. Consistency audit: re-check every screen against the rules and fix.

## Rules for every phase
- Faithful to the design: match spacing, sizes, weights, colours, icons,
  copy and states shown. If you deviate, record why in
  docs/design-implementation/DEVIATIONS.md.
- Never change auth, data fetching, database schema, RLS or business
  rules without asking. If a screen needs data or behaviour the backend
  lacks, build the UI behind the existing data, note it in QUESTIONS.md
  and continue with the rest.
- Placeholder data in the designs (org names, admin numbers, timings)
  must not ship; use real data or ask.
- If you can't find something (a token, an icon, a route, a rule),
  add a numbered question to QUESTIONS.md and ask me before inventing it.
- Small commits, one per component or screen, on branch
  design/phase-<n>.

## Checkpoint at the end of each phase
- Run the repo's lint, typecheck, unit tests and Playwright tests.
- Add/update Playwright screenshots for changed screens at 1440x900
  and 390x844 in test-results/design/.
- Update PLAN.md statuses.
- Report: files changed, screens done, tests status, open questions,
  deviations. Then STOP and wait for "continue".
```

## Your replies to Codex
- After setup: answer QUESTIONS.md inline (write answers under each question), then say "continue to phase 1".
- Between phases: review screenshots in test-results/design/, then "continue" or list fixes.
- Review a phase: paste Prompt 12 from PROMPTS.md.
