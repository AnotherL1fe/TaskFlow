# Резервное копирование TaskFlow

| Файл          | Платформа   | Назначение                                                       |
| ------------- | ----------- | ---------------------------------------------------------------- |
| `backup.ps1`  | Windows     | custom-дамп `pg_dump -Fc -Z 6`, дамп ролей, retention            |
| `restore.ps1` | Windows     | `pg_restore --clean --if-exists --exit-on-error`, проверка строк |
| `backup.sh`   | Linux/macOS | то же для CI/сервера                                             |
| `restore.sh`  | Linux/macOS | то же для CI/сервера                                             |

## Быстрый старт (Windows)

```powershell
$env:PGPASSWORD = 'taskflow'
.\backup\backup.ps1 -DbName taskflow_sql -PgBin 'C:\Program Files\PostgreSQL\15\bin'

.\backup\restore.ps1 `
  -DumpFile .\backups\taskflow_sql-20261106T000000Z.dump `
  -TargetDb taskflow_restore -CreateDatabase `
  -PgBin 'C:\Program Files\PostgreSQL\15\bin'
```

## Быстрый старт (Linux/macOS)

```bash
export PGPASSWORD=taskflow
DB_NAME=taskflow_sql ./backup/backup.sh

TARGET_DB=taskflow_restore CREATE_DATABASE=1 \
  ./backup/restore.sh backups/taskflow_sql-20261106T000000Z.dump
```

## Что проверяется

- дамп создан и не пуст;
- `pg_restore --list` читает архив;
- при восстановлении включён `--exit-on-error`;
- после восстановления выводится количество пользователей и задач;
- старые дампы удаляются по `RetentionDays`/`RETENTION_DAYS` (по умолчанию 14 дней).

## Рекомендации

- хранить дампы вне каталога приложения (`.gitignore` уже исключает `backups/`);
- шифровать архив (`gpg`, `age`) перед отправкой в объектное хранилище;
- использовать `PGPASSWORD` только в пределах сессии, в production — `.pgpass`/секрет-менеджер;
- регулярно выполнять restore drill на отдельной БД;
- для production добавить WAL-архив и PITR.
