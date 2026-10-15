-- Forward-only repair for verified-access helper disclosure after the full
-- 2026-08-24 invitation profile-reference correction and later estate/IDV work.
-- Historical migrations remain unchanged for already-migrated environments.

CREATE OR REPLACE FUNCTION public.lf_identity_assurance_level(p_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.role() = 'service_role'
      OR (auth.role() = 'authenticated' AND p_user_id = auth.uid())
    THEN COALESCE(
      (
        SELECT i.identity_level
        FROM public.identity_assurance_states i
        WHERE i.user_id = p_user_id
          AND (i.expires_at IS NULL OR i.expires_at > pg_catalog.timezone('utc', pg_catalog.now()))
        LIMIT 1
      ),
      1
    )
    ELSE NULL::integer
  END;
$$;

CREATE OR REPLACE FUNCTION public.lf_vault_lifecycle_state(p_owner_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.role() = 'service_role'
      OR (
        auth.role() = 'authenticated'
        AND (
          p_owner_user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.account_access_grants g
            WHERE g.owner_user_id = p_owner_user_id
              AND g.linked_user_id = auth.uid()
              AND g.activation_status IN ('verified', 'active')
              AND public.lf_identity_assurance_level(auth.uid()) >= g.required_identity_level
          )
          -- The acceptance RPC reads the vault state after consuming the token
          -- and before inserting its grant, all in one transaction. The row's
          -- xmin must belong to this transaction, so a later deleted grant
          -- cannot revive this short acceptance-only authorisation path.
          OR EXISTS (
            SELECT 1
            FROM public.contact_invitations ci
            WHERE ci.owner_user_id = p_owner_user_id
              AND ci.accepted_user_id = auth.uid()
              AND ci.invitation_status = 'accepted'
              AND ci.token_consumed_at IS NOT NULL
              AND ci.xmin = pg_catalog.pg_current_xact_id_if_assigned()::xid
              AND NOT EXISTS (
                SELECT 1
                FROM public.account_access_grants g
                WHERE g.invitation_id = ci.id
              )
          )
        )
      )
    THEN COALESCE(
      (
        SELECT w.vault_lifecycle_state
        FROM public.wallets w
        WHERE w.owner_user_id = p_owner_user_id
          AND w.status = 'active'
        ORDER BY w.updated_at DESC
        LIMIT 1
      ),
      'OWNER_ACTIVE'
    )
    ELSE NULL::text
  END;
$$;

CREATE OR REPLACE FUNCTION public.lf_vault_allows_owner_mutation(p_owner_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.role() = 'service_role'
      OR (auth.role() = 'authenticated' AND p_owner_user_id = auth.uid())
    THEN COALESCE(public.lf_vault_lifecycle_state(p_owner_user_id) IN ('OWNER_ACTIVE', 'OWNER_RECOVERY'), false)
    ELSE false
  END;
$$;

-- This indirect entry point can otherwise reveal another user's temporary
-- Level 3 presence even when the durable-assurance helper is guarded.
CREATE OR REPLACE FUNCTION public.lf_identity_presence_level(p_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.role() = 'service_role'
      OR (auth.role() = 'authenticated' AND p_user_id = auth.uid())
    THEN CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.identity_assurance_states s
        WHERE s.user_id = p_user_id
          AND s.identity_level >= 2
          AND COALESCE(s.expires_at, pg_catalog.timezone('utc', pg_catalog.now()) + interval '1 second') > pg_catalog.timezone('utc', pg_catalog.now())
          AND COALESCE(s.presence_reverified_at, s.verified_at) >= pg_catalog.timezone('utc', pg_catalog.now()) - interval '15 minutes'
          AND COALESCE((s.metadata ->> 'presence_expires_at')::timestamptz, pg_catalog.timezone('utc', pg_catalog.now()) - interval '1 second') > pg_catalog.timezone('utc', pg_catalog.now())
      ) THEN 3
      ELSE public.lf_identity_assurance_level(p_user_id)
    END
    ELSE NULL::integer
  END;
$$;

-- Revoking PUBLIC alone does not remove grants inherited from the existing
-- default privileges. Remove the explicit anon grants as well.
REVOKE ALL ON FUNCTION public.lf_identity_assurance_level(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lf_vault_lifecycle_state(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lf_vault_allows_owner_mutation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lf_identity_presence_level(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lf_identity_assurance_level(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lf_vault_lifecycle_state(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lf_vault_allows_owner_mutation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lf_identity_presence_level(uuid) TO authenticated, service_role;
