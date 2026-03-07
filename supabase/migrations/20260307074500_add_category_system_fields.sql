-- Stage: Category system (additive only)
-- Adds structured category/subcategory/custom fields aligned with section forms.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Personal possessions table for Personal 5-style category-first capture flow.
CREATE TABLE IF NOT EXISTS public.personal_possessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  possession_type text,
  subcategory text,
  custom_category text,
  custom_subcategory text,
  item_name text,
  item_details text,
  estimated_value numeric DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS personal_possessions_user_id_idx
  ON public.personal_possessions (user_id);
CREATE INDEX IF NOT EXISTS personal_possessions_created_at_idx
  ON public.personal_possessions (created_at DESC);
CREATE INDEX IF NOT EXISTS personal_possessions_user_created_at_idx
  ON public.personal_possessions (user_id, created_at DESC);

DO $$
BEGIN
  IF to_regclass('public.property_assets') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.property_assets ADD COLUMN IF NOT EXISTS custom_property_type text';
  END IF;

  IF to_regclass('public.financial_accounts') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.financial_accounts ADD COLUMN IF NOT EXISTS account_subtype text';
    EXECUTE 'ALTER TABLE public.financial_accounts ADD COLUMN IF NOT EXISTS custom_account_type text';
    EXECUTE 'ALTER TABLE public.financial_accounts ADD COLUMN IF NOT EXISTS custom_account_subtype text';
  END IF;

  IF to_regclass('public.legal_documents') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.legal_documents ADD COLUMN IF NOT EXISTS document_subtype text';
    EXECUTE 'ALTER TABLE public.legal_documents ADD COLUMN IF NOT EXISTS custom_document_type text';
    EXECUTE 'ALTER TABLE public.legal_documents ADD COLUMN IF NOT EXISTS custom_document_subtype text';
  END IF;

  IF to_regclass('public.business_interests') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.business_interests ADD COLUMN IF NOT EXISTS entity_subtype text';
    EXECUTE 'ALTER TABLE public.business_interests ADD COLUMN IF NOT EXISTS custom_entity_type text';
    EXECUTE 'ALTER TABLE public.business_interests ADD COLUMN IF NOT EXISTS custom_entity_subtype text';
  END IF;

  IF to_regclass('public.digital_assets') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.digital_assets ADD COLUMN IF NOT EXISTS subcategory text';
    EXECUTE 'ALTER TABLE public.digital_assets ADD COLUMN IF NOT EXISTS custom_category text';
    EXECUTE 'ALTER TABLE public.digital_assets ADD COLUMN IF NOT EXISTS custom_subcategory text';
  END IF;
END
$$;
