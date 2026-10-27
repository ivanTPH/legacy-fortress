\set ON_ERROR_STOP on
BEGIN;
\ir ../../supabase/migrations/20261027104509_linked_people_data_foundation.sql
\ir ../../supabase/migrations/20261027144246_vault_nomination_data_foundation.sql

-- Synthetic fixtures live only inside this rolled-back transaction.
INSERT INTO auth.users (id) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  ('98989898-9898-4989-8989-989898989898');
INSERT INTO public.organisations (id, owner_user_id, name) VALUES
  ('14141414-1414-4414-8414-141414141414', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Owner A synthetic'),
  ('24242424-2424-4424-8424-242424242424', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Owner B synthetic');
INSERT INTO public.wallets (id, organisation_id, owner_user_id) VALUES
  ('15151515-1515-4515-8515-151515151515', '14141414-1414-4414-8414-141414141414', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('25252525-2525-4525-8525-252525252525', '24242424-2424-4424-8424-242424242424', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO public.contacts (id, owner_user_id, full_name, email, linked_user_id) VALUES
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Synthetic nominee', 'nominee@example.invalid', '98989898-9898-4989-8989-989898989898'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Other nominee', 'other@example.invalid', NULL);
INSERT INTO public.assets (id, organisation_id, wallet_id, owner_user_id, section_key, category_key, title) VALUES
  ('16161616-1616-4616-8616-161616161616', '14141414-1414-4414-8414-141414141414', '15151515-1515-4515-8515-151515151515', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'legal', 'wills', 'Owner A Will'),
  ('26262626-2626-4626-8626-262626262626', '24242424-2424-4424-8424-242424242424', '25252525-2525-4525-8525-252525252525', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'legal', 'wills', 'Owner B Will');
INSERT INTO public.documents (id, organisation_id, wallet_id, asset_id, owner_user_id, storage_bucket, storage_path, file_name, mime_type) VALUES
  ('17171717-1717-4717-8717-171717171717', '14141414-1414-4414-8414-141414141414', '15151515-1515-4515-8515-151515151515', '16161616-1616-4616-8616-161616161616', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'vault-docs', 'users/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/nominee-proof.pdf', 'nominee-proof.pdf', 'application/pdf');
INSERT INTO public.identity_assurance_states (user_id, identity_level) VALUES
  ('98989898-9898-4989-8989-989898989898', 2);
INSERT INTO public.account_access_grants (owner_user_id, linked_user_id, contact_id, assigned_role, activation_status, permissions_override) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '98989898-9898-4989-8989-989898989898', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'friend_or_family', 'active', '{}'::jsonb);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
INSERT INTO public.vault_nominations (
  id, owner_user_id, vault_id, person_id, scope
) VALUES (
  '31313131-3131-4313-8313-313131313131',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '15151515-1515-4515-8515-151515151515',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'whole_vault'
);

DO $$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.vault_nominations (owner_user_id, vault_id, person_id, scope)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '25252525-2525-4525-8525-252525252525',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'whole_vault');
  EXCEPTION WHEN OTHERS THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Cross-Vault nomination was accepted'; END IF;
  denied := false;
  BEGIN
    INSERT INTO public.vault_nominations (owner_user_id, vault_id, person_id, scope)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '15151515-1515-4515-8515-151515151515',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'whole_vault');
  EXCEPTION WHEN OTHERS THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Cross-owner person nomination was accepted'; END IF;
END;
$$;

-- A selected nomination and its first include are one transaction.
UPDATE public.vault_nominations SET status = 'cancelled'
WHERE id = '31313131-3131-4313-8313-313131313131';
INSERT INTO public.vault_nominations (
  id, owner_user_id, vault_id, person_id, scope
) VALUES (
  '32323232-3232-4323-8323-323232323232',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '15151515-1515-4515-8515-151515151515',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'selected'
);
INSERT INTO public.vault_nomination_records (
  nomination_id, owner_user_id, vault_id, record_id, mode
) VALUES (
  '32323232-3232-4323-8323-323232323232',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '15151515-1515-4515-8515-151515151515',
  '16161616-1616-4616-8616-161616161616', 'include'
);
SET CONSTRAINTS ALL IMMEDIATE;

DO $$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    DELETE FROM public.vault_nomination_records
    WHERE nomination_id = '32323232-3232-4323-8323-323232323232';
  EXCEPTION WHEN OTHERS THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Selected nomination lost its last included asset'; END IF;
  denied := false;
  BEGIN
    INSERT INTO public.vault_nomination_records (
      nomination_id, owner_user_id, vault_id, record_id, mode
    ) VALUES (
      '32323232-3232-4323-8323-323232323232',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '15151515-1515-4515-8515-151515151515',
      '26262626-2626-4626-8626-262626262626', 'include'
    );
  EXCEPTION WHEN OTHERS THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Other-owner asset entered selected scope'; END IF;
  denied := false;
  BEGIN
    UPDATE public.vault_nominations SET status = 'released'
    WHERE id = '32323232-3232-4323-8323-323232323232';
  EXCEPTION WHEN OTHERS THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Owner self-released nomination'; END IF;
END;
$$;

INSERT INTO public.contacts (id, owner_user_id, full_name) VALUES
  ('12121212-1212-4212-8212-121212121212',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Synthetic second nominee');
INSERT INTO public.vault_nominations (
  id, owner_user_id, vault_id, person_id, scope
) VALUES (
  '33333333-3333-4333-8333-333333333333',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '15151515-1515-4515-8515-151515151515',
  '12121212-1212-4212-8212-121212121212', 'whole_vault'
);
INSERT INTO public.vault_nomination_records (
  nomination_id, owner_user_id, vault_id, record_id, mode
) VALUES (
  '33333333-3333-4333-8333-333333333333',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '15151515-1515-4515-8515-151515151515',
  '16161616-1616-4616-8616-161616161616', 'exclude'
);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.vault_nomination_records
    WHERE nomination_id = '33333333-3333-4333-8333-333333333333'
      AND mode = 'exclude') <> 1 THEN
    RAISE EXCEPTION 'Whole-Vault exception was not stored';
  END IF;
END;
$$;

SET LOCAL request.jwt.claim.sub = '98989898-9898-4989-8989-989898989898';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.my_vault_nomination_status()) THEN
    RAISE EXCEPTION 'Unaccepted invitation exposed nomination status';
  END IF;
  IF EXISTS (SELECT 1 FROM public.vault_nominations)
     OR EXISTS (SELECT 1 FROM public.vault_nomination_records)
     OR EXISTS (SELECT 1 FROM public.assets WHERE owner_user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
     OR EXISTS (SELECT 1 FROM public.documents WHERE owner_user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
     OR public.linked_grant_allows_asset(
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       '16161616-1616-4616-8616-161616161616')
     OR public.linked_grant_allows_storage_object(
       'vault-docs', 'users/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/nominee-proof.pdf') THEN
    RAISE EXCEPTION 'Nomination expanded recipient content access';
  END IF;
END;
$$;

RESET ROLE;
INSERT INTO public.contact_invitations (
  owner_user_id, contact_id, contact_name, contact_email, assigned_role,
  invitation_status, accepted_user_id
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'Synthetic nominee', 'nominee@example.invalid', 'friend_or_family',
  'accepted', '98989898-9898-4989-8989-989898989898'
);
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '98989898-9898-4989-8989-989898989898';
DO $$
BEGIN
  IF (SELECT count(*) FROM public.my_vault_nomination_status()) <> 2
     OR EXISTS (
       SELECT 1 FROM public.my_vault_nomination_status()
       WHERE kind <> 'estate' OR status NOT IN ('active', 'cancelled')
     ) THEN
    RAISE EXCEPTION 'Bound recipient kind/state projection is incorrect';
  END IF;
  IF EXISTS (SELECT 1 FROM public.vault_nominations)
     OR EXISTS (SELECT 1 FROM public.vault_nomination_records)
     OR public.linked_grant_allows_asset(
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       '16161616-1616-4616-8616-161616161616') THEN
    RAISE EXCEPTION 'Invitation acceptance became an access grant';
  END IF;
END;
$$;

RESET ROLE;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.account_access_grants
      WHERE owner_user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 1 THEN
    RAISE EXCEPTION 'Nomination created or changed an access grant';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.audit_events
    WHERE resource_id = '32323232-3232-4323-8323-323232323232'
      AND action = 'nomination.created')
     OR NOT EXISTS (SELECT 1 FROM public.audit_events
    WHERE resource_id = '31313131-3131-4313-8313-313131313131'
      AND action = 'nomination.cancelled')
     OR NOT EXISTS (SELECT 1 FROM public.audit_events
    WHERE resource_id = '33333333-3333-4333-8333-333333333333'
      AND action = 'nomination.scope_added') THEN
    RAISE EXCEPTION 'Nomination create/cancel audit missing';
  END IF;
  IF has_table_privilege('anon', 'public.vault_nominations', 'SELECT')
     OR has_table_privilege('authenticated', 'public.vault_nomination_records', 'UPDATE') THEN
    RAISE EXCEPTION 'Nomination table grants are too broad';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'my_vault_nomination_status') <> 0 THEN
    RAISE EXCEPTION 'Unexpected table named like the recipient projection';
  END IF;
END;
$$;
ROLLBACK;
