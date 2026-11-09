-- ============================================================================
-- 05_functions.sql — функции и триггеры
-- ============================================================================
\set ON_ERROR_STOP on

SET ROLE taskflow;
SET search_path TO lib, public;

-- 1. Автоматическое обновление updated_at.
CREATE OR REPLACE FUNCTION lib.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.updated_at := COALESCE(NEW.updated_at, CURRENT_TIMESTAMP);
    ELSE
        NEW.updated_at := CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON lib.tasks;
CREATE TRIGGER trg_tasks_updated_at
    BEFORE INSERT OR UPDATE ON lib.tasks
    FOR EACH ROW
    EXECUTE FUNCTION lib.set_updated_at();

-- 2. Проверка допустимого перехода статуса (та же логика, что в task.service).
CREATE OR REPLACE FUNCTION lib.is_valid_status_transition(
    p_from lib."TaskStatus",
    p_to lib."TaskStatus"
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT p_from = p_to
        OR (p_from = 'NEW' AND p_to IN ('IN_PROGRESS', 'DONE'))
        OR (p_from = 'IN_PROGRESS' AND p_to = 'DONE');
$$;

COMMENT ON FUNCTION lib.is_valid_status_transition(lib."TaskStatus", lib."TaskStatus")
    IS 'Разрешены только переходы NEW -> IN_PROGRESS -> DONE (и NEW -> DONE)';

-- 3. Смена статуса с проверкой перехода и блокировкой строки.
CREATE OR REPLACE FUNCTION lib.change_task_status(
    p_task_id integer,
    p_new_status lib."TaskStatus"
)
RETURNS lib.tasks
LANGUAGE plpgsql
AS $$
DECLARE
    v_current lib."TaskStatus";
    v_task lib.tasks;
BEGIN
    SELECT status INTO v_current
    FROM lib.tasks
    WHERE id = p_task_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task % not found', p_task_id USING ERRCODE = 'P0002';
    END IF;

    IF NOT lib.is_valid_status_transition(v_current, p_new_status) THEN
        RAISE EXCEPTION 'Invalid status transition: % -> %', v_current, p_new_status
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE lib.tasks
    SET status = p_new_status
    WHERE id = p_task_id
    RETURNING * INTO v_task;

    RETURN v_task;
END;
$$;

COMMENT ON FUNCTION lib.change_task_status(integer, lib."TaskStatus")
    IS 'Атомарная смена статуса с контролем жизненного цикла';

-- 4. Назначение исполнителя с проверкой существования и блокировки.
CREATE OR REPLACE FUNCTION lib.assign_task(
    p_task_id integer,
    p_user_id integer
)
RETURNS lib.tasks
LANGUAGE plpgsql
AS $$
DECLARE
    v_task lib.tasks;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM lib.tasks WHERE id = p_task_id) THEN
        RAISE EXCEPTION 'Task % not found', p_task_id USING ERRCODE = 'P0002';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM lib.users WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'User % not found', p_user_id USING ERRCODE = 'P0002';
    END IF;

    IF EXISTS (SELECT 1 FROM lib.users WHERE id = p_user_id AND is_blocked) THEN
        RAISE EXCEPTION 'Blocked user cannot be assigned to a task'
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE lib.tasks
    SET assignee_id = p_user_id
    WHERE id = p_task_id
    RETURNING * INTO v_task;

    RETURN v_task;
END;
$$;

COMMENT ON FUNCTION lib.assign_task(integer, integer)
    IS 'Назначение исполнителя с запретом заблокированных пользователей';

-- 5. Процент завершения проекта.
CREATE OR REPLACE FUNCTION lib.project_progress(p_project_id integer)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        round(
            100.0 * count(*) FILTER (WHERE status = 'DONE') / NULLIF(count(*), 0),
            2
        ),
        0
    )
    FROM lib.tasks
    WHERE project_id = p_project_id;
$$;

COMMENT ON FUNCTION lib.project_progress(integer)
    IS 'Процент завершения проекта: доля задач в статусе DONE';

-- 6. Аудит смены статусов.
CREATE OR REPLACE FUNCTION lib.log_task_status_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO lib.task_status_history (task_id, old_status, new_status)
        VALUES (NEW.id, NULL, NEW.status);
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO lib.task_status_history (task_id, old_status, new_status)
        VALUES (NEW.id, OLD.status, NEW.status);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_status_history ON lib.tasks;
CREATE TRIGGER trg_tasks_status_history
    AFTER INSERT OR UPDATE OF status ON lib.tasks
    FOR EACH ROW
    EXECUTE FUNCTION lib.log_task_status_change();

\echo '05_functions: 6 functions and 2 triggers are ready'
