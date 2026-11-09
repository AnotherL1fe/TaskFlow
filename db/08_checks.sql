-- ============================================================================
-- 08_checks.sql — автоматические проверки контура БД
-- Запуск: psql -d taskflow_sql -f db/08_checks.sql
-- Любая неуспешная проверка приводит к исключению и остановке (ON_ERROR_STOP).
-- ============================================================================
\set ON_ERROR_STOP on

SET search_path TO lib, public;

\echo '=== 1. Структурные проверки ==='

DO $$
DECLARE
    v_count integer;
    v_last bigint;
BEGIN
    -- Таблицы.
    IF to_regclass('lib.users') IS NULL
       OR to_regclass('lib.projects') IS NULL
       OR to_regclass('lib.tasks') IS NULL
       OR to_regclass('lib.task_status_history') IS NULL THEN
        RAISE EXCEPTION 'CHECK 01 FAILED: base tables are missing';
    END IF;
    RAISE NOTICE 'PASS 01: tables users, projects, tasks, task_status_history exist';

    -- Индексы.
    SELECT count(*) INTO v_count
    FROM pg_indexes
    WHERE schemaname = 'lib'
      AND indexname IN (
          'users_username_key',
          'users_email_key',
          'projects_owner_id_idx',
          'tasks_project_id_status_idx',
          'tasks_assignee_id_idx',
          'tasks_deadline_idx',
          'task_status_history_task_id_idx'
      );

    IF v_count <> 7 THEN
        RAISE EXCEPTION 'CHECK 02 FAILED: expected 7 indexes, found %', v_count;
    END IF;
    RAISE NOTICE 'PASS 02: 7 indexes exist';

    -- Внешние ключи.
    SELECT count(*) INTO v_count
    FROM pg_constraint
    WHERE connamespace = 'lib'::regnamespace
      AND contype = 'f'
      AND conname IN (
          'projects_owner_id_fkey',
          'tasks_project_id_fkey',
          'tasks_assignee_id_fkey',
          'task_status_history_task_id_fkey'
      );

    IF v_count <> 4 THEN
        RAISE EXCEPTION 'CHECK 03 FAILED: expected 4 foreign keys, found %', v_count;
    END IF;
    RAISE NOTICE 'PASS 03: 4 foreign keys exist';

    -- CHECK-ограничения.
    SELECT count(*) INTO v_count
    FROM pg_constraint
    WHERE connamespace = 'lib'::regnamespace
      AND contype = 'c'
      AND conname IN (
          'users_username_len_chk',
          'users_email_format_chk',
          'projects_title_not_blank_chk',
          'tasks_title_not_blank_chk',
          'tasks_priority_chk',
          'tasks_description_len_chk'
      );

    IF v_count <> 6 THEN
        RAISE EXCEPTION 'CHECK 04 FAILED: expected 6 check constraints, found %', v_count;
    END IF;
    RAISE NOTICE 'PASS 04: 6 check constraints exist';

    -- Представления.
    IF to_regclass('lib.v_task_details') IS NULL
       OR to_regclass('lib.v_project_stats') IS NULL
       OR to_regclass('lib.v_overdue_tasks') IS NULL THEN
        RAISE EXCEPTION 'CHECK 05 FAILED: reporting views are missing';
    END IF;
    RAISE NOTICE 'PASS 05: 3 reporting views exist';

    -- Функции.
    SELECT count(*) INTO v_count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'lib'
      AND p.proname IN (
          'set_updated_at',
          'is_valid_status_transition',
          'change_task_status',
          'assign_task',
          'project_progress',
          'log_task_status_change'
      );

    IF v_count <> 6 THEN
        RAISE EXCEPTION 'CHECK 06 FAILED: expected 6 functions, found %', v_count;
    END IF;
    RAISE NOTICE 'PASS 06: 6 functions exist';

    -- Триггеры.
    SELECT count(*) INTO v_count
    FROM pg_trigger
    WHERE tgrelid = 'lib.tasks'::regclass
      AND NOT tgisinternal
      AND tgname IN ('trg_tasks_updated_at', 'trg_tasks_status_history');

    IF v_count <> 2 THEN
        RAISE EXCEPTION 'CHECK 07 FAILED: expected 2 triggers, found %', v_count;
    END IF;
    RAISE NOTICE 'PASS 07: 2 triggers exist';

    -- Демонстрационные данные.
    IF (SELECT count(*) FROM lib.users) < 5 THEN
        RAISE EXCEPTION 'CHECK 08 FAILED: seed users are missing';
    END IF;
    IF (SELECT count(*) FROM lib.projects) < 4 THEN
        RAISE EXCEPTION 'CHECK 08 FAILED: seed projects are missing';
    END IF;
    IF (SELECT count(*) FROM lib.tasks) < 10 THEN
        RAISE EXCEPTION 'CHECK 08 FAILED: seed tasks are missing';
    END IF;
    RAISE NOTICE 'PASS 08: seed data present (users >= 5, projects >= 4, tasks >= 10)';

    -- Аудит.
    IF (SELECT count(*) FROM lib.task_status_history) < 10 THEN
        RAISE EXCEPTION 'CHECK 09 FAILED: status history is not populated';
    END IF;
    RAISE NOTICE 'PASS 09: task_status_history is populated';

    -- Бизнес-логика переходов.
    IF NOT lib.is_valid_status_transition('NEW', 'DONE') THEN
        RAISE EXCEPTION 'CHECK 10 FAILED: NEW -> DONE must be allowed';
    END IF;
    IF NOT lib.is_valid_status_transition('IN_PROGRESS', 'DONE') THEN
        RAISE EXCEPTION 'CHECK 10 FAILED: IN_PROGRESS -> DONE must be allowed';
    END IF;
    IF lib.is_valid_status_transition('DONE', 'NEW') THEN
        RAISE EXCEPTION 'CHECK 10 FAILED: DONE -> NEW must be forbidden';
    END IF;
    IF lib.is_valid_status_transition('IN_PROGRESS', 'NEW') THEN
        RAISE EXCEPTION 'CHECK 10 FAILED: IN_PROGRESS -> NEW must be forbidden';
    END IF;
    RAISE NOTICE 'PASS 10: status transition rules are correct';

    -- Отчётные значения.
    IF (SELECT count(*) FROM lib.v_overdue_tasks) <> 3 THEN
        RAISE EXCEPTION 'CHECK 11 FAILED: expected 3 overdue tasks';
    END IF;
    IF lib.project_progress(1) <> 20.00 THEN
        RAISE EXCEPTION 'CHECK 11 FAILED: project 1 progress must be 20.00';
    END IF;
    IF EXISTS (
        SELECT 1 FROM lib.v_project_stats
        WHERE completion_percent < 0 OR completion_percent > 100
    ) THEN
        RAISE EXCEPTION 'CHECK 11 FAILED: completion_percent out of range';
    END IF;
    RAISE NOTICE 'PASS 11: reporting views and project_progress return valid data';

    -- CHECK-ограничения действительно работают.
    BEGIN
        INSERT INTO lib.tasks (title, priority, project_id)
        VALUES ('__constraint_check__', 6, 1);
        RAISE EXCEPTION 'CHECK 12 FAILED: priority 6 was accepted';
    EXCEPTION
        WHEN check_violation THEN
            NULL;
    END;

    BEGIN
        INSERT INTO lib.tasks (title, priority, project_id)
        VALUES ('   ', 3, 1);
        RAISE EXCEPTION 'CHECK 12 FAILED: blank title was accepted';
    EXCEPTION
        WHEN check_violation THEN
            NULL;
    END;
    RAISE NOTICE 'PASS 12: check constraints reject invalid priority and blank title';

    -- Привилегии report_user: чтение разрешено, запись запрещена.
    IF NOT has_table_privilege('report_user', 'lib.tasks', 'SELECT') THEN
        RAISE EXCEPTION 'CHECK 13 FAILED: report_user cannot SELECT tasks';
    END IF;
    IF has_table_privilege('report_user', 'lib.tasks', 'INSERT')
       OR has_table_privilege('report_user', 'lib.tasks', 'UPDATE')
       OR has_table_privilege('report_user', 'lib.tasks', 'DELETE') THEN
        RAISE EXCEPTION 'CHECK 13 FAILED: report_user has write privileges';
    END IF;
    IF has_column_privilege('report_user', 'lib.users', 'password_hash', 'SELECT') THEN
        RAISE EXCEPTION 'CHECK 13 FAILED: report_user can read password_hash';
    END IF;
    IF NOT has_column_privilege('report_user', 'lib.users', 'email', 'SELECT') THEN
        RAISE EXCEPTION 'CHECK 13 FAILED: report_user cannot read users.email';
    END IF;
    IF NOT has_database_privilege('report_user', current_database(), 'CONNECT') THEN
        RAISE EXCEPTION 'CHECK 13 FAILED: report_user cannot connect';
    END IF;
    RAISE NOTICE 'PASS 13: report_user has SELECT only and no access to password_hash';

    -- Роль приложения.
    IF NOT has_table_privilege('app_user', 'lib.tasks', 'INSERT')
       OR NOT has_table_privilege('app_user', 'lib.tasks', 'SELECT') THEN
        RAISE EXCEPTION 'CHECK 14 FAILED: app_user privileges are incomplete';
    END IF;
    RAISE NOTICE 'PASS 14: app_user has DML privileges on tasks';

    -- Последовательности не отстают от данных.
    SELECT last_value INTO v_last FROM lib.users_id_seq;
    IF v_last < (SELECT max(id) FROM lib.users) THEN
        RAISE EXCEPTION 'CHECK 15 FAILED: users_id_seq is behind max(id)';
    END IF;
    SELECT last_value INTO v_last FROM lib.tasks_id_seq;
    IF v_last < (SELECT max(id) FROM lib.tasks) THEN
        RAISE EXCEPTION 'CHECK 15 FAILED: tasks_id_seq is behind max(id)';
    END IF;
    RAISE NOTICE 'PASS 15: sequences are synchronized with data';
END
$$;

\echo ''
\echo '=== 2. Сводка по таблицам ==='
SELECT 'users' AS table_name, count(*) AS rows FROM lib.users
UNION ALL
SELECT 'projects', count(*) FROM lib.projects
UNION ALL
SELECT 'tasks', count(*) FROM lib.tasks
UNION ALL
SELECT 'task_status_history', count(*) FROM lib.task_status_history
ORDER BY table_name;

\echo ''
\echo '=== 3. Распределение задач по статусам ==='
SELECT status, count(*) AS tasks
FROM lib.tasks
GROUP BY status
ORDER BY status;

\echo ''
\echo '=== 4. Просроченные задачи (v_overdue_tasks) ==='
SELECT id, title, status, project_title, assignee_username, deadline::date, overdue_days
FROM lib.v_overdue_tasks
ORDER BY deadline;

\echo ''
\echo '=== 5. Статистика проектов (v_project_stats) ==='
SELECT project_id, project_title, owner_username, total_tasks,
       new_tasks, in_progress_tasks, done_tasks, overdue_tasks, completion_percent
FROM lib.v_project_stats
ORDER BY project_id;

\echo ''
\echo '=== 6. Последние записи аудита ==='
SELECT id, task_id, old_status, new_status, changed_by, changed_at
FROM lib.task_status_history
ORDER BY id DESC
LIMIT 5;

\echo ''
\echo '=== 7. Матрица привилегий ==='
SELECT
    role_name,
    has_table_privilege(role_name, 'lib.tasks', 'SELECT') AS can_select,
    has_table_privilege(role_name, 'lib.tasks', 'INSERT') AS can_insert,
    has_table_privilege(role_name, 'lib.tasks', 'UPDATE') AS can_update,
    has_table_privilege(role_name, 'lib.tasks', 'DELETE') AS can_delete
FROM (VALUES ('app_user'), ('report_user')) AS roles (role_name);

\echo ''
\echo 'ALL CHECKS PASSED'
