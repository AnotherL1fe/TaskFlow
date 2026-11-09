-- ============================================================================
-- 01_tables.sql — базовые таблицы и enum-типы (соответствуют Prisma-схеме)
-- Запуск: psql -d taskflow_db -f db/01_tables.sql
-- ============================================================================
\set ON_ERROR_STOP on

CREATE SCHEMA IF NOT EXISTS lib;

SET ROLE taskflow;
SET search_path TO lib, public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'Role' AND n.nspname = 'lib'
  ) THEN
    CREATE TYPE lib."Role" AS ENUM ('ADMIN', 'USER');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'TaskStatus' AND n.nspname = 'lib'
  ) THEN
    CREATE TYPE lib."TaskStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'DONE');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS lib.users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL,
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          lib."Role"   NOT NULL DEFAULT 'USER',
    is_blocked    BOOLEAN      NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lib.projects (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    owner_id    INTEGER      NOT NULL,
    is_archived BOOLEAN      NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS lib.tasks (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    description VARCHAR(2000),
    status      lib."TaskStatus" NOT NULL DEFAULT 'NEW',
    priority    INTEGER      NOT NULL DEFAULT 3,
    deadline    TIMESTAMPTZ(3),
    project_id  INTEGER      NOT NULL,
    assignee_id INTEGER,
    created_at  TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ(3) NOT NULL
);

-- Аудит смены статусов: заполняется триггером из 05_functions.sql.
CREATE TABLE IF NOT EXISTS lib.task_status_history (
    id         BIGSERIAL PRIMARY KEY,
    task_id    INTEGER      NOT NULL,
    old_status lib."TaskStatus",
    new_status lib."TaskStatus" NOT NULL,
    changed_by TEXT         NOT NULL DEFAULT current_user,
    changed_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

\echo '01_tables: users, projects, tasks, task_status_history created'
