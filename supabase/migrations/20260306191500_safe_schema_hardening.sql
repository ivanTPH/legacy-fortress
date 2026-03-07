-- Stage 4: Safe, additive schema hardening aligned to current app queries.
-- Non-destructive only: indexes, defaults, and NOT VALID constraints/FKs guarded by existence checks.

DO $$
BEGIN
  -- financial_accounts: query pattern is user_id + created_at ordering, plus account_type totals.
  IF to_regclass('public.financial_accounts') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'financial_accounts' AND column_name = 'user_id'
    ) AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'financial_accounts' AND column_name = 'created_at'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS financial_accounts_user_created_at_idx ON public.financial_accounts (user_id, created_at DESC)';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'financial_accounts' AND column_name = 'user_id'
    ) AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'financial_accounts' AND column_name = 'account_type'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS financial_accounts_user_account_type_idx ON public.financial_accounts (user_id, account_type)';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'financial_accounts' AND column_name = 'balance'
    ) THEN
      EXECUTE 'ALTER TABLE public.financial_accounts ALTER COLUMN balance SET DEFAULT 0';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'financial_accounts' AND column_name = 'account_type'
    ) THEN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'financial_accounts'
          AND c.conname = 'financial_accounts_account_type_check'
      ) THEN
        EXECUTE $sql$
          ALTER TABLE public.financial_accounts
          ADD CONSTRAINT financial_accounts_account_type_check
          CHECK (account_type IN ('bank','savings','investment','pension','insurance','crypto','liability','other'))
          NOT VALID
        $sql$;
      END IF;
    END IF;
  END IF;
END
$$;

DO $$
BEGIN
  -- personal_profiles: app upserts on user_id, so enforce one row per user when safe.
  IF to_regclass('public.personal_profiles') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'personal_profiles' AND column_name = 'user_id'
    ) AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'personal_profiles' AND column_name = 'created_at'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS personal_profiles_user_created_at_idx ON public.personal_profiles (user_id, created_at DESC)';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'personal_profiles' AND column_name = 'user_id'
    ) THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.personal_profiles
        WHERE user_id IS NOT NULL
        GROUP BY user_id
        HAVING COUNT(*) > 1
      ) THEN
        EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS personal_profiles_user_id_uidx ON public.personal_profiles (user_id)';
      ELSE
        RAISE NOTICE 'Skipped personal_profiles_user_id_uidx: duplicate user_id rows exist.';
      END IF;
    END IF;
  END IF;
END
$$;

DO $$
BEGIN
  -- legal_documents and contacts: both load lists by user_id ordered by created_at DESC.
  IF to_regclass('public.legal_documents') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'legal_documents' AND column_name = 'user_id'
    ) AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'legal_documents' AND column_name = 'created_at'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS legal_documents_user_created_at_idx ON public.legal_documents (user_id, created_at DESC)';
    END IF;
  END IF;

  IF to_regclass('public.contacts') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'user_id'
    ) AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'created_at'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS contacts_user_created_at_idx ON public.contacts (user_id, created_at DESC)';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'user_id'
    ) AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'email'
    ) THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.contacts
        WHERE email IS NOT NULL
        GROUP BY user_id, email
        HAVING COUNT(*) > 1
      ) THEN
        EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS contacts_user_email_not_null_uidx ON public.contacts (user_id, email) WHERE email IS NOT NULL';
      ELSE
        RAISE NOTICE 'Skipped contacts_user_email_not_null_uidx: duplicate (user_id, email) rows exist.';
      END IF;
    END IF;
  END IF;
END
$$;

DO $$
BEGIN
  -- legal_document_participants: add targeted indexes and non-blocking FK constraints when possible.
  IF to_regclass('public.legal_document_participants') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'legal_document_participants' AND column_name = 'legal_document_id'
    ) AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'legal_document_participants' AND column_name = 'contact_id'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS legal_document_participants_doc_contact_idx ON public.legal_document_participants (legal_document_id, contact_id)';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'legal_document_participants' AND column_name = 'user_id'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS legal_document_participants_user_id_idx ON public.legal_document_participants (user_id)';
    END IF;

    IF to_regclass('public.legal_documents') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'legal_document_participants' AND column_name = 'legal_document_id'
      )
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'legal_documents' AND column_name = 'id'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'legal_document_participants'
          AND c.conname = 'ldp_legal_document_id_fkey'
      ) THEN
      EXECUTE $sql$
        ALTER TABLE public.legal_document_participants
        ADD CONSTRAINT ldp_legal_document_id_fkey
        FOREIGN KEY (legal_document_id)
        REFERENCES public.legal_documents(id)
        ON DELETE CASCADE
        NOT VALID
      $sql$;
    END IF;

    IF to_regclass('public.contacts') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'legal_document_participants' AND column_name = 'contact_id'
      )
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'id'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'legal_document_participants'
          AND c.conname = 'ldp_contact_id_fkey'
      ) THEN
      EXECUTE $sql$
        ALTER TABLE public.legal_document_participants
        ADD CONSTRAINT ldp_contact_id_fkey
        FOREIGN KEY (contact_id)
        REFERENCES public.contacts(id)
        ON DELETE CASCADE
        NOT VALID
      $sql$;
    END IF;
  END IF;
END
$$;
