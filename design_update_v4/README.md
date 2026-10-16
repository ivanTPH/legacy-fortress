# Legacy Fortress — V4 design update (update pack only)

Contents
- `V4_UPDATE.md` — spec: interaction rules, record form template, People & Access workspace
- `AGENTS.md` — full rules file with new rules 11–15 (replace the UI rules section in the repo's AGENTS.md)
- `design/People and Access V4.dc.html` — visual reference; open in Chrome or Safari (keep the other two files beside it)

## Install
1. Copy `V4_UPDATE.md` and `design/People and Access V4.dc.html` (plus `ios-frame.jsx`, `support.js`) into `design_handoff_legacy_fortress/` in the repo, keeping the `design/` folder.
2. In the repo's root AGENTS.md, replace the UI rules with the rules list from this AGENTS.md. Keep the repo's own project sections.
3. Run the prompt below in Codex from the repo root.

## Codex prompt
```
A V4 design update has been added: design_handoff_legacy_fortress/V4_UPDATE.md
and design/People and Access V4.dc.html. AGENTS.md now has rules 11–15.
V4 wins wherever it conflicts with older docs.

1. Read both files and open the HTML reference. Do not edit code yet.
2. Write docs/design-implementation/QUESTIONS.md entries for anything unclear
   or that the backend doesn't support (multiple roles per person,
   record-level grants, request records, audit events, required fields per
   record type). Stop and wait for my answers.
3. Then implement in this order, one PR each, stopping after each:
   A. Interaction rules: add controls, hover/pressed/selected/focus states
   B. Record form template and field maps for each record type
   C. People & Access: People tab, person panel, Give access, Add person,
      Requests, Sharing, Revoke — desktop and mobile
4. Keep Connected / Identity verified / Access granted separate. Never grant
   access except via an explicit Give access save. Don't change auth, schema
   or RLS without asking.
5. After each PR: lint, typecheck, tests, screenshots at 1440x900 and
   390x844, update PLAN.md, list files changed and any deviations.
```
