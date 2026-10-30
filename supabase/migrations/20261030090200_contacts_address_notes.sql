-- People: optional address and private notes (V5.2 Linked People design).
-- Kept in a separate OWNER-ONLY table: contacts has a linked-user SELECT policy, so a person
-- who accepted access can read their own contacts row. The owner's notes and the address
-- they recorded must never be readable by that person.
CREATE TABLE IF NOT EXISTS public.contact_private_details (
  contact_id uuid PRIMARY KEY REFERENCES public.contacts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address text CHECK (address IS NULL OR length(address) <= 300),
  notes text CHECK (notes IS NULL OR length(notes) <= 1000),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE OR REPLACE FUNCTION public.lf_contact_private_details_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = NEW.contact_id AND c.owner_user_id = NEW.owner_user_id) THEN
    RAISE EXCEPTION 'Details must belong to one of the owner''s People';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.contact_id, NEW.owner_user_id) IS DISTINCT FROM (OLD.contact_id, OLD.owner_user_id) THEN
    RAISE EXCEPTION 'Person and owner cannot change';
  END IF;
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.lf_contact_private_details_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER contact_private_details_guard
  BEFORE INSERT OR UPDATE ON public.contact_private_details
  FOR EACH ROW EXECUTE FUNCTION public.lf_contact_private_details_guard();

ALTER TABLE public.contact_private_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY contact_private_details_owner_all ON public.contact_private_details
  FOR ALL TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_private_details TO authenticated;
