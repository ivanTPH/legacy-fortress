ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'support_agent';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'admin_users' AND c.conname = 'admin_users_role_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.admin_users
      ADD CONSTRAINT admin_users_role_check
      CHECK (role IN ('super_admin','support_agent','verification_reviewer','probate_reviewer','auditor','enterprise_admin','organisation_admin'))
      NOT VALID
    $sql$;
  END IF;
END$$;

UPDATE public.admin_users
SET role = 'super_admin', updated_at = timezone('utc', now())
WHERE is_master = true;

CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  action text NOT NULL,
  result text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email_normalized text,
  actor_role text,
  resource_type text NOT NULL,
  resource_id text,
  resource_label text,
  route text NOT NULL,
  policy_decision text NOT NULL DEFAULT 'allowed',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS audit_events_actor_created_idx
  ON public.audit_events (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_resource_created_idx
  ON public.audit_events (resource_type, resource_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_category_created_idx
  ON public.audit_events (category, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_route_created_idx
  ON public.audit_events (route, created_at DESC);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.prevent_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events are append-only';
END;
$$;

DROP TRIGGER IF EXISTS audit_events_prevent_update ON public.audit_events;
CREATE TRIGGER audit_events_prevent_update
  BEFORE UPDATE ON public.audit_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_event_mutation();

DROP TRIGGER IF EXISTS audit_events_prevent_delete ON public.audit_events;
CREATE TRIGGER audit_events_prevent_delete
  BEFORE DELETE ON public.audit_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_event_mutation();
