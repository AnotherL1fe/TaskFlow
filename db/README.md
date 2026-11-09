# TaskFlow — контур базы данных (ПМ.11)

Скрипты создают отдельный контур администрирования БД: базовые таблицы, индексы,
ограничения, представления, функции, триггеры, роли и проверки.

## Порядок применения

| Файл | Назначение |
|------|------------|
| `00_init.sql` | роли `taskflow`/`app_user`/`report_user`, БД, схема `lib` |
| `01_tables.sql` | таблицы `users`, `projects`, `tasks`, `task_status_history` |
| `02_indexes.sql` | уникальные и вспомогательные индексы |
| `03_constraints.sql` | внешние ключи и CHECK-ограничения |
| `04_views.sql` | `v_task_details`, `v_project_stats`, `v_overdue_tasks` |
| `05_functions.sql` | функции смены статуса/назначения, триггеры `updated_at` и аудита |
| `06_roles.sql` | привилегии `app_user` (DML) и `report_user` (только SELECT) |
| `07_seed.sql` | 5 пользователей, 4 проекта, 10 задач |
| `08_checks.sql` | 15 автоматических проверок + отчётные выборки |

```bash
# Linux/macOS
psql -h localhost -U postgres -d postgres -v dbname=taskflow_db -f db/00_init.sql
for f in db/0[1-8]_*.sql; do
  psql -h localhost -U postgres -d taskflow_db -v ON_ERROR_STOP=1 -f "$f"
done
```

```powershell
# Windows PowerShell
.\db\apply.ps1 -DbName taskflow_db -PgBin "C:\Program Files\PostgreSQL\15\bin"
```

Скрипты идемпотентны: повторный запуск не дублирует данные и не ломает объекты.

## Пароли учебного контура

| Роль | Пароль | Назначение |
|------|--------|------------|
| `taskflow` | `taskflow` | владелец схемы, приложение |
| `app_user` | `app_user` | сервисная DML-роль |
| `report_user` | `report_user` | отчётность, только чтение |

Пользователи приложения: `ivan@example.com` / `secret123`,
`admin@example.com` / `admin123`.

## Важно: два контура

- **Prisma-контур** (`taskflow_db`): схема управляется миграциями Prisma
  (`server/prisma/migrations`), это рабочая БД приложения.
- **SQL-контур** (`taskflow_sql`): создаётся скриптами `db/00–07`, содержит
  дополнительные объекты администрирования (аудит, представления, роли) и
  используется для проверки `db/08_checks.sql` и прав `report_user`.

Такое разделение не даёт представлениям и триггерам влиять на drift-проверку
`prisma migrate dev`. Для проверки SQL-контура:

```bash
psql -h localhost -U postgres -d postgres -v dbname=taskflow_sql -f db/00_init.sql
psql -h localhost -U postgres -d taskflow_sql -f db/08_checks.sql
```

## Проверка прав report_user

```bash
psql -h localhost -U report_user -d taskflow_sql -c "SELECT count(*) FROM lib.v_task_details;"
psql -h localhost -U report_user -d taskflow_sql \
  -c "INSERT INTO lib.tasks (title, project_id) VALUES ('forbidden', 1);"
# ERROR: permission denied for table tasks
```

## Требования

- PostgreSQL 15+;
- запуск `00_init.sql` от суперпользователя (создание ролей и БД);
- кодировка UTF8, схема `lib`, `search_path = lib, public`.
