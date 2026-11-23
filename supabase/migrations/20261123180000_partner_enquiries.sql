-- Partner enquiries (owner decision 23 Nov 2026: a "Become a partner" form on the public site).
-- An organisation interested in a partner licence leaves its details; staff see them in the Admin Inbox and
-- follow up. Only the server (service role) reads or writes this table: the public form posts to an API route
-- that validates and rate-limits first. No customer Vault data is involved.
CREATE TABLE IF NOT EXISTS public.partner_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_name text NOT NULL CHECK (char_length(organisation_name) BETWEEN 2 AND 200),
  organisation_type text CHECK (organisation_type IS NULL OR char_length(organisation_type) <= 60),
  contact_name text NOT NULL CHECK (char_length(contact_name) BETWEEN 2 AND 120),
  contact_email text NOT NULL CHECK (char_length(contact_email) <= 320 AND position('@' IN contact_email) > 1),
  contact_phone text CHECK (contact_phone IS NULL OR char_length(contact_phone) <= 40),
  members_estimate integer CHECK (members_estimate IS NULL OR members_estimate BETWEEN 0 AND 10000000),
  message text CHECK (message IS NULL OR char_length(message) <= 4000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'onboarding', 'closed')),
  handled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'partner_page' CHECK (char_length(source) <= 40),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS partner_enquiries_status_created_idx ON public.partner_enquiries (status, created_at DESC);
CREATE INDEX IF NOT EXISTS partner_enquiries_email_created_idx ON public.partner_enquiries (lower(contact_email), created_at DESC);

ALTER TABLE public.partner_enquiries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.partner_enquiries FROM PUBLIC;
REVOKE ALL ON TABLE public.partner_enquiries FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.partner_enquiries TO service_role;

COMMENT ON TABLE public.partner_enquiries IS
  'Become-a-partner enquiries from the public form. Service role only; shown to staff in the Admin Inbox.';
