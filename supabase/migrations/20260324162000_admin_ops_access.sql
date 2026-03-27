CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name text,
  status text NOT NULL DEFAULT 'active',
  is_master boolean NOT NULL DEFAULT false,
  granted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_user_id_uidx
  ON public.admin_users (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS admin_users_email_status_idx
  ON public.admin_users (email_normalized, status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'admin_users' AND c.conname = 'admin_users_status_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.admin_users
      ADD CONSTRAINT admin_users_status_check
      CHECK (status IN ('active', 'inactive'))
      NOT VALID
    $sql$;
  END IF;
END$$;

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

INSERT INTO public.admin_users (
  email_normalized,
  display_name,
  status,
  is_master
)
VALUES (
  'ivanyardley@me.com',
  'Master Admin',
  'active',
  true
)
ON CONFLICT (email_normalized) DO UPDATE
SET
  status = 'active',
  is_master = true,
  updated_at = timezone('utc', now());

