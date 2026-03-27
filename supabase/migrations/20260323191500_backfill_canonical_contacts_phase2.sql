-- Phase 2 canonical contact backfill.
-- Goal: link existing next-of-kin, executor/trusted-contact assets, and invitations
-- into public.contacts/public.contact_links without requiring manual re-save.

WITH source_contacts AS (
  SELECT
    rc.owner_user_id,
    COALESCE(NULLIF(trim(rc.contact_name), ''), NULLIF(trim(r.title), ''), 'Contact') AS full_name,
    NULLIF(lower(trim(rc.contact_email)), '') AS email_normalized,
    NULLIF(trim(rc.contact_email), '') AS email,
    NULL::text AS phone,
    NULLIF(trim(rc.contact_role), '') AS contact_role,
    NULLIF(trim(rc.contact_role), '') AS relationship,
    'record_contact'::text AS source_type,
    'not_invited'::text AS invite_status,
    'not_verified'::text AS verification_status
  FROM public.record_contacts rc
  LEFT JOIN public.records r ON r.id = rc.record_id
  WHERE rc.contact_id IS NULL

  UNION ALL

  SELECT
    r.owner_user_id,
    COALESCE(NULLIF(trim(r.title), ''), 'Contact') AS full_name,
    NULL::text AS email_normalized,
    NULL::text AS email,
    NULLIF(trim(COALESCE(r.metadata ->> 'mobile_phone', r.provider_name)), '') AS phone,
    'next_of_kin'::text AS contact_role,
    NULLIF(trim(r.metadata ->> 'relationship'), '') AS relationship,
    'next_of_kin'::text AS source_type,
    'not_invited'::text AS invite_status,
    'not_verified'::text AS verification_status
  FROM public.records r
  WHERE r.section_key = 'personal'
    AND r.category_key = 'next-of-kin'
    AND NOT EXISTS (
      SELECT 1
      FROM public.record_contacts rc
      WHERE rc.record_id = r.id
    )

  UNION ALL

  SELECT
    a.owner_user_id,
    COALESCE(NULLIF(trim(a.title), ''), NULLIF(trim(a.metadata_json ->> 'full_name'), ''), NULLIF(trim(a.metadata_json ->> 'executor_name'), ''), 'Executor') AS full_name,
    NULLIF(lower(trim(a.metadata_json ->> 'contact_email')), '') AS email_normalized,
    NULLIF(trim(a.metadata_json ->> 'contact_email'), '') AS email,
    NULLIF(trim(a.metadata_json ->> 'contact_phone'), '') AS phone,
    NULLIF(trim(a.metadata_json ->> 'executor_type'), '') AS contact_role,
    NULLIF(trim(a.metadata_json ->> 'relationship_to_user'), '') AS relationship,
    'executor_asset'::text AS source_type,
    'not_invited'::text AS invite_status,
    'not_verified'::text AS verification_status
  FROM public.assets a
  WHERE a.section_key = 'personal'
    AND a.category_key = 'executors'
    AND a.deleted_at IS NULL

  UNION ALL

  SELECT
    ci.owner_user_id,
    COALESCE(NULLIF(trim(ci.contact_name), ''), 'Contact') AS full_name,
    NULLIF(lower(trim(ci.contact_email)), '') AS email_normalized,
    NULLIF(trim(ci.contact_email), '') AS email,
    NULL::text AS phone,
    NULLIF(trim(ci.assigned_role), '') AS contact_role,
    NULLIF(trim(ci.assigned_role), '') AS relationship,
    'invitation'::text AS source_type,
    CASE ci.invitation_status
      WHEN 'pending' THEN 'invite_sent'
      WHEN 'accepted' THEN 'accepted'
      WHEN 'rejected' THEN 'rejected'
      WHEN 'revoked' THEN 'revoked'
      ELSE 'not_invited'
    END AS invite_status,
    CASE COALESCE(ra.activation_status, '')
      WHEN 'invited' THEN 'invited'
      WHEN 'accepted' THEN 'accepted'
      WHEN 'pending_verification' THEN 'pending_verification'
      WHEN 'verification_submitted' THEN 'verification_submitted'
      WHEN 'verified' THEN 'verified'
      WHEN 'active' THEN 'active'
      WHEN 'rejected' THEN 'rejected'
      WHEN 'revoked' THEN 'revoked'
      ELSE 'not_verified'
    END AS verification_status
  FROM public.contact_invitations ci
  LEFT JOIN public.role_assignments ra
    ON ra.invitation_id = ci.id
   AND ra.owner_user_id = ci.owner_user_id
  WHERE ci.contact_id IS NULL
), inserted_contacts AS (
  INSERT INTO public.contacts (
    owner_user_id,
    full_name,
    email,
    email_normalized,
    phone,
    contact_role,
    relationship,
    linked_context,
    invite_status,
    verification_status,
    source_type
  )
  SELECT
    sc.owner_user_id,
    sc.full_name,
    sc.email,
    sc.email_normalized,
    sc.phone,
    sc.contact_role,
    sc.relationship,
    '[]'::jsonb,
    sc.invite_status,
    sc.verification_status,
    sc.source_type
  FROM source_contacts sc
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.owner_user_id = sc.owner_user_id
      AND (
        (sc.email_normalized IS NOT NULL AND c.email_normalized = sc.email_normalized)
        OR (
          sc.email_normalized IS NULL
          AND lower(c.full_name) = lower(sc.full_name)
          AND COALESCE(lower(c.phone), '') = COALESCE(lower(sc.phone), '')
          AND COALESCE(lower(c.contact_role), '') = COALESCE(lower(sc.contact_role), '')
        )
      )
  )
  RETURNING id
)
SELECT count(*) FROM inserted_contacts;

UPDATE public.record_contacts rc
SET contact_id = (
  SELECT c.id
  FROM public.contacts c
  WHERE c.owner_user_id = rc.owner_user_id
    AND (
      (NULLIF(lower(trim(rc.contact_email)), '') IS NOT NULL AND c.email_normalized = NULLIF(lower(trim(rc.contact_email)), ''))
      OR (
        NULLIF(lower(trim(rc.contact_email)), '') IS NULL
        AND lower(c.full_name) = lower(COALESCE(NULLIF(trim(rc.contact_name), ''), 'Contact'))
        AND COALESCE(lower(c.contact_role), '') = COALESCE(lower(NULLIF(trim(rc.contact_role), '')), '')
      )
    )
  ORDER BY c.updated_at DESC
  LIMIT 1
)
WHERE rc.contact_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.owner_user_id = rc.owner_user_id
      AND (
        (NULLIF(lower(trim(rc.contact_email)), '') IS NOT NULL AND c.email_normalized = NULLIF(lower(trim(rc.contact_email)), ''))
        OR (
          NULLIF(lower(trim(rc.contact_email)), '') IS NULL
          AND lower(c.full_name) = lower(COALESCE(NULLIF(trim(rc.contact_name), ''), 'Contact'))
          AND COALESCE(lower(c.contact_role), '') = COALESCE(lower(NULLIF(trim(rc.contact_role), '')), '')
        )
      )
  );

UPDATE public.contact_invitations ci
SET contact_id = (
  SELECT c.id
  FROM public.contacts c
  WHERE c.owner_user_id = ci.owner_user_id
    AND (
      (NULLIF(lower(trim(ci.contact_email)), '') IS NOT NULL AND c.email_normalized = NULLIF(lower(trim(ci.contact_email)), ''))
      OR (
        NULLIF(lower(trim(ci.contact_email)), '') IS NULL
        AND lower(c.full_name) = lower(COALESCE(NULLIF(trim(ci.contact_name), ''), 'Contact'))
        AND COALESCE(lower(c.contact_role), '') = COALESCE(lower(NULLIF(trim(ci.assigned_role), '')), '')
      )
    )
  ORDER BY c.updated_at DESC
  LIMIT 1
)
WHERE ci.contact_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.owner_user_id = ci.owner_user_id
      AND (
        (NULLIF(lower(trim(ci.contact_email)), '') IS NOT NULL AND c.email_normalized = NULLIF(lower(trim(ci.contact_email)), ''))
        OR (
          NULLIF(lower(trim(ci.contact_email)), '') IS NULL
          AND lower(c.full_name) = lower(COALESCE(NULLIF(trim(ci.contact_name), ''), 'Contact'))
          AND COALESCE(lower(c.contact_role), '') = COALESCE(lower(NULLIF(trim(ci.assigned_role), '')), '')
        )
      )
  );

INSERT INTO public.contact_links (
  owner_user_id,
  contact_id,
  source_kind,
  source_id,
  section_key,
  category_key,
  context_label,
  role_label
)
SELECT
  rc.owner_user_id,
  rc.contact_id,
  'record',
  rc.record_id,
  r.section_key,
  r.category_key,
  'Record contact',
  rc.contact_role
FROM public.record_contacts rc
LEFT JOIN public.records r ON r.id = rc.record_id
WHERE rc.contact_id IS NOT NULL
ON CONFLICT (owner_user_id, source_kind, source_id) DO UPDATE SET
  contact_id = EXCLUDED.contact_id,
  section_key = EXCLUDED.section_key,
  category_key = EXCLUDED.category_key,
  context_label = EXCLUDED.context_label,
  role_label = EXCLUDED.role_label,
  updated_at = timezone('utc', now());

INSERT INTO public.contact_links (
  owner_user_id,
  contact_id,
  source_kind,
  source_id,
  section_key,
  category_key,
  context_label,
  role_label
)
SELECT
  a.owner_user_id,
  matched.id,
  'asset',
  a.id,
  a.section_key,
  a.category_key,
  'Executor / trusted contact',
  NULLIF(trim(a.metadata_json ->> 'executor_type'), '')
FROM public.assets a
JOIN LATERAL (
  SELECT c.id
  FROM public.contacts c
  WHERE c.owner_user_id = a.owner_user_id
    AND (
      (NULLIF(lower(trim(a.metadata_json ->> 'contact_email')), '') IS NOT NULL AND c.email_normalized = NULLIF(lower(trim(a.metadata_json ->> 'contact_email')), ''))
      OR (
        NULLIF(lower(trim(a.metadata_json ->> 'contact_email')), '') IS NULL
        AND lower(c.full_name) = lower(COALESCE(NULLIF(trim(a.title), ''), NULLIF(trim(a.metadata_json ->> 'full_name'), ''), NULLIF(trim(a.metadata_json ->> 'executor_name'), ''), 'Executor'))
        AND COALESCE(lower(c.contact_role), '') = COALESCE(lower(NULLIF(trim(a.metadata_json ->> 'executor_type'), '')), '')
      )
    )
  ORDER BY c.updated_at DESC
  LIMIT 1
) AS matched ON true
WHERE a.section_key = 'personal'
  AND a.category_key = 'executors'
  AND a.deleted_at IS NULL
ON CONFLICT (owner_user_id, source_kind, source_id) DO UPDATE SET
  contact_id = EXCLUDED.contact_id,
  section_key = EXCLUDED.section_key,
  category_key = EXCLUDED.category_key,
  context_label = EXCLUDED.context_label,
  role_label = EXCLUDED.role_label,
  updated_at = timezone('utc', now());

INSERT INTO public.contact_links (
  owner_user_id,
  contact_id,
  source_kind,
  source_id,
  section_key,
  category_key,
  context_label,
  role_label
)
SELECT
  ci.owner_user_id,
  ci.contact_id,
  'invitation',
  ci.id,
  'dashboard',
  'contacts',
  'Contact invitation',
  ci.assigned_role
FROM public.contact_invitations ci
WHERE ci.contact_id IS NOT NULL
ON CONFLICT (owner_user_id, source_kind, source_id) DO UPDATE SET
  contact_id = EXCLUDED.contact_id,
  section_key = EXCLUDED.section_key,
  category_key = EXCLUDED.category_key,
  context_label = EXCLUDED.context_label,
  role_label = EXCLUDED.role_label,
  updated_at = timezone('utc', now());

UPDATE public.contacts c
SET linked_context = context_agg.contexts,
    updated_at = timezone('utc', now())
FROM (
  SELECT
    cl.contact_id,
    jsonb_agg(
      jsonb_build_object(
        'source_kind', cl.source_kind,
        'source_id', cl.source_id,
        'section_key', cl.section_key,
        'category_key', cl.category_key,
        'label', cl.context_label,
        'role', cl.role_label
      )
      ORDER BY cl.created_at ASC
    ) AS contexts
  FROM public.contact_links cl
  GROUP BY cl.contact_id
) AS context_agg
WHERE c.id = context_agg.contact_id;
