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

## Privacy/security release gates — added 20 August 2026
Production release must not be described as ready until all applicable checks pass:
1. staging environment positively identified before hosted mutations
2. protected invitee access is blocked until required identity verification succeeds
3. role/permission enforcement is proven at API/database/RLS level
4. biometric recognition DPIA and lawful-basis/special-category condition are approved before production processing
5. privacy notice/T&C/consent versions reflect actual processing
6. partner tenant isolation and data minimisation are tested
7. SAR/rectification/erasure/restriction/portability/objection administration works on persisted data
8. retention/deletion/anonymisation controls and audit evidence are tested
9. document originals cannot be silently overwritten by third parties
10. estate-access approval does not enable deletion/overwrite of historical originals
11. audit events exist for material access, sharing, permission, identity, estate, privacy-rights and disposal actions
## Additional security release gates — approved 20 August 2026
12. high-risk permission changes require the configured step-up identity level server-side
13. internal/UAT identity verifications are clearly segregated from production-grade assurance and cannot silently activate production protected access
14. death reporting can enter `PROTECTIVE_LOCK` without granting estate access
15. confirmed death/estate transition produces an immutable `ESTATE_LOCKED` historical vault
16. post-death additions are stored separately with provenance and cannot rewrite deceased-owner history
17. compromised estate representative access can be suspended/revoked while the deceased vault remains locked
18. false/malicious death-report recovery requires high-assurance owner re-verification and dual authorised approval
19. envelope/key-management implementation, key separation and recovery-material coverage are security-reviewed before production claims are made
20. partner communications enforce purpose, channel, frequency, objection and suppression rules and do not expose unrestricted identity lists where closed-loop delivery is intended
21. production biometric/IDV provider and model licences/assurance have been formally approved before production activation

## Hosted staging source of truth — updated 20 August 2026

The current hosted staging path is Coolify/custom-domain based:

- Staging app: `https://test.mylegacyfortress.com`
- Staging app label recorded in prior audit: `Legacy Fortress Staging`
- Staging Supabase/API origin: `https://supabase-test.mylegacyfortress.com`
- Current read-only `/api/version` evidence: commit `42f67238dae3721c1b2d181f01caddbcfb0abe02`

Older README/Vercel Preview notes are historical for the current staging gate. Do not pull Vercel Production or Preview environment variables for Phase 1 hosted UAT unless the owner explicitly re-verifies Vercel as the active staging system.

The approved recovery path is:

1. Restore `COOLIFY_BASE_URL` and `COOLIFY_API_TOKEN` through the operator's secure local mechanism.
2. Verify the Coolify application is `Legacy Fortress Staging`, uses `test.mylegacyfortress.com`, and is deployed from `hosted-uat-preparation-20260715` at the expected SHA.
3. Restore ignored `.env.staging.local` from Coolify/operator secret records with staging-only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `NEXT_PUBLIC_APP_URL`, `BASE_URL` and `PLAYWRIGHT_BASE_URL`.
4. Confirm `NEXT_PUBLIC_SUPABASE_URL` resolves to `https://supabase-test.mylegacyfortress.com` only after operator metadata proves it is the staging Supabase/API origin.
5. Run `npm run uat:validate` before hosted migration inspection or synthetic UAT.
