# Legacy Fortress — Build and Release Notes

Status: this file is intentionally conservative. The latest Codex report pasted into chat did not include a fresh repo-truth build/deploy inventory, so only confirmed guidance is recorded here.

## Confirmed build/release position from the latest pass
- final status reported: `NOT FIXED`
- no claim should be made yet that the application is production-stable

## Confirmed documentation gap
The following still need a direct repo audit before this file can be treated as authoritative:
- exact local run commands
- exact test commands
- exact build command
- env file expectations
- deployment file inventory
- CI or hosting-specific sensitivities

## Interim operating rules
Until a direct repo build audit is completed:
- do not assume a route works because a component was updated
- do not assume attachment-system improvements mean the whole app is release-ready
- require explicit checks on create, edit, preview, remove, and persistence behaviour in both canonical and legacy flows
- require verification for dashboard consistency and cross-page record consistency

## Minimum release gate checklist
Before any production release is described as stable, confirm all of the following in the real repo:
1. local dev start command works
2. production build command works
3. core routes load
4. canonical record create/edit/delete flows work
5. legacy section flows still work after shared attachment integration
6. attachment preview/download/remove works on supported file types
7. dashboard counts match persisted data
8. contact/invitation flows do not create contradictory records

## Rules for future prompts
- Ask Codex to report exact commands and files, not generic build statements.
- Require “Exact files changed” and “Whether build passes” in every implementation report.
- Do not mark work complete unless both functional behaviour and build behaviour are explicitly verified.
- When a prompt changes shared architecture, require regression checks on both canonical and legacy pages.
