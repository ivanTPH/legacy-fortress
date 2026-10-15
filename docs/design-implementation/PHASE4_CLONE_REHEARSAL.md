# Phase 4 Stage A clone-only migration rehearsal — 15 October 2026

**Recommendation: requires corrections. Do not apply the ten migrations to the existing local UAT database.** This is a clone-only result, not approval for a UAT migration, a hosted change, or Phase 4 authenticated application testing.

## Target, backup and restore

- Worktree: `design/phase-4` at `99283e80e161a289fa6e616f7e5a39073538207f` before this report. The original owner worktree was not edited.
- Source: explicit local `127.0.0.1:55422`, database `postgres`, container `supabase_db_legacy-fortress-web-uat`, PostgreSQL 17.6. The approved API is `127.0.0.1:55421`; it still points at the **source**, not the clone. The Phase 4 worktree's default Supabase CLI configuration points to a different local stack and was not used to target this database. No hosted endpoint was used.
- Clone: database `lf_phase4_rehearsal_20261014` in the same local PostgreSQL 17.6 cluster, reached with an explicit database name. All migration and fixture writes targeted this disposable database only.
- Restricted backup outside Git: `/private/tmp/lf-phase4-clone-rehearsal-20261014/uat.dump` (PG17.6 custom format; 561,451 bytes; SHA-256 `2d28cf5a1c45f05ae1c7b38e442e3e1a5e91c0cf1d13a7d76bb2cae2989fb253`) and `globals.sql` (PG17.6 roles/memberships; 6,638 bytes; SHA-256 `dfcc4ccda4647ea96b3aee4aa0a6b036d1ffa2af62c9bd8a06f15aa4c9e110c8`). Directory mode 700 and files mode 600. The archive includes data, schema, grants and `supabase_migrations` history; globals include 15 role definitions and 18 membership grants. No backup content is committed or reported.
- Restore was verified in the new database. An initial transactional restore as `postgres` rolled back because that role cannot `SET ROLE supabase_admin`. A second transactional restore as `supabase_admin` rolled back because replay of the generated `graphql_public.graphql` wrapper ACL precedes the extension-generated function. The complete archive was then restored with its ownership and other ACLs, excluding **only** that ACL item; the source-equivalent wrapper and grant were recreated in the clone. Function definition hash, owner and effective execute grants match source. This is a restore procedure caveat, not lost application data. Before migration, source and clone matched on all 38 ledger entries, selected table/function/policy counts, critical table counts and privacy-preserving auth/admin/wallet row fingerprints.

## Migration results

The ten unchanged repository files were run in order, one SQL file and its ledger insert in each failure-on-error transaction. Each completed. The clone ledger advanced from 38 to 48 entries, ending at `20260821162000`; the following entries are present in order:

| # | Migration file | Result |
| --- | --- | --- |
| 1 | `20260721153000_provision_vault_docs_storage_bucket.sql` | Applied; private `vault-docs` bucket. |
| 2 | `20260722103000_admin_enterprise_operations.sql` | Applied; enterprise/admin objects and policies. |
| 3 | `20260722193000_enterprise_organisation_management_phase1.sql` | Applied. |
| 4 | `20260723123000_enterprise_licence_seat_management_phase2.sql` | Applied. |
| 5 | `20260724103000_enterprise_invitations_memberships_phase3.sql` | Applied; memberships present. |
| 6 | `20260724163000_enterprise_analytics_reporting_phase4.sql` | Applied. |
| 7 | `20260730162000_admin_lifecycle_super_admin_invariant.sql` | Applied; update/delete guard triggers enabled. |
| 8 | `20260820120000_phase1_verified_access_policy_foundation.sql` | Applied; identity/vault/grant columns, functions and RLS. **Security defects below.** |
| 9 | `20260821150000_phase2_identity_verification.sql` | Applied; private identity-evidence bucket and RLS tables. |
| 10 | `20260821162000_phase2_step_up_presence_preserves_level2.sql` | Applied. |

The ten-file static scan found no `DROP TABLE`, `TRUNCATE` or `DELETE FROM`; it did find expected policy/function replacements, grants, triggers and an invitation-expiry backfill. Both new storage buckets are private. Successful DDL does **not** establish security or runtime readiness.

## Security and regression evidence

- Clone-only SQL tests used the eight existing `@local.test` synthetic users, simulated `authenticated`/`anon` database roles and JWT subject, and rolled back all fixtures. Owner asset create/read passed. Pending and active-but-Level-1 linked access returned zero rows; a Level-2 linked user saw exactly one explicitly assigned asset and no out-of-scope asset; a third user saw none; a protective vault lock removed linked access and denied owner update while retaining owner read. Clone fixture tables returned to zero rows.
- **Fail — cross-user disclosure:** `anon` can directly execute `lf_identity_assurance_level(uuid)`, `lf_vault_lifecycle_state(uuid)` and `lf_vault_allows_owner_mutation(uuid)` on another synthetic user's ID. In a rollback-wrapped test these returned the other user's Level 2 assurance and protective-lock/mutation state, while direct identity-table RLS returned zero rows. An authenticated owner could likewise query another user's assurance level while direct table RLS returned zero. Migration 8 revokes these functions from `PUBLIC` but fails to revoke explicit inherited `anon` grants; it grants `authenticated` direct execute with no caller authorization in the function bodies. This violates linked-context privacy even where row RLS passes. Other pre-existing anonymous `SECURITY DEFINER` grants remain an audit item; they are not attributed to this candidate without further proof.
- The new `is_active_enterprise_operator` security-definer function also retains public/anonymous execute, although its predicate binds to `auth.uid()` and no anonymous data exposure was demonstrated. Its grant should be narrowed during correction review. The inspected owner/linked RLS and storage policies did not show broader data access in the synthetic tests; this is bounded evidence, not a full policy proof.
- **Fail — invitation preview:** a synthetic, valid pending invitation caused `get_public_contact_invitation` to error with `relation "public.profiles" does not exist`. The 38-migration source has no such table; migration 8 introduces the reference. `20260824143000_phase6_contact_invitation_profile_reference.sql`, one of the eleven later files, explicitly replaces the function with the canonical `user_profiles` lookup. The ten-file intermediate schema is therefore not a functioning invitation schema. Expiry, consumed-token and acceptance runtime checks were stopped at this dependency; static tests alone do not prove them.
- Focused repository tests: 39/39 pass across Phase 1 security, Phase 2 identity, invitation-linked access, owner access requests, identity foundation and viewer permissions. These are source/unit checks, **not** database integration passes. Authenticated browser/API tests were not run because the local Supabase API still targets source UAT rather than the clone.

## Later migrations and source integrity

Eleven files remain from `20260822100000_phase3_death_lock_estate_lifecycle.sql` through `20260905120000_phase7_probate_quorum_completion.sql`. They add or repair estate/probate, privacy, auth lifecycle, invitation profile reference, access operations and IDV workflow. The invitation profile repair is demonstrably required for invitation testing. Estate/probate, later IDV and access-operations tests cannot be claimed against this ten-file intermediate schema. None of the eleven was applied to source or clone in this rehearsal. A search found no later explicit revocation of the three exposed helper grants; that still needs a reviewed correction.

After all clone tests, source `postgres` on `127.0.0.1:55422` still had 38 migrations, max `20260717120000`, ledger hash `7d7364ff7a8c4e2646839c0fa94ff0d8`; 8 auth users, 7 admin users, 1 wallet and zero grants, invitations, assets, records or storage objects. The pre/post auth, admin and wallet row hashes match (`720abd4626742394ac2f90f2e6829e92`, `379bf0638d99ec395fe39078127816b6`, `8db1a4ba42f9877c1841caa423ebebec`). Source still lacks `required_identity_level` and `enterprise_memberships`. Clone retained 48 migrations and no committed test fixtures.

**Next checkpoint:** review a minimal migration correction for the three callable helpers and the broken invitation lookup, then approve a new clone-only rehearsal of the corrected contiguous candidate. Any application to the existing local UAT database requires separate, explicit owner approval after that rehearsal. No staging merge or deployment occurred.
