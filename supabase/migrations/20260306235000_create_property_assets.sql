-- Additive migration: Property Vault table and query indexes
-- Non-destructive: only creates objects if they do not already exist.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.property_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_type text,
  address text,
  ownership_type text,
  estimated_value numeric NOT NULL DEFAULT 0,
  mortgage_lender text,
  mortgage_balance numeric NOT NULL DEFAULT 0,
  insurance_provider text,
  policy_number text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS property_assets_user_id_idx
  ON public.property_assets (user_id);

CREATE INDEX IF NOT EXISTS property_assets_created_at_idx
  ON public.property_assets (created_at DESC);

CREATE INDEX IF NOT EXISTS property_assets_user_created_idx
  ON public.property_assets (user_id, created_at DESC);
