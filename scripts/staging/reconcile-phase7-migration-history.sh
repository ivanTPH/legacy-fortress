#!/usr/bin/env bash
set -Eeuo pipefail

CONTAINER="supabase-db-wdf2fyo7hrewev6hnqypd2vc"
DB="postgres"
USER="supabase_admin"
VERSION="20260905120000"
NAME="phase7_probate_quorum_completion"

[[ "$CONTAINER" == "supabase-db-wdf2fyo7hrewev6hnqypd2vc" ]] || { echo "REFUSED: unexpected database container" >&2; exit 1; }
container_name="$(docker inspect --format '{{.Name}}' "$CONTAINER" 2>/dev/null || true)"
[[ "$container_name" == "/$CONTAINER" ]] || { echo "REFUSED: verified staging database container was not found" >&2; exit 1; }

docker exec "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$USER" -d "$DB" \
  -v migration_version="$VERSION" -v migration_name="$NAME" <<'SQL'
SELECT current_database() AS database_name, current_user AS database_user;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
ORDER BY ordinal_position;

SELECT *
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 5;

DO $$
DECLARE
  existing_count integer;
  has_name boolean;
  has_statements boolean;
  has_hash boolean;
  unknown_required integer;
BEGIN
  IF to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
    RAISE EXCEPTION 'Expected migration history table is missing';
  END IF;

  SELECT count(*) INTO existing_count
  FROM supabase_migrations.schema_migrations
  WHERE version = :'migration_version';

  IF existing_count > 1 THEN
    RAISE EXCEPTION 'Migration version appears more than once';
  ELSIF existing_count = 1 THEN
    RAISE NOTICE 'Migration version already exists exactly once; no insert performed';
    RETURN;
  END IF;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations' AND column_name = 'name') INTO has_name;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations' AND column_name = 'statements') INTO has_statements;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations' AND column_name = 'hash') INTO has_hash;

  SELECT count(*) INTO unknown_required
  FROM information_schema.columns
  WHERE table_schema = 'supabase_migrations'
    AND table_name = 'schema_migrations'
    AND is_nullable = 'NO'
    AND column_default IS NULL
    AND column_name NOT IN ('version', 'name', 'statements');

  IF has_hash OR unknown_required > 0 THEN
    RAISE EXCEPTION 'Unexpected migration-history convention; refusing to fabricate fields';
  END IF;

  IF has_name AND has_statements THEN
    INSERT INTO supabase_migrations.schema_migrations(version, name, statements)
    VALUES (:'migration_version', :'migration_name', ARRAY[]::text[]);
  ELSIF has_name THEN
    INSERT INTO supabase_migrations.schema_migrations(version, name)
    VALUES (:'migration_version', :'migration_name');
  ELSE
    INSERT INTO supabase_migrations.schema_migrations(version)
    VALUES (:'migration_version');
  END IF;
END $$;

SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version = :'migration_version';

DO $$
BEGIN
  IF (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version = :'migration_version') <> 1 THEN
    RAISE EXCEPTION 'Migration history verification failed';
  END IF;
END $$;
SQL

echo "PASS: staging migration history contains $VERSION exactly once"
