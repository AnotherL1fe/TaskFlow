-- ============================================================================
-- 02_indexes.sql — индексы для выборок и отчётов
-- ============================================================================
\set ON_ERROR_STOP on

SET ROLE taskflow;
SET search_path TO lib, public;

-- Уникальные индексы Prisma-схемы.
CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON lib.users (username);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON lib.users (email);

-- Индексы внешних ключей и типовых фильтров.
CREATE INDEX IF NOT EXISTS projects_owner_id_idx ON lib.projects (owner_id);
CREATE INDEX IF NOT EXISTS tasks_project_id_status_idx ON lib.tasks (project_id, status);
CREATE INDEX IF NOT EXISTS tasks_assignee_id_idx ON lib.tasks (assignee_id);

-- Дополнительные индексы контура ПМ.11:
-- частичный индекс ускоряет отчёт по просроченным задачам,
-- индекс аудита — выборку истории конкретной задачи.
CREATE INDEX IF NOT EXISTS tasks_deadline_idx
    ON lib.tasks (deadline)
    WHERE status <> 'DONE';

CREATE INDEX IF NOT EXISTS task_status_history_task_id_idx
    ON lib.task_status_history (task_id, changed_at DESC);

\echo '02_indexes: 7 indexes are ready'
