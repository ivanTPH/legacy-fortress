# Phase 4B Branch And Merge Strategy

Date: 2026-07-13

## Current State

- Current branch: `uat-remediation-preview`.
- Upstream: `origin/uat-remediation-preview`.
- Production branch from repo docs: `main`.
- Live Coolify branch: not proven from repo truth.

## Recommended Flow

1. Preserve the current branch and dirty tree.
2. Prepare controlled commits on `uat-remediation-preview` only after exclusions and secret review.
3. Push the UAT branch only after owner approval.
4. Deploy a separate Coolify UAT application from `uat-remediation-preview` without merging to `main`.
5. Open a pull request for review, but do not merge until hosted UAT passes and owner approval is explicit.
6. Periodically bring production changes into the UAT branch with a normal merge from `main`; do not rebase shared history without approval.
7. If production hotfixes happen during UAT, merge them into UAT and rerun gates.
8. Merge to production only as a separate controlled task with rollback and verification.

## Conflict Risk

High in `UniversalRecordWorkspace`, `app/globals.css`, docs, admin APIs and Supabase migrations because these files contain broad cross-phase work.
