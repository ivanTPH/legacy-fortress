-- Free plan sharing (owner decision 3 Nov 2026): on Free, one person can be nominated to receive the Vault
-- after death; sharing records with anyone now, more nominees and adviser suggestions need Premium.
-- Release after death, Power of Attorney and every safety check stay free. Nothing existing is removed:
-- someone who downgrades keeps what they already share and can still reduce or stop it.

CREATE OR REPLACE FUNCTION lf_vault_access_private.owner_is_premium(p_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((SELECT b.account_plan = 'premium' FROM public.billing_profiles b WHERE b.user_id = p_owner), false);
$$;
REVOKE ALL ON FUNCTION lf_vault_access_private.owner_is_premium(uuid) FROM PUBLIC, anon, authenticated;

-- 1. Sharing records now (the owner's own grants only; authority and estate grants are untouched).
CREATE OR REPLACE FUNCTION lf_vault_access_private.enforce_free_sharing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_new jsonb; v_old jsonb;
BEGIN
  IF COALESCE(NEW.source, 'owner_grant') <> 'owner_grant' OR lf_vault_access_private.owner_is_premium(NEW.owner_user_id) THEN RETURN NEW; END IF;
  v_new := COALESCE(NEW.permissions_override -> 'asset_ids', '[]'::jsonb) || COALESCE(NEW.permissions_override -> 'record_ids', '[]'::jsonb);
  v_old := CASE WHEN TG_OP = 'UPDATE'
    THEN COALESCE(OLD.permissions_override -> 'asset_ids', '[]'::jsonb) || COALESCE(OLD.permissions_override -> 'record_ids', '[]'::jsonb)
    ELSE '[]'::jsonb END;
  IF jsonb_typeof(v_new) <> 'array' OR NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(v_new) n WHERE NOT (v_old ? n)) THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' AND auth.uid() IS DISTINCT FROM NEW.owner_user_id THEN
    -- A connection accepted on Free starts with nothing shared now; the owner chooses later with Premium.
    NEW.permissions_override := NEW.permissions_override || '{"asset_ids": [], "record_ids": []}'::jsonb;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'PLAN_LIMIT_SHARING: Sharing records now needs Premium' USING ERRCODE = 'P0001';
END;
$$;
DROP TRIGGER IF EXISTS account_access_grants_free_sharing ON public.account_access_grants;
CREATE TRIGGER account_access_grants_free_sharing BEFORE INSERT OR UPDATE OF permissions_override ON public.account_access_grants
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.enforce_free_sharing();

-- 2. One nominee for later on Free.
CREATE OR REPLACE FUNCTION lf_vault_access_private.enforce_free_nominees()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM NEW.owner_user_id OR lf_vault_access_private.owner_is_premium(NEW.owner_user_id) THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.vault_nominations v WHERE v.owner_user_id = NEW.owner_user_id AND v.status = 'active') THEN
    RAISE EXCEPTION 'PLAN_LIMIT_NOMINEES: The free plan has one nominee' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS vault_nominations_free_limit ON public.vault_nominations;
CREATE TRIGGER vault_nominations_free_limit BEFORE INSERT ON public.vault_nominations
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.enforce_free_nominees();

-- 3. Letting advisers suggest documents.
CREATE OR REPLACE FUNCTION lf_vault_access_private.enforce_free_suggestions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM NEW.owner_user_id OR lf_vault_access_private.owner_is_premium(NEW.owner_user_id) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'PLAN_LIMIT_SUGGESTIONS: Adviser suggestions need Premium' USING ERRCODE = 'P0001';
END;
$$;
DROP TRIGGER IF EXISTS record_suggestion_permissions_free_limit ON public.record_suggestion_permissions;
CREATE TRIGGER record_suggestion_permissions_free_limit BEFORE INSERT ON public.record_suggestion_permissions
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.enforce_free_suggestions();
