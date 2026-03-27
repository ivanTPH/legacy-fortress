-- Ensure canonical asset sensitive-payload RPCs resolve pgcrypto correctly in
-- Supabase environments where the extension lives in the extensions schema.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.upsert_asset_sensitive_payload(
  p_asset_id uuid,
  p_payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_payload_text text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_asset_id IS NULL THEN
    RAISE EXCEPTION 'Asset id is required';
  END IF;

  IF p_payload IS NULL OR p_payload = '{}'::jsonb THEN
    DELETE FROM public.asset_encrypted_payloads
    WHERE asset_id = p_asset_id AND owner_user_id = v_user_id;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.assets a
    WHERE a.id = p_asset_id
      AND a.owner_user_id = v_user_id
      AND a.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Asset not found for current user';
  END IF;

  v_payload_text := p_payload::text;

  INSERT INTO public.asset_encrypted_payloads (
    asset_id,
    owner_user_id,
    payload_encrypted,
    payload_hash,
    updated_at
  ) VALUES (
    p_asset_id,
    v_user_id,
    extensions.pgp_sym_encrypt(
      v_payload_text,
      coalesce(current_setting('app.settings.asset_payload_encryption_key', true), 'legacy-fortress-dev-key')
    ),
    encode(extensions.digest(v_payload_text, 'sha256'), 'hex'),
    timezone('utc', now())
  )
  ON CONFLICT (asset_id)
  DO UPDATE SET
    payload_encrypted = EXCLUDED.payload_encrypted,
    payload_hash = EXCLUDED.payload_hash,
    updated_at = timezone('utc', now());
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_asset_sensitive_payload(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_asset_sensitive_payload(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_assets_sensitive_payloads(
  p_asset_ids uuid[]
)
RETURNS TABLE(asset_id uuid, payload jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    aep.asset_id,
    extensions.pgp_sym_decrypt(
      aep.payload_encrypted,
      coalesce(current_setting('app.settings.asset_payload_encryption_key', true), 'legacy-fortress-dev-key')
    )::jsonb AS payload
  FROM public.asset_encrypted_payloads aep
  JOIN public.assets a ON a.id = aep.asset_id
  WHERE a.owner_user_id = v_user_id
    AND aep.owner_user_id = v_user_id
    AND (p_asset_ids IS NULL OR aep.asset_id = ANY(p_asset_ids));
END;
$$;

REVOKE ALL ON FUNCTION public.get_assets_sensitive_payloads(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_assets_sensitive_payloads(uuid[]) TO authenticated;
