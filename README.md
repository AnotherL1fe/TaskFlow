# TaskFlow

Учебный full-stack проект: управление проектами и задачами с разграничением доступа,
REST API, React SPA и полноценным контуром администрирования PostgreSQL.

Проект покрывает профессиональные компетенции:

- **ПМ.02** «Осуществление интеграции программных модулей» — ПК 2.1–2.5;
- **ПМ.11** «Разработка, администрирование и защита баз данных» — ПК 11.1–11.6.

## Стек

| Слой           | Технологии                                                                    |
| -------------- | ----------------------------------------------------------------------------- |
| Backend        | Node.js 20+, Express 4, TypeScript 5 (strict), Prisma 7, `@prisma/adapter-pg` |
| БД             | PostgreSQL 15+, схема `lib`, enum-типы, представления, функции, триггеры      |
| Frontend       | React 18, Vite 5, TypeScript, `.tsx`, CSS                                     |
| Валидация      | zod (DTO, query, params, env)                                                 |
| Безопасность   | JWT (HS256), bcryptjs, RBAC, least privilege                                  |
| Тесты          | Jest 30, ts-jest, Supertest, coverage ≥ 70% для `services/`                   |
| Качество       | ESLint 9 (flat config), Prettier, husky, lint-staged                          |
| Интеграции     | axios + OpenWeatherMap, node-telegram-bot-api                                 |
| Инфраструктура | Docker Compose, pg_hba.conf, postgresql.conf, backup/restore, pgAdmin 4       |

## Структура репозитория

```
TaskFlow/
├── backup/                 # backup/restore для Windows и Linux
├── client/                 # React SPA (Vite)
│   └── src/
│       ├── api/            # http, authApi, taskApi
│       ├── components/     # LoginForm, TaskForm, TaskItem, TaskList
│       ├── pages/          # TasksPage
│       ├── types/          # доменные типы
│       ├── App.tsx
│       ├── main.tsx
│       └── styles.css
├── db/                     # SQL-контур ПМ.11: 00_init … 08_checks
├── docs/
│   ├── 01_analysis.md      # анализ, требования, API, архитектура
│   └── 02_security.md      # модель угроз и меры защиты
├── postgres/               # pg_hba.conf, postgresql.conf
├── pgadmin/                # servers.json и инструкция подключения pgAdmin 4
├── server/
│   ├── prisma/             # schema.prisma, миграции, seed.ts
│   ├── src/
│   │   ├── config/         # env, Prisma Client
│   │   ├── controllers/    # auth, task
│   │   ├── errors/         # AppError и наследники
│   │   ├── integrations/   # weather, notifier (console/telegram)
│   │   ├── middlewares/    # auth, validate, error
│   │   ├── routes/
│   │   ├── services/       # бизнес-логика
│   │   ├── types/          # DTO, express.d.ts
│   │   ├── utils/          # logger, async-handler, parse
│   │   ├── app.ts
│   │   └── index.ts
│   └── tests/              # TC-01…TC-08, интеграции, setup
├── docker-compose.yml
├── eslint.config.mjs
├── .prettierrc.json
└── package.json            # lint/format/husky/lint-staged
```

---

## Быстрый старт

### 1. Требования

- Node.js 20+ (проверено на 24);
- npm 10+;
- PostgreSQL 15+ **или** Docker;
- свободные порты `3000` (API), `5173` (Vite), `5432` (PostgreSQL).

### 2. База данных

**Вариант A. Docker (рекомендуется):**

```bash
docker compose up -d
docker compose ps
```

При первом запуске автоматически выполняются `db/00_init.sql`…`db/07_seed.sql`.
Если том уже существовал и нужно пересоздать:

```bash
docker compose down -v
docker compose up -d
```

**Вариант B. Локальный PostgreSQL:**

```bash
psql -h localhost -U postgres -d postgres -v dbname=taskflow_db -f db/00_init.sql
psql -h localhost -U postgres -d taskflow_db -f db/01_tables.sql
# … 02–07 или готовый скрипт:
.\db\apply.ps1 -DbName taskflow_db      # Windows
DB_NAME=taskflow_db ./db/apply.sh       # Linux/macOS
```

Для рабочей БД приложения достаточно миграций Prisma (см. ниже). SQL-контур
`taskflow_sql` с представлениями/аудитом создаётся теми же скриптами.

### 3. Сервер

```bash
cd server
copy .env.example .env      # Windows
cp .env.example .env        # Linux/macOS
npm install
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

`.env` (минимальный набор):

```env
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://taskflow:taskflow@localhost:5432/taskflow_db?schema=lib
JWT_SECRET=change-me-at-least-16-characters
JWT_EXPIRES_IN=1d
NOTIFIER=console
WEATHER_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

API: `http://localhost:3000`, проверка `GET /health`.

### 4. Клиент

```bash
cd client
npm install
npm run dev
```

SPA: `http://localhost:5173`. Vite проксирует `/api` на `http://localhost:3000`.
Демо-пользователи после `npm run prisma:seed` (в `server/`) или `db/07_seed.sql`
(контур ПМ.11): `ivan@example.com` / `secret123`, `admin@example.com` / `admin123`.
Seed идемпотентен — повторный запуск не создаёт дубликатов.

### 5. Инструменты качества

```bash
npm install          # из корня, ставит ESLint/Prettier/husky/lint-staged
npm run lint
npm run format:check
npm run build:server
npm run build:client
```

---

## Приложение (ПМ.02)

### Возможности

- регистрация и вход, JWT, bcrypt, блокировка пользователей;
- проекты и задачи, приоритет 1–5, дедлайн, исполнитель;
- статусная модель `NEW → IN_PROGRESS → DONE` (переходы только вперёд);
- пагинация и фильтр по статусу, выборка просроченных задач;
- разграничение доступа: владелец проекта или `ADMIN`;
- уведомления о создании задачи (Telegram/консоль) без блокировки бизнес-операции;
- погода через OpenWeatherMap: таймаут 5 с, кэш 10 мин, устойчивость к сбоям;
- React SPA: вход/регистрация, создание, фильтр, смена статуса, выход.

### API

| Метод | Путь                              | Доступ    | Успех |
| ----- | --------------------------------- | --------- | ----- |
| GET   | `/health`                         | публичный | 200   |
| POST  | `/api/register`                   | публичный | 201   |
| POST  | `/api/login`                      | публичный | 200   |
| GET   | `/api/tasks?page=&limit=&status=` | JWT       | 200   |
| POST  | `/api/tasks`                      | JWT       | 201   |
| PATCH | `/api/tasks/:id/status`           | JWT       | 200   |
| PATCH | `/api/tasks/:id/assign`           | JWT       | 200   |
| GET   | `/api/tasks/overdue?projectId=`   | JWT       | 200   |

Ошибки: `400` валидация/переход, `401` токен, `403` права/блокировка,
`404` не найдено, `500` внутренняя ошибка. Формат: `{ "error": "..." }`,
для валидации — `{ "error": "Validation failed", "issues": [...] }`.

### Архитектура

```
React SPA → Express routes → controllers → services → Prisma → PostgreSQL
                                   ↘ integrations (weather, telegram)
```

- `controllers` отвечают за HTTP и DTO;
- `services` — бизнес-правила, права, статусы, уведомления;
- `middlewares` — аутентификация, zod-валидация, единая обработка ошибок;
- `config/env.ts` валидирует окружение и не даёт стартовать с невалидным конфигом.

### Тесты

```bash
cd server
npm test -- --coverage
```

- `tests/task.test.ts` — TC-01…TC-08 + пагинация, 401, 403, 404, admin-доступ;
- `tests/integrations.test.ts` — моки axios и Telegram: success, timeout, 401,
  невалидный payload, кэш, TTL, сбой доставки;
- `tests/setupEnv.ts` переключает `DATABASE_URL` на `DATABASE_URL_TEST`;
- `tests/setup.ts` накатывает миграции на тестовую БД и очищает таблицы.

Порог покрытия: `src/services/**` — 70% по statements/branches/functions/lines.

### Качество кода

- ESLint 9 flat config: TypeScript recommended + React Hooks, отдельные globals
  для Node и браузера;
- Prettier: единый стиль, проверка `npm run format:check`;
- husky + lint-staged: перед коммитом ESLint/Prettier для изменённых файлов.

### Соответствие ПК 2.1–2.5

| ПК  | Подтверждение                                                |
| --- | ------------------------------------------------------------ |
| 2.1 | Модульная архитектура, TypeScript strict, DTO и слои         |
| 2.2 | REST API, интеграции weather/Telegram, SPA                   |
| 2.3 | Jest + Supertest, TC-01…TC-08, моки, coverage                |
| 2.4 | Централизованные ошибки, коды 400–500, логирование           |
| 2.5 | README, docs, ESLint/Prettier, husky, воспроизводимый запуск |

---

## Администрирование БД (ПМ.11)

### Контуры БД

| Контур          | Назначение                | Управление                                   |
| --------------- | ------------------------- | -------------------------------------------- |
| `taskflow_db`   | рабочая БД приложения     | миграции Prisma (`server/prisma/migrations`) |
| `taskflow_test` | тестовая БД Jest          | `prisma migrate deploy` в `tests/setup.ts`   |
| `taskflow_sql`  | контур ПМ.11 для проверок | `db/00_init.sql`…`db/07_seed.sql`            |

SQL-контур содержит дополнительные объекты (аудит, представления, роли), поэтому
отделён от Prisma-БД — это исключает drift при `prisma migrate dev`.

### Скрипты

| Файл                    | Содержимое                                                    |
| ----------------------- | ------------------------------------------------------------- |
| `db/00_init.sql`        | роли `taskflow`, `app_user`, `report_user`, БД, схема `lib`   |
| `db/01_tables.sql`      | `users`, `projects`, `tasks`, `task_status_history`           |
| `db/02_indexes.sql`     | 7 индексов, включая частичный по просрочке                    |
| `db/03_constraints.sql` | 4 FK + 6 CHECK-ограничений                                    |
| `db/04_views.sql`       | `v_task_details`, `v_project_stats`, `v_overdue_tasks`        |
| `db/05_functions.sql`   | смена статуса, назначение, прогресс, аудит, `updated_at`      |
| `db/06_roles.sql`       | least privilege: DML для `app_user`, SELECT для `report_user` |
| `db/07_seed.sql`        | 5 пользователей, 4 проекта, 10 задач                          |
| `db/08_checks.sql`      | 15 проверок + отчётные выборки                                |

Применение и проверка:

```bash
psql -h localhost -U postgres -d postgres -v dbname=taskflow_sql -f db/00_init.sql
psql -h localhost -U postgres -d taskflow_sql -f db/01_tables.sql
# … 02–07
psql -h localhost -U postgres -d taskflow_sql -f db/08_checks.sql
```

`db/08_checks.sql` проверяет таблицы, индексы, FK, CHECK, представления, функции,
триггеры, seed-данные, аудит, переходы статусов, привилегии и последовательности.
Любая ошибка останавливает выполнение (`ON_ERROR_STOP`).

### Роли и привилегии

| Роль          | Права                                                      |
| ------------- | ---------------------------------------------------------- |
| `taskflow`    | владелец схемы `lib`                                       |
| `app_user`    | SELECT/INSERT/UPDATE/DELETE + последовательности + функции |
| `report_user` | только SELECT; на `users` — без колонки `password_hash`    |

Проверка:

```bash
psql -h localhost -U report_user -d taskflow_sql -c "SELECT count(*) FROM lib.v_task_details;"
psql -h localhost -U report_user -d taskflow_sql \
  -c "INSERT INTO lib.tasks (title, project_id) VALUES ('forbidden', 1);"
# ERROR: permission denied for table tasks
```

### Резервное копирование

```powershell
$env:PGPASSWORD = 'taskflow'
.\backup\backup.ps1 -DbName taskflow_sql -PgBin 'C:\Program Files\PostgreSQL\15\bin'
.\backup\restore.ps1 -DumpFile .\backups\taskflow_sql-....dump `
  -TargetDb taskflow_restore -CreateDatabase `
  -PgBin 'C:\Program Files\PostgreSQL\15\bin'
```

```bash
DB_NAME=taskflow_sql ./backup/backup.sh
TARGET_DB=taskflow_restore CREATE_DATABASE=1 \
  ./backup/restore.sh backups/taskflow_sql-....dump
```

Скрипты делают custom-дамп (`-Fc -Z 6`), сохраняют роли, проверяют архив
через `pg_restore --list`, восстанавливают с `--clean --if-exists --exit-on-error`
и выводят контрольные количества строк. Retention — 14 дней.

### PostgreSQL и Docker

- `docker-compose.yml` — PostgreSQL 15-alpine, порт только на `127.0.0.1`,
  именованный volume, healthcheck, автозапуск `db/00–07`;
- `postgres/postgresql.conf` — память, WAL, логирование, `scram-sha-256`, TLS-заготовка;
- `postgres/pg_hba.conf` — `hostssl` + `scram-sha-256`, локальные правила и финальный `reject`.

Включение TLS для production: выпустить сертификат, задать `ssl = on`,
`ssl_cert_file`, `ssl_key_file`, оставить в `pg_hba.conf` только `hostssl`.

### Соответствие ПК 11.1–11.6

| ПК   | Подтверждение                                                              |
| ---- | -------------------------------------------------------------------------- |
| 11.1 | Проектирование схемы `lib`, ERD, типы, ограничения целостности             |
| 11.2 | SQL-скрипты 00–08, индексы, представления, функции, триггеры               |
| 11.3 | Роли `app_user`/`report_user`, least privilege, проверка прав              |
| 11.4 | Резервное копирование и восстановление, retention, restore drill           |
| 11.5 | Мониторинг и логирование: `log_min_duration_statement`, аудит статусов     |
| 11.6 | Защита БД: scram-sha-256, pg_hba, TLS-заготовка, отсутствие доступа PUBLIC |

---

## Документация

- [`docs/01_analysis.md`](docs/01_analysis.md) — требования, сценарии, ERD, API, архитектура;
- [`docs/02_security.md`](docs/02_security.md) — угрозы, аутентификация, RBAC, SQL-инъекции,
  роли PostgreSQL, TLS, аудит, OWASP Top 10, чек-лист production;
- [`db/README.md`](db/README.md) — порядок SQL-скриптов и два контура БД;
- [`pgadmin/README.md`](pgadmin/README.md) — подключение pgAdmin 4 к локальному кластеру;
- [`backup/README.md`](backup/README.md) — резервное копирование и восстановление.

## Лицензия

Учебный проект. Код можно использовать в образовательных целях.
