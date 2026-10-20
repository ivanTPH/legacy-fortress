# Linked release security checkpoint (2026-10-20)

Status: code prepared; **no TEST migration or deployment authorised yet**.

## Migration order and existing grants

1. `20261020082900_recipient_access_notifications.sql` (SHA-256 `4f3efc0ee009805e2f43017e94b4ec863abacf4ea84f2b529dc7a7d7bc3ae09f`): existing transactional recipient notification/audit intent.
2. `20261020091848_linked_release_access_policy.sql`: adds release state/authority columns, fail-closed linked RLS and storage helpers, narrow relationship/attorney RPCs, owner attorney consent, protected staff decision RPC, release notifications and audit events.

The second migration classifies every existing non-revoked grant `DESIGNATED_LOCKED`; revoked grants become `REVOKED`. Existing selections and audit history are retained. **Every recipient with previously usable living access loses it until an individually reviewed release decision.** Old grants are never converted automatically to attorney or estate access. Exact affected grant and recipient counts require a read-only TEST query (`SELECT activation_status, count(*) FROM public.account_access_grants GROUP BY activation_status`); no personal data is needed in the report.

## Mandatory operator gate before applying either file

- Prove the operator session targets `supabase-test.mylegacyfortress.com` / TEST `postgres`, not production; record database identity and migration ledger.
- Confirm TEST contains the notification migration's required `account_access_grants`, `contact_invitations`, `invitation_events`, `audit_events`; for the release migration also confirm `estate_access_claims`, `death_reports`, `admin_users`, canonical assets/records/section entries/documents/attachments, Vault lifecycle and identity helpers, and current linked RLS/storage policies.
- Take a fresh encrypted/restricted TEST backup, verify archive integrity, and **restore it into an isolated disposable database** with data, roles, policies and migration ledger. An archive checksum alone does not prove recovery.
- Rehearse both exact files and ledger updates in order on that clone; execute rollback-wrapped synthetic connected, designated, attorney, estate, revoked, wrong-user, anonymous, owner and storage tests. Compare grants, trigger definitions and policies. Hosted and local runtime tests have not yet passed for the new migration.
- If rehearsal passes, apply both files and ledger entries by the established Coolify operator procedure in one `ON_ERROR_STOP` transaction. Any error rolls back both migrations and ledger entries. Do not reset or repair ad hoc. If commit succeeds but acceptance later fails, stop application promotion and recover TEST from the verified backup under a separate owner decision; the migration is intentionally forward-only and cannot be safely undone by dropping columns while new decisions exist.

Other release gates: verify effective hosted GoTrue password requirements (local config is six characters with no additional character rule); confirm production URL/configuration is excluded; run authenticated synthetic RLS, storage and API checks and a 390px mobile check. Email delivery remains `not_configured`; in-app notification creation is not an email-delivered claim. Existing signed URLs can remain usable until their short expiry after revocation and should be considered in acceptance.
