-- Normalise financial provider branding source-of-truth.
-- Financial logos are resolved in app via institution resolver; provider_catalog bank rows keep null logo_path.

UPDATE public.provider_catalog
SET logo_path = NULL,
    updated_at = timezone('utc', now())
WHERE provider_type = 'bank'
  AND logo_path IS NOT NULL;
