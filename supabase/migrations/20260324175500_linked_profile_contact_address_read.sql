ALTER TABLE public.contact_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contact_details' AND policyname='contact_details_linked_select'
  ) THEN
    EXECUTE 'CREATE POLICY contact_details_linked_select ON public.contact_details FOR SELECT USING (public.has_linked_account_access(user_id, ARRAY[''accepted'',''verified'',''active'']))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='addresses' AND policyname='addresses_linked_select'
  ) THEN
    EXECUTE 'CREATE POLICY addresses_linked_select ON public.addresses FOR SELECT USING (public.has_linked_account_access(user_id, ARRAY[''accepted'',''verified'',''active'']))';
  END IF;
END$$;
