BEGIN;

-- Audit rows are immutable. An ON DELETE SET NULL FK would make Auth-user
-- deletion issue an UPDATE against audit_events, which the append-only guard
-- correctly rejects. Keep the nullable actor reference as a historical
-- pseudonymous pointer without allowing account deletion to mutate the event.
ALTER TABLE public.audit_events
  DROP CONSTRAINT IF EXISTS audit_events_actor_user_id_fkey;

COMMIT;
