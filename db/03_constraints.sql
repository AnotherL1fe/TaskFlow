-- ============================================================================
-- 03_constraints.sql — внешние ключи и CHECK-ограничения
-- ============================================================================
\set ON_ERROR_STOP on

SET ROLE taskflow;
SET search_path TO lib, public;

DO $$
BEGIN
  -- Внешние ключи (имена совпадают с миграцией Prisma).
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'projects_owner_id_fkey'
      AND conrelid = 'lib.projects'::regclass
  ) THEN
    ALTER TABLE lib.projects
      ADD CONSTRAINT projects_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES lib.users (id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tasks_project_id_fkey'
      AND conrelid = 'lib.tasks'::regclass
  ) THEN
    ALTER TABLE lib.tasks
      ADD CONSTRAINT tasks_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES lib.projects (id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tasks_assignee_id_fkey'
      AND conrelid = 'lib.tasks'::regclass
  ) THEN
    ALTER TABLE lib.tasks
      ADD CONSTRAINT tasks_assignee_id_fkey
      FOREIGN KEY (assignee_id) REFERENCES lib.users (id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'task_status_history_task_id_fkey'
      AND conrelid = 'lib.task_status_history'::regclass
  ) THEN
    ALTER TABLE lib.task_status_history
      ADD CONSTRAINT task_status_history_task_id_fkey
      FOREIGN KEY (task_id) REFERENCES lib.tasks (id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- Доменные ограничения.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_username_len_chk' AND conrelid = 'lib.users'::regclass
  ) THEN
    ALTER TABLE lib.users
      ADD CONSTRAINT users_username_len_chk
      CHECK (char_length(btrim(username)) BETWEEN 3 AND 50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_email_format_chk' AND conrelid = 'lib.users'::regclass
  ) THEN
    ALTER TABLE lib.users
      ADD CONSTRAINT users_email_format_chk
      CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'projects_title_not_blank_chk' AND conrelid = 'lib.projects'::regclass
  ) THEN
    ALTER TABLE lib.projects
      ADD CONSTRAINT projects_title_not_blank_chk
      CHECK (char_length(btrim(title)) BETWEEN 1 AND 200);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tasks_title_not_blank_chk' AND conrelid = 'lib.tasks'::regclass
  ) THEN
    ALTER TABLE lib.tasks
      ADD CONSTRAINT tasks_title_not_blank_chk
      CHECK (char_length(btrim(title)) BETWEEN 1 AND 200);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tasks_priority_chk' AND conrelid = 'lib.tasks'::regclass
  ) THEN
    ALTER TABLE lib.tasks
      ADD CONSTRAINT tasks_priority_chk
      CHECK (priority BETWEEN 1 AND 5);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tasks_description_len_chk' AND conrelid = 'lib.tasks'::regclass
  ) THEN
    ALTER TABLE lib.tasks
      ADD CONSTRAINT tasks_description_len_chk
      CHECK (description IS NULL OR char_length(description) <= 2000);
  END IF;
END
$$;

\echo '03_constraints: foreign keys and check constraints are ready'
