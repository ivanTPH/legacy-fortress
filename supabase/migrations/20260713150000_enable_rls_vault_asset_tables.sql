-- Phase: RLS remediation for property_assets, business_interests, digital_assets, personal_possessions
--
-- Context: these 4 tables were created in 20260306233000_add_vault_tables_property_business_digital_profile.sql
-- (and the pre-existing personal_possessions table) but never had RLS enabled, unlike the rest of the
-- schema (organisations/wallets/assets/documents/records all have RLS + linked-access policies from
-- 20260703153000_linked_access_scope_enforcement.sql).
--
-- Scope decision: these 4 tables are owner-scoped only (user_id = auth.uid()), matching their original
-- simple design. They are NOT wired into account_access_grants / linked_grant_allows_* — personal_possessions
-- is confirmed legacy (backfilled into public.records by 20260309122000). If property_assets /
-- business_interests / digital_assets still need linked-viewer sharing (invited contacts, probate access)
-- once confirmed live, add policies mirroring linked_grant_allows_asset() at that point — do not guess it here.
--
-- Applied directly to the cloud project (fegdipgfpynandjwkxnq) on 2026-07-13 via Supabase migration tooling.
-- This copy exists so the self-hosted instance and future pushes stay in sync with the cloud project.

ALTER TABLE public.property_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digital_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_possessions ENABLE ROW LEVEL SECURITY;

-- property_assets
DROP POLICY IF EXISTS property_assets_owner_select ON public.property_assets;
DROP POLICY IF EXISTS property_assets_owner_insert ON public.property_assets;
DROP POLICY IF EXISTS property_assets_owner_update ON public.property_assets;
DROP POLICY IF EXISTS property_assets_owner_delete ON public.property_assets;

CREATE POLICY property_assets_owner_select ON public.property_assets
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY property_assets_owner_insert ON public.property_assets
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY property_assets_owner_update ON public.property_assets
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY property_assets_owner_delete ON public.property_assets
  FOR DELETE USING (user_id = auth.uid());

-- business_interests
DROP POLICY IF EXISTS business_interests_owner_select ON public.business_interests;
DROP POLICY IF EXISTS business_interests_owner_insert ON public.business_interests;
DROP POLICY IF EXISTS business_interests_owner_update ON public.business_interests;
DROP POLICY IF EXISTS business_interests_owner_delete ON public.business_interests;

CREATE POLICY business_interests_owner_select ON public.business_interests
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY business_interests_owner_insert ON public.business_interests
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY business_interests_owner_update ON public.business_interests
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY business_interests_owner_delete ON public.business_interests
  FOR DELETE USING (user_id = auth.uid());

-- digital_assets
DROP POLICY IF EXISTS digital_assets_owner_select ON public.digital_assets;
DROP POLICY IF EXISTS digital_assets_owner_insert ON public.digital_assets;
DROP POLICY IF EXISTS digital_assets_owner_update ON public.digital_assets;
DROP POLICY IF EXISTS digital_assets_owner_delete ON public.digital_assets;

CREATE POLICY digital_assets_owner_select ON public.digital_assets
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY digital_assets_owner_insert ON public.digital_assets
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY digital_assets_owner_update ON public.digital_assets
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY digital_assets_owner_delete ON public.digital_assets
  FOR DELETE USING (user_id = auth.uid());

-- personal_possessions (legacy — superseded by public.records, kept for historical rows)
DROP POLICY IF EXISTS personal_possessions_owner_select ON public.personal_possessions;
DROP POLICY IF EXISTS personal_possessions_owner_insert ON public.personal_possessions;
DROP POLICY IF EXISTS personal_possessions_owner_update ON public.personal_possessions;
DROP POLICY IF EXISTS personal_possessions_owner_delete ON public.personal_possessions;

CREATE POLICY personal_possessions_owner_select ON public.personal_possessions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY personal_possessions_owner_insert ON public.personal_possessions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY personal_possessions_owner_update ON public.personal_possessions
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY personal_possessions_owner_delete ON public.personal_possessions
  FOR DELETE USING (user_id = auth.uid());
