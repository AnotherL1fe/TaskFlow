-- ============================================================================
-- 04_views.sql — представления для отчётности и приложения
-- ============================================================================
\set ON_ERROR_STOP on

SET ROLE taskflow;
SET search_path TO lib, public;

-- Детализированный список задач: проект, исполнитель, признак просрочки.
CREATE OR REPLACE VIEW lib.v_task_details AS
SELECT
    t.id,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.deadline,
    t.project_id,
    p.title  AS project_title,
    t.assignee_id,
    u.username AS assignee_username,
    t.created_at,
    t.updated_at,
    COALESCE(t.deadline < now() AND t.status <> 'DONE', false) AS is_overdue,
    CASE
        WHEN t.deadline IS NULL THEN NULL
        ELSE round(EXTRACT(EPOCH FROM (t.deadline - now())) / 86400.0, 1)
    END AS days_left
FROM lib.tasks t
JOIN lib.projects p ON p.id = t.project_id
LEFT JOIN lib.users u ON u.id = t.assignee_id;

COMMENT ON VIEW lib.v_task_details IS
    'Задачи с названием проекта, исполнителем и признаком просрочки';

-- Сводка по проектам: распределение статусов и процент завершения.
CREATE OR REPLACE VIEW lib.v_project_stats AS
SELECT
    p.id AS project_id,
    p.title AS project_title,
    p.owner_id,
    u.username AS owner_username,
    p.is_archived,
    count(t.id) AS total_tasks,
    count(*) FILTER (WHERE t.status = 'NEW') AS new_tasks,
    count(*) FILTER (WHERE t.status = 'IN_PROGRESS') AS in_progress_tasks,
    count(*) FILTER (WHERE t.status = 'DONE') AS done_tasks,
    count(*) FILTER (
        WHERE t.deadline IS NOT NULL AND t.deadline < now() AND t.status <> 'DONE'
    ) AS overdue_tasks,
    CASE
        WHEN count(t.id) = 0 THEN 0
        ELSE round(100.0 * count(*) FILTER (WHERE t.status = 'DONE') / count(t.id), 2)
    END AS completion_percent
FROM lib.projects p
JOIN lib.users u ON u.id = p.owner_id
LEFT JOIN lib.tasks t ON t.project_id = p.id
GROUP BY p.id, p.title, p.owner_id, u.username, p.is_archived;

COMMENT ON VIEW lib.v_project_stats IS
    'Количество задач по статусам и процент завершения по каждому проекту';

-- Просроченные незавершённые задачи.
CREATE OR REPLACE VIEW lib.v_overdue_tasks AS
SELECT
    t.id,
    t.title,
    t.status,
    t.priority,
    t.deadline,
    t.project_id,
    p.title AS project_title,
    t.assignee_id,
    u.username AS assignee_username,
    round(EXTRACT(EPOCH FROM (now() - t.deadline)) / 86400.0, 1) AS overdue_days
FROM lib.tasks t
JOIN lib.projects p ON p.id = t.project_id
LEFT JOIN lib.users u ON u.id = t.assignee_id
WHERE t.deadline IS NOT NULL
  AND t.deadline < now()
  AND t.status <> 'DONE';

COMMENT ON VIEW lib.v_overdue_tasks IS
    'Просроченные задачи, не находящиеся в статусе DONE';

\echo '04_views: v_task_details, v_project_stats, v_overdue_tasks created'
