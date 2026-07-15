CREATE TABLE IF NOT EXISTS public.probate_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  applicant_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  contact_invitation_id uuid REFERENCES public.contact_invitations(id) ON DELETE SET NULL,
  role_assignment_id uuid REFERENCES public.role_assignments(id) ON DELETE SET NULL,
  verification_request_id uuid REFERENCES public.verification_requests(id) ON DELETE SET NULL,
  access_grant_id uuid REFERENCES public.account_access_grants(id) ON DELETE SET NULL,
  case_type text NOT NULL DEFAULT 'executor_verification',
  status text NOT NULL DEFAULT 'submitted',
  assigned_reviewer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  reviewed_at timestamptz,
  decided_at timestamptz,
  required_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  decision_reason text,
  internal_reviewer_notes text,
  applicant_status_message text NOT NULL DEFAULT 'Submitted for review.',
  access_expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revocation_reason text,
  audit_event_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT probate_cases_type_check CHECK (case_type IN ('executor_verification','probate_access')),
  CONSTRAINT probate_cases_status_check CHECK (status IN ('submitted','needs_information','under_review','approved','rejected','revoked','closed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS probate_cases_verification_request_unique_idx
  ON public.probate_cases (verification_request_id)
  WHERE verification_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS probate_cases_owner_status_idx
  ON public.probate_cases (owner_user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS probate_cases_applicant_idx
  ON public.probate_cases (applicant_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS probate_cases_reviewer_status_idx
  ON public.probate_cases (assigned_reviewer_user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS probate_cases_role_assignment_idx
  ON public.probate_cases (role_assignment_id);

CREATE INDEX IF NOT EXISTS probate_cases_access_grant_idx
  ON public.probate_cases (access_grant_id);

CREATE TABLE IF NOT EXISTS public.probate_case_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.probate_cases(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploaded_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  evidence_type text NOT NULL DEFAULT 'other_supporting_evidence',
  source text NOT NULL DEFAULT 'case_upload',
  storage_bucket text NOT NULL DEFAULT 'vault-docs',
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes bigint NOT NULL DEFAULT 0,
  review_status text NOT NULL DEFAULT 'submitted',
  retained boolean NOT NULL DEFAULT true,
  deleted_at timestamptz,
  audit_event_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT probate_case_evidence_type_check CHECK (evidence_type IN ('death_certificate','probate_grant','will_executor_appointment','identity_document','relationship_statement','other_supporting_evidence')),
  CONSTRAINT probate_case_evidence_source_check CHECK (source IN ('case_upload','legacy_path','document_link')),
  CONSTRAINT probate_case_evidence_review_status_check CHECK (review_status IN ('submitted','accepted','rejected','removed'))
);

CREATE INDEX IF NOT EXISTS probate_case_evidence_case_created_idx
  ON public.probate_case_evidence (case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS probate_case_evidence_owner_idx
  ON public.probate_case_evidence (owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS probate_case_evidence_document_idx
  ON public.probate_case_evidence (document_id);

CREATE INDEX IF NOT EXISTS probate_case_evidence_storage_idx
  ON public.probate_case_evidence (storage_bucket, storage_path);

ALTER TABLE public.probate_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.probate_case_evidence ENABLE ROW LEVEL SECURITY;

INSERT INTO public.probate_cases (
  owner_user_id,
  applicant_user_id,
  contact_id,
  contact_invitation_id,
  role_assignment_id,
  verification_request_id,
  access_grant_id,
  case_type,
  status,
  submitted_at,
  reviewed_at,
  decided_at,
  decision_reason,
  applicant_status_message,
  created_at,
  updated_at
)
SELECT
  vr.owner_user_id,
  ci.accepted_user_id,
  ci.contact_id,
  ci.id,
  ra.id,
  vr.id,
  aag.id,
  CASE WHEN vr.request_type = 'death_certificate' THEN 'probate_access' ELSE 'executor_verification' END,
  CASE
    WHEN vr.request_status IN ('pending','submitted') THEN 'submitted'
    WHEN vr.request_status = 'approved' THEN 'approved'
    WHEN vr.request_status = 'rejected' THEN 'rejected'
    ELSE 'submitted'
  END,
  vr.submitted_at,
  vr.reviewed_at,
  CASE WHEN vr.request_status IN ('approved','rejected') THEN vr.reviewed_at ELSE NULL END,
  vr.review_notes,
  CASE
    WHEN vr.request_status = 'approved' THEN 'Approved for limited access.'
    WHEN vr.request_status = 'rejected' THEN 'Request rejected.'
    ELSE 'Submitted for review.'
  END,
  vr.created_at,
  vr.updated_at
FROM public.verification_requests vr
LEFT JOIN public.role_assignments ra ON ra.id = vr.role_assignment_id
LEFT JOIN public.contact_invitations ci ON ci.id = ra.invitation_id
LEFT JOIN public.account_access_grants aag ON aag.invitation_id = ci.id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.probate_cases pc
  WHERE pc.verification_request_id = vr.id
);

INSERT INTO public.probate_case_evidence (
  case_id,
  owner_user_id,
  uploaded_by_user_id,
  evidence_type,
  source,
  storage_bucket,
  storage_path,
  file_name,
  mime_type,
  size_bytes,
  created_at,
  updated_at
)
SELECT
  pc.id,
  pc.owner_user_id,
  pc.applicant_user_id,
  CASE WHEN vr.request_type = 'death_certificate' THEN 'death_certificate' ELSE 'other_supporting_evidence' END,
  'legacy_path',
  'vault-docs',
  vr.evidence_document_path,
  split_part(vr.evidence_document_path, '/', array_length(string_to_array(vr.evidence_document_path, '/'), 1)),
  'application/octet-stream',
  0,
  vr.created_at,
  vr.updated_at
FROM public.probate_cases pc
JOIN public.verification_requests vr ON vr.id = pc.verification_request_id
WHERE vr.evidence_document_path IS NOT NULL
  AND vr.evidence_document_path <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.probate_case_evidence evidence
    WHERE evidence.case_id = pc.id
      AND evidence.storage_path = vr.evidence_document_path
  );
