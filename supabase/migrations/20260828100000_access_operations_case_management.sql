-- Access operations cases are support workflow records, separate from immutable
-- invitation, role-assignment, grant and verification state.
CREATE TABLE IF NOT EXISTS public.access_operations_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.contact_invitations(id) ON DELETE RESTRICT,
  case_type text NOT NULL DEFAULT 'linked_access_support',
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  assigned_admin_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason_code text,
  reason_summary text,
  resolution_code text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT access_operations_case_status_check CHECK (status IN ('open','needs_attention','awaiting_user','awaiting_verification','escalated','resolved','closed')),
  CONSTRAINT access_operations_case_priority_check CHECK (priority IN ('low','normal','high','urgent')),
  CONSTRAINT access_operations_case_resolution_check CHECK (resolution_code IS NULL OR length(trim(resolution_code)) > 0),
  CONSTRAINT access_operations_case_closed_dates_check CHECK (closed_at IS NULL OR resolved_at IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS access_operations_cases_invitation_unique
  ON public.access_operations_cases (invitation_id);
CREATE INDEX IF NOT EXISTS access_operations_cases_queue_idx
  ON public.access_operations_cases (status, priority, updated_at DESC);
CREATE INDEX IF NOT EXISTS access_operations_cases_assignee_idx
  ON public.access_operations_cases (assigned_admin_user_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.access_operations_case_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.access_operations_cases(id) ON DELETE CASCADE,
  note text NOT NULL CHECK (length(trim(note)) BETWEEN 1 AND 4000),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS access_operations_case_notes_case_idx
  ON public.access_operations_case_notes (case_id, created_at DESC);

ALTER TABLE public.access_operations_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_operations_case_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.access_operations_cases FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.access_operations_case_notes FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.access_operations_cases IS 'Platform support workflow only; never an access-authority or grant state.';
COMMENT ON TABLE public.access_operations_case_notes IS 'Append-only platform support notes; do not store vault, financial or raw IDV content.';
