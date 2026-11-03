-- Fix (3 Nov 2026): since 20261031120000 every new row in public.records failed with
-- 'record "new" has no field "deleted_at"', because the shared trigger function named both tables' removal
-- columns directly. It now reads the right column by name, so it works on both tables. Behaviour is unchanged.
CREATE OR REPLACE FUNCTION lf_vault_access_private.sync_authority_record()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_key text := CASE WHEN TG_TABLE_NAME = 'assets' THEN 'asset_ids' ELSE 'record_ids' END;
  v_removed boolean := (to_jsonb(NEW) ->> CASE WHEN TG_TABLE_NAME = 'assets' THEN 'deleted_at' ELSE 'archived_at' END) IS NOT NULL;
  g record;
  v_ids jsonb;
BEGIN
  FOR g IN
    SELECT gr.id, gr.permissions_override, la.scope_areas
    FROM public.account_access_grants gr
    JOIN public.legal_authorities la ON la.id = gr.source_id AND la.owner_user_id = gr.owner_user_id
    WHERE gr.source = 'legal_authority' AND gr.owner_user_id = NEW.owner_user_id AND gr.activation_status = 'active'
      AND la.status = 'confirmed' AND la.activated_at IS NOT NULL
  LOOP
    v_ids := COALESCE(g.permissions_override -> v_key, '[]'::jsonb) - NEW.id::text;
    IF NOT v_removed AND (lf_vault_access_private.authority_area_matches(array_remove(g.scope_areas, 'legal'), NEW.section_key, NEW.category_key)
       OR COALESCE(g.permissions_override -> 'previous_grant' -> 'override' -> v_key, '[]'::jsonb) ? NEW.id::text) THEN
      v_ids := v_ids || to_jsonb(NEW.id::text);
    END IF;
    IF v_ids IS DISTINCT FROM COALESCE(g.permissions_override -> v_key, '[]'::jsonb) THEN
      UPDATE public.account_access_grants SET permissions_override = jsonb_set(permissions_override, ARRAY[v_key], v_ids), updated_at = timezone('utc', now())
        WHERE id = g.id;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
