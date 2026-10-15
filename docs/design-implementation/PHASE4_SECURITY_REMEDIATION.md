# Phase 4 Stage A security remediation and second clone rehearsal — 15 October 2026

**Checkpoint:** the discovered helper disclosure and invitation preview failure are corrected in a fresh disposable clone. The original local UAT database has **not** been migrated. Owner review and separate original-UAT approval are required before any UAT application or Phase 4 authenticated browser claim.

## Identity and restoration

- Base: `design/phase-4` report commit `954f5810a75de0290b16ffadbaf09dc6047416cb`; original owner worktree untouched. Source UAT is PostgreSQL 17.6 database `postgres` in `supabase_db_legacy-fortress-web-uat`, published at `127.0.0.1:55422`. The local API at `127.0.0.1:55421` still uses source `postgres` and was **not** used for clone authentication. The Phase 4 worktree's default CLI configuration targets a different local stack and was not used.
- Fresh rehearsal clone: `lf_phase4_rehearsal2_20261015` in that local PG17.6 cluster. After tightening the transient invitation guard during review, the **final exact-file replay** used another fresh disposable database, `lf_phase4_rehearsal3_20261015`. Both were created from `template0` and restored from the restricted outside-Git PG17.6 backup described in [the first rehearsal](PHASE4_CLONE_REHEARSAL.md). Backup SHA-256 rechecked: `2d28cf5a1c45f05ae1c7b38e442e3e1a5e91c0cf1d13a7d76bb2cae2989fb253`. The previously verified generated GraphQL wrapper ACL adjustment was needed again. Before migration, the final clone's ledger (38 entries), role count (30), auth/admin/wallet counts and wrapper hash matched source. The backup and scripts in `/private/tmp/lf-phase4-clone-rehearsal-20261014/` remain mode-restricted outside Git.
- The fresh clone reproduced both defects after the first ten files: anonymous and authenticated cross-user helper disclosure returned protected Level 2/vault state despite direct row RLS; valid invitation preview errored on nonexistent `public.profiles`. Test transactions rolled back.

## Root cause, callers and correction

| Function (exact signature) | Existing owner/grants and legitimate callers | Forward-only correction |
| --- | --- | --- |
| `public.lf_identity_assurance_level(uuid)` | `postgres`, `SECURITY DEFINER`, `search_path=public`; explicit `anon`, `authenticated`, `service_role` execute. Used by linked-grant predicates, invitation acceptance, presence fallback and estate claimant/participant checks. | Revoke both `PUBLIC` and explicit `anon`; allow only the same authenticated user or trusted `service_role` to obtain a level. Return `NULL` otherwise. |
| `public.lf_vault_lifecycle_state(uuid)` | Same owner/grants/settings. Used by linked and owner predicates, invitation acceptance, and service-role estate transition/reporting. | Return state only to the owner, a verified/active linked user meeting the stored grant's identity threshold, a token-consumed invitee **whose invitation row was updated in the current acceptance transaction** before its grant insert, or `service_role`; otherwise `NULL`. Revoked or unverified grants fail. |
| `public.lf_vault_allows_owner_mutation(uuid)` | Same owner/grants/settings. Used by owner asset, document, record, attachment, section and storage write policies. | Return a mutation decision only for the owner or `service_role`; otherwise `false`. Explicitly revoke `anon`. |

All three are still owned by `postgres` in the clone, retain authenticated and service-role execute for legitimate policy/RPC calls, and now have `search_path=''` with qualified object references. `lf_identity_presence_level(uuid)` was also guarded: its Level 3 branch otherwise bypassed the corrected assurance helper. The DB tests prove direct calls, RLS-mediated linked/owner access, and the invitation acceptance path. Application estate/retention readers now fail closed if an authorisation guard returns `NULL`, instead of interpreting it as an active state.

The invitation root cause was migration `20260820120000`, which reintroduced a join to absent `public.profiles`. The existing **forward** migration `20260824143000_phase6_contact_invitation_profile_reference.sql` replaces it with `user_profiles`; no historical SQL was rewritten or ledger entry fabricated. The smallest contiguous route to that fix is the first 18 pending files. The current repository also has three later access/IDV/probate files; reaching its supported schema requires all **21** historical pending files, then the two new corrective files below. An early out-of-order backport would create divergent deployment histories and was rejected.

The full later-migration scan found the same `REVOKE anon` but inherited `PUBLIC EXECUTE` pattern in consent, retention and recovery helpers. They could disclose another user's state by argument. A second small forward-only migration guards caller identity or service-role authority and removes anonymous execute; direct synthetic tests pass. Existing token-gated preview and owner-bound older functions were left intact. Seven other public-schema `SECURITY DEFINER` functions remain anonymously executable; review classified them as the intended token preview, authenticated-guarded invitation/owner functions, and trigger-only functions. No new disclosure was demonstrated, but this is not a general audit of every historic RPC.

## Exact sequence rehearsed

The clone started with 38 ledger entries through `20260717120000`. In repository order, it applied the ten exact files listed in [the first rehearsal](PHASE4_CLONE_REHEARSAL.md), then these eleven unchanged files, each with an observed successful ledger entry:

1. `20260822100000_phase3_death_lock_estate_lifecycle.sql`
2. `20260822103000_phase3_restrict_vault_transition_rpc.sql`
3. `20260822104500_phase3_estate_document_suspension_rls.sql`
4. `20260822110000_phase3_qualify_estate_document_policy_id.sql`
5. `20260822120000_phase4_estate_administration_control_plane.sql`
6. `20260822160000_phase5_privacy_encryption_partner_foundation.sql`
7. `20260824090000_phase6_auth_lifecycle_audit_fk.sql`
8. `20260824143000_phase6_contact_invitation_profile_reference.sql`
9. `20260828100000_access_operations_case_management.sql`
10. `20260830100000_phase7_idv_operational_workflow.sql`
11. `20260905120000_phase7_probate_quorum_completion.sql`

Then it applied `20261015120000_guard_identity_and_vault_state_rpcs.sql` and `20261015121000_guard_later_privacy_helpers.sql` in separate failure-on-error transactions. No repository migration was skipped, edited or backdated. The final clone replay used the **exact committed-candidate contents**, including a current-transaction-only invitation exception. Final clone ledger: **61 entries**, maximum `20261015121000`, hash `211777dddfd08a36dee58500292a9517`. The later migrations include expected RLS, storage, trigger and function changes; static review found no table drop, truncate or row delete. Two historical files include their own transaction commands, so a future UAT runner must verify ledger/object state after each file rather than assume an outer `psql -1` makes those files atomic.

## Runtime and source checks

- Rollback-wrapped [guard/RLS SQL](../../tests/database/phase4-guard-rls.sql): **11 checks pass** for anonymous denial, owner access, cross-user denial, pending and unverified linked denial, Level 2 assigned-only visibility, Level 3 presence preserving durable Level 2, wrong-user denial, revocation, protective estate lock, service-role access, and nonadmin enterprise/admin isolation. The script refuses source UAT before `BEGIN` with a nonzero exit.
- Rollback-wrapped [invitation SQL](../../tests/database/phase4-invitation-lifecycle.sql): **7 checks pass** for correct/wrong preview token, anonymous/wrong-account/wrong-token acceptance denial, successful linked acceptance with pending-verification grant, token consumption/single use, and expired/revoked preview and acceptance denial. No email was sent.
- Rollback-wrapped [later privacy SQL](../../tests/database/phase4-later-privacy.sql): **4 checks pass** for anonymous denial, cross-user consent/retention/recovery denial, subject-authorised access and service-role access. All tests use existing `@local.test` users and leave zero persisted fixture rows.
- Audited all seven modified `SECURITY DEFINER` definitions after migration: `postgres` owner, `search_path=''`, `anon EXECUTE=false`, `authenticated/service_role EXECUTE=true`. The three storage buckets inspected (`vault-docs`, identity evidence, estate evidence) remain private. Clone has 140 public and 16 storage RLS policies. No tested policy broadened access.
- Source/unit checks after an offline lockfile install in the isolated worktree: stabilisation **81/81**; TypeScript pass; build pass; lint pass with 18 existing warnings. Core **53/54**: unchanged committed Supabase `site_url` local-URL assertion fails, as at the Phase 3 baseline. The initial missing-dependency errors before `npm ci --offline` were environmental and resolved; they are not counted as code failures.

These database tests simulate PostgREST roles and JWT claims inside PostgreSQL. The local API still targets source UAT, so real authenticated API/browser calls were **not** directed at the clone and are not claimed as passed. Neither the invitation email delivery pipeline nor a biometric provider was exercised.

## Source integrity and next checkpoint

After all clone operations, source `postgres` still had 38 migrations (ledger hash `7d7364ff7a8c4e2646839c0fa94ff0d8`), 8 auth users, 7 admin users, 1 wallet, and zero grants, invitations, assets, records or storage objects. Its auth/admin/wallet fingerprints match pre-rehearsal values; `required_identity_level` and `enterprise_memberships` remain absent. The clone has 61 migrations and zero persisted test fixtures. No hosted, staging or production service was changed.

**Recommendation:** the two reported defects and the additional later-helper grant gap are corrected in the disposable clone. Review this 21-historical-plus-2-forward migration plan and residual API/JWT test limitation before deciding on a separately authorised original-UAT application. Do not migrate original UAT or begin Phase 4 authenticated screen testing at this checkpoint.
