#!/usr/bin/env bash
# ============================================================================
# backup.sh — резервное копирование БД TaskFlow (Linux/macOS)
# Пример: DB_NAME=taskflow_sql OUT_DIR=/var/backups/taskflow ./backup/backup.sh
# Пароль задаётся через PGPASSWORD или ~/.pgpass.
# ============================================================================
set -euo pipefail

DB_NAME="${DB_NAME:-taskflow_db}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
OUT_DIR="${OUT_DIR:-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP_FILE="$OUT_DIR/$DB_NAME-$STAMP.dump"

echo "==> pg_dump: $DB_NAME -> $DUMP_FILE"
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --format=custom --compress=6 --file="$DUMP_FILE"

if [ ! -s "$DUMP_FILE" ]; then
    echo "Ошибка: дамп пуст" >&2
    exit 1
fi

pg_restore --list "$DUMP_FILE" > /dev/null
echo "==> дамп проверен: $(du -h "$DUMP_FILE" | cut -f1)"

ROLES_FILE="$OUT_DIR/$DB_NAME-$STAMP.roles.sql"
if pg_dumpall -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
    --roles-only --file="$ROLES_FILE"; then
    echo "==> роли сохранены: $ROLES_FILE"
else
    echo "Предупреждение: не удалось сохранить роли (нужен суперпользователь)" >&2
    rm -f "$ROLES_FILE"
fi

find "$OUT_DIR" -maxdepth 1 -type f -name "$DB_NAME-*.dump" \
    -mtime +"$RETENTION_DAYS" -print -delete

echo "Готово: $DUMP_FILE, retention ${RETENTION_DAYS} дн."
