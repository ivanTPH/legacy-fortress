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

psql_staging() {
  docker exec "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$USER" -d "$DB" "$@"
}

table_exists="$(psql_staging -Atqc "SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL")"
[[ "$table_exists" == "t" ]] || { echo "REFUSED: expected migration history table is missing" >&2; exit 1; }

echo "Verified database: $DB ($USER)"
echo "Migration-history columns:"
psql_staging -c "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations' ORDER BY ordinal_position;"
echo "Recent migration-history rows:"
psql_staging -c "SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;"

existing_count="$(psql_staging -Atv migration_version="$VERSION" -c "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version = :'migration_version';")"
case "$existing_count" in
  1)
    echo "PASS: migration version $VERSION already exists exactly once; no mutation performed"
    exit 0
    ;;
  0) ;;
  *)
    echo "FAIL: migration version $VERSION appears $existing_count times" >&2
    exit 1
    ;;
esac

required_unknown="$(psql_staging -Atqc "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations' AND is_nullable = 'NO' AND column_default IS NULL AND column_name NOT IN ('version', 'name', 'statements');")"
has_hash="$(psql_staging -Atqc "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations' AND column_name = 'hash')")"
has_name="$(psql_staging -Atqc "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations' AND column_name = 'name')")"
has_statements="$(psql_staging -Atqc "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations' AND column_name = 'statements')")"

if [[ "$has_hash" == "t" || "$required_unknown" != "0" ]]; then
  echo "Unexpected migration-history convention: refusing to fabricate fields" >&2
  exit 1
fi

# Insert with ordinary SQL after schema validation. No psql variables are used
# inside a dollar-quoted PL/pgSQL block, and migration SQL is never re-run.
if [[ "$has_name" == "t" && "$has_statements" == "t" ]]; then
  psql_staging -v migration_version="$VERSION" -v migration_name="$NAME" -c "INSERT INTO supabase_migrations.schema_migrations(version, name, statements) VALUES (:'migration_version', :'migration_name', ARRAY[]::text[]);"
elif [[ "$has_name" == "t" ]]; then
  psql_staging -v migration_version="$VERSION" -v migration_name="$NAME" -c "INSERT INTO supabase_migrations.schema_migrations(version, name) VALUES (:'migration_version', :'migration_name');"
else
  psql_staging -v migration_version="$VERSION" -c "INSERT INTO supabase_migrations.schema_migrations(version) VALUES (:'migration_version');"
fi

verified_count="$(psql_staging -Atv migration_version="$VERSION" -c "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version = :'migration_version';")"
[[ "$verified_count" == "1" ]] || { echo "FAIL: migration history verification returned $verified_count rows" >&2; exit 1; }
psql_staging -v migration_version="$VERSION" -c "SELECT * FROM supabase_migrations.schema_migrations WHERE version = :'migration_version';"
echo "PASS: staging migration history contains $VERSION exactly once"
