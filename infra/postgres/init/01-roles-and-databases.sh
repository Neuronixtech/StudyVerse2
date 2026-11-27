#!/usr/bin/env bash
# Creates the StudyVerse database roles and databases (Backend_architecture.md §13.1).
#
#   studyverse_migrator  owns the databases; runs Prisma migrations.
#   studyverse_app       the API's runtime role: reads and writes rows, can't change the
#                        schema (no CREATE on public), isn't a superuser or an owner.
#
#   studyverse           local development database
#   studyverse_shadow    scratch database for `prisma migrate dev` (migrator only)
#   studyverse_test      integration tests
#
# The postgres image runs this once, when it initializes an empty data volume
# (/docker-entrypoint-initdb.d). CI runs it against its service container with
# PGHOST and PGPASSWORD set. Passwords come from the environment, never from Git.
set -euo pipefail

: "${STUDYVERSE_MIGRATOR_PASSWORD:?STUDYVERSE_MIGRATOR_PASSWORD must be set}"
: "${STUDYVERSE_APP_PASSWORD:?STUDYVERSE_APP_PASSWORD must be set}"

psql_super=(psql -v ON_ERROR_STOP=1 --no-psqlrc --username "${POSTGRES_USER:-postgres}")

# Passwords are passed as psql variables and quoted by psql (:'name'), so they are
# never interpolated into SQL by the shell.
"${psql_super[@]}" --dbname postgres \
  -v migrator_password="$STUDYVERSE_MIGRATOR_PASSWORD" \
  -v app_password="$STUDYVERSE_APP_PASSWORD" <<'SQL'
CREATE ROLE studyverse_migrator LOGIN PASSWORD :'migrator_password';
CREATE ROLE studyverse_app LOGIN PASSWORD :'app_password';
CREATE DATABASE studyverse OWNER studyverse_migrator;
CREATE DATABASE studyverse_shadow OWNER studyverse_migrator;
CREATE DATABASE studyverse_test OWNER studyverse_migrator;
SQL

for db in studyverse studyverse_test; do
  "${psql_super[@]}" --dbname "$db" <<SQL
REVOKE ALL ON DATABASE "$db" FROM PUBLIC;
GRANT CONNECT ON DATABASE "$db" TO studyverse_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO studyverse_app;
ALTER DEFAULT PRIVILEGES FOR ROLE studyverse_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO studyverse_app;
ALTER DEFAULT PRIVILEGES FOR ROLE studyverse_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO studyverse_app;
SQL
done

# The shadow database is for the migrator only.
"${psql_super[@]}" --dbname studyverse_shadow <<'SQL'
REVOKE ALL ON DATABASE studyverse_shadow FROM PUBLIC;
SQL

echo "studyverse roles and databases created"
