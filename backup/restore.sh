#!/usr/bin/env bash
# ============================================================================
# restore.sh — восстановление БД TaskFlow из custom-дампа (Linux/macOS)
# Пример:
#   TARGET_DB=taskflow_restore CREATE_DATABASE=1 \
#     ./backup/restore.sh backups/taskflow_sql-20261106T000000Z.dump
# ============================================================================
set -euo pipefail

DUMP_FILE="${1:-}"
TARGET_DB="${TARGET_DB:-taskflow_restore}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
CREATE_DATABASE="${CREATE_DATABASE:-0}"
FORCE="${FORCE:-0}"

if [ -z "$DUMP_FILE" ] || [ ! -f "$DUMP_FILE" ]; then
    echo "Использование: $0 <dump-file>" >&2
    exit 1
fi

if [ "$TARGET_DB" = "taskflow_db" ] && [ "$FORCE" != "1" ]; then
    echo "Восстановление поверх taskflow_db запрещено без FORCE=1" >&2
    exit 1
fi

COMMON=(-h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER")

if [ "$CREATE_DATABASE" = "1" ]; then
    EXISTS="$(psql "${COMMON[@]}" -d postgres -tAc \
        "SELECT 1 FROM pg_database WHERE datname = '$TARGET_DB'")"
    if [ "$EXISTS" != "1" ]; then
        echo "==> CREATE DATABASE $TARGET_DB"
        psql "${COMMON[@]}" -d postgres -v ON_ERROR_STOP=1 \
            -c "CREATE DATABASE \"$TARGET_DB\" OWNER taskflow ENCODING 'UTF8'"
    fi
fi

echo "==> pg_restore: $DUMP_FILE -> $TARGET_DB"
pg_restore "${COMMON[@]}" -d "$TARGET_DB" --clean --if-exists \
    --exit-on-error "$DUMP_FILE"

echo "==> Проверка восстановленных данных"
psql "${COMMON[@]}" -d "$TARGET_DB" -v ON_ERROR_STOP=1 \
    -c "SELECT count(*) AS users FROM lib.users; SELECT count(*) AS tasks FROM lib.tasks;"

echo "Готово: $TARGET_DB восстановлена из $DUMP_FILE"
