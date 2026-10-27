-- A contact's association with a record is not an access decision. Existing
-- grants retain their explicitly selected asset/record IDs and identity gate.
-- Do not backfill legacy associations: their owner authorisation is unknown.
CREATE OR REPLACE FUNCTION public.linked_grant_allows_asset(
  p_owner_user_id uuid,
  p_asset_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_access_grants g
    WHERE g.owner_user_id = p_owner_user_id
      AND g.linked_user_id = auth.uid()
      AND public.lf_linked_grant_satisfies_identity(g)
      AND COALESCE(g.permissions_override -> 'asset_ids', '[]'::jsonb) ? p_asset_id::text
  );
$$;

CREATE OR REPLACE FUNCTION public.linked_grant_allows_record(
  p_owner_user_id uuid,
  p_record_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_access_grants g
    WHERE g.owner_user_id = p_owner_user_id
      AND g.linked_user_id = auth.uid()
      AND public.lf_linked_grant_satisfies_identity(g)
      AND COALESCE(g.permissions_override -> 'record_ids', '[]'::jsonb) ? p_record_id::text
  );
$$;
