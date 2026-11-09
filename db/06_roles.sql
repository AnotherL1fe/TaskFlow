-- ============================================================================
-- 06_roles.sql — привилегии ролей (least privilege)
-- Запуск от суперпользователя: psql -d taskflow_db -f db/06_roles.sql
-- ============================================================================
\set ON_ERROR_STOP on

SET search_path TO lib, public;

-- Ничего не отдаём PUBLIC.
REVOKE ALL ON SCHEMA lib FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA lib FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA lib FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA lib FROM PUBLIC;

GRANT USAGE ON SCHEMA lib TO app_user, report_user;

-- Роль приложения: DML на таблицы и последовательности.
GRANT SELECT, INSERT, UPDATE, DELETE
    ON lib.users, lib.projects, lib.tasks, lib.task_status_history
    TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA lib TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA lib TO app_user;

-- Роль отчётности: только чтение. На users — без колонки password_hash.
GRANT SELECT ON lib.projects, lib.tasks, lib.task_status_history TO report_user;
GRANT SELECT (id, username, email, role, is_blocked, created_at)
    ON lib.users TO report_user;
GRANT SELECT ON lib.v_task_details, lib.v_project_stats, lib.v_overdue_tasks
    TO report_user;

-- Подключение к текущей БД: PUBLIC закрыт, доступ только явно выданным ролям.
DO $$
BEGIN
    EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', current_database());
    EXECUTE format(
        'GRANT CONNECT ON DATABASE %I TO taskflow, app_user, report_user',
        current_database()
    );
END
$$;

-- Страховка: у report_user не должно быть прав на изменение данных.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON ALL TABLES IN SCHEMA lib FROM report_user;

\echo '06_roles: app_user (DML), report_user (SELECT only) privileges configured'
