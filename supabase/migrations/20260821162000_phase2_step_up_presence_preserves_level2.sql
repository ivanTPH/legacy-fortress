-- Phase 2 correction: Level 3 presence is short-lived step-up assurance
-- layered on top of durable Level 2 identity, not a replacement for it.

CREATE OR REPLACE FUNCTION public.lf_identity_presence_level(p_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.identity_assurance_states s
      WHERE s.user_id = p_user_id
        AND s.identity_level >= 2
        AND COALESCE(s.expires_at, timezone('utc', now()) + interval '1 second') > timezone('utc', now())
        AND COALESCE(s.presence_reverified_at, s.verified_at) >= timezone('utc', now()) - interval '15 minutes'
        AND COALESCE((s.metadata ->> 'presence_expires_at')::timestamptz, timezone('utc', now()) - interval '1 second') > timezone('utc', now())
    ) THEN 3
    ELSE public.lf_identity_assurance_level(p_user_id)
  END;
$$;

REVOKE ALL ON FUNCTION public.lf_identity_presence_level(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lf_identity_presence_level(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.lf_identity_presence_level(uuid) TO authenticated;
