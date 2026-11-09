#!/usr/bin/env bash
# ============================================================================
# apply.sh — последовательное применение db/00…08 на Linux/macOS
# Пример: DB_NAME=taskflow_sql ./db/apply.sh
# ============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_NAME="${DB_NAME:-taskflow_db}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
PSQL="${PSQL:-psql}"

COMMON=(-h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -v ON_ERROR_STOP=1)

echo "==> 00_init.sql (database: $DB_NAME)"
"$PSQL" "${COMMON[@]}" -d postgres -v "dbname=$DB_NAME" -f "$ROOT_DIR/db/00_init.sql"

for file in 01_tables.sql 02_indexes.sql 03_constraints.sql 04_views.sql \
            05_functions.sql 06_roles.sql 07_seed.sql 08_checks.sql; do
    echo "==> $file"
    "$PSQL" "${COMMON[@]}" -d "$DB_NAME" -f "$ROOT_DIR/db/$file"
done

echo "Готово: контур $DB_NAME создан и проверен."
