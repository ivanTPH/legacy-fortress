-- Backfill legacy personal_possessions into universal records for the possessions workspace.
WITH source_rows AS (
  SELECT
    p.id AS legacy_id,
    p.user_id,
    p.item_name,
    p.possession_type,
    p.subcategory,
    p.custom_category,
    p.custom_subcategory,
    p.item_details,
    p.estimated_value,
    p.notes,
    p.file_path,
    p.created_at,
    p.updated_at
  FROM public.personal_possessions p
),
inserted_records AS (
  INSERT INTO public.records (
    owner_user_id,
    section_key,
    category_key,
    title,
    provider_name,
    provider_key,
    summary,
    value_minor,
    currency_code,
    status,
    metadata,
    created_at,
    updated_at
  )
  SELECT
    s.user_id,
    'personal',
    'possessions',
    NULLIF(trim(s.item_name), ''),
    NULL,
    NULL,
    NULLIF(trim(s.item_details), ''),
    GREATEST(0, round(COALESCE(s.estimated_value, 0)::numeric * 100))::bigint,
    'GBP',
    'active',
    jsonb_strip_nulls(
      jsonb_build_object(
        'legacy_possession_id', s.legacy_id::text,
        'category', COALESCE(NULLIF(trim(s.possession_type), ''), 'other'),
        'subtype', NULLIF(
          COALESCE(NULLIF(trim(s.subcategory), ''), NULLIF(trim(s.custom_subcategory), '')),
          ''
        ),
        'description', NULLIF(trim(s.item_details), ''),
        'notes', NULLIF(trim(s.notes), '')
      )
    ),
    COALESCE(s.created_at, timezone('utc', now())),
    COALESCE(s.updated_at, timezone('utc', now()))
  FROM source_rows s
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.records r
    WHERE r.owner_user_id = s.user_id
      AND r.section_key = 'personal'
      AND r.category_key = 'possessions'
      AND COALESCE(r.metadata->>'legacy_possession_id', '') = s.legacy_id::text
  )
  RETURNING id, metadata
),
all_backfilled AS (
  SELECT r.id AS record_id, r.owner_user_id, r.metadata->>'legacy_possession_id' AS legacy_id
  FROM public.records r
  WHERE r.section_key = 'personal'
    AND r.category_key = 'possessions'
    AND r.metadata ? 'legacy_possession_id'
)
INSERT INTO public.attachments (
  record_id,
  owner_user_id,
  storage_bucket,
  storage_path,
  file_name,
  mime_type,
  size_bytes,
  checksum,
  created_at
)
SELECT
  b.record_id,
  b.owner_user_id,
  'vault-docs',
  p.file_path,
  COALESCE(NULLIF(split_part(p.file_path, '/', array_length(string_to_array(p.file_path, '/'), 1)), ''), 'legacy-file'),
  CASE
    WHEN lower(p.file_path) LIKE '%.pdf' THEN 'application/pdf'
    WHEN lower(p.file_path) LIKE '%.jpg' OR lower(p.file_path) LIKE '%.jpeg' THEN 'image/jpeg'
    WHEN lower(p.file_path) LIKE '%.png' THEN 'image/png'
    ELSE 'application/octet-stream'
  END,
  0,
  NULL,
  COALESCE(p.updated_at, p.created_at, timezone('utc', now()))
FROM all_backfilled b
JOIN public.personal_possessions p ON p.id::text = b.legacy_id
WHERE p.file_path IS NOT NULL
  AND p.file_path <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.attachments a
    WHERE a.record_id = b.record_id
      AND a.storage_path = p.file_path
  );
