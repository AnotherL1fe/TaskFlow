-- ============================================================================
-- 07_seed.sql — демонстрационные данные
-- Пароли (bcrypt): secret123 — ivan/petr/blocked/olga, admin123 — admin.
-- Скрипт идемпотентен: повторная вставка не создаёт дубликатов.
-- ============================================================================
\set ON_ERROR_STOP on

SET ROLE taskflow;
SET search_path TO lib, public;

INSERT INTO lib.users (id, username, email, password_hash, role, is_blocked) VALUES
    (1, 'ivan', 'ivan@example.com',
     '$2b$10$NWr1/zRRrNxn6mWNzbMrf.ICqF.XakWN1754QP7DrTzZNiBP2B2vm', 'USER', false),
    (2, 'petr', 'petr@example.com',
     '$2b$10$NWr1/zRRrNxn6mWNzbMrf.ICqF.XakWN1754QP7DrTzZNiBP2B2vm', 'USER', false),
    (3, 'admin', 'admin@example.com',
     '$2b$10$tBzWBgDAERJEWxElYrh/HOBTBvQfAb7esnkZlPxdHQ1gJ7QCpGozG', 'ADMIN', false),
    (4, 'blocked', 'blocked@example.com',
     '$2b$10$NWr1/zRRrNxn6mWNzbMrf.ICqF.XakWN1754QP7DrTzZNiBP2B2vm', 'USER', true),
    (5, 'olga', 'olga@example.com',
     '$2b$10$NWr1/zRRrNxn6mWNzbMrf.ICqF.XakWN1754QP7DrTzZNiBP2B2vm', 'USER', false)
ON CONFLICT DO NOTHING;

INSERT INTO lib.projects (id, title, owner_id, is_archived) VALUES
    (1, 'Внедрение TaskFlow', 1, false),
    (2, 'Миграция БД', 3, false),
    (3, 'Архив 2025', 1, true),
    (4, 'Маркетинг', 2, false)
ON CONFLICT DO NOTHING;

INSERT INTO lib.tasks
    (id, title, description, status, priority, deadline, project_id, assignee_id)
VALUES
    (1, 'Подготовить техническое задание', 'Согласовать объём ПМ.02 и ПМ.11',
     'DONE', 5, now() - interval '10 days', 1, 1),
    (2, 'Спроектировать схему БД', 'Таблицы, связи, ограничения целостности',
     'IN_PROGRESS', 4, now() + interval '5 days', 1, 2),
    (3, 'Реализовать REST API', 'CRUD задач, аутентификация, ошибки',
     'NEW', 5, now() - interval '2 days', 1, 1),
    (4, 'Написать тесты', 'TC-01…TC-08 и моки интеграций',
     'NEW', 4, now() + interval '10 days', 1, NULL),
    (5, 'Настроить резервное копирование', 'pg_dump, retention, restore drill',
     'IN_PROGRESS', 3, now() - interval '1 day', 1, 3),
    (6, 'Перенести данные в схему lib', 'Контроль количества строк после миграции',
     'DONE', 5, now() - interval '20 days', 2, 3),
    (7, 'Проверить права report_user', 'SELECT разрешён, INSERT запрещён',
     'IN_PROGRESS', 4, now() - interval '3 days', 2, 3),
    (8, 'Настроить pg_hba и SSL', 'scram-sha-256, hostssl, firewall',
     'NEW', 5, now() + interval '2 days', 2, NULL),
    (9, 'Закрыть отчёт 2025', 'Архивный проект',
     'DONE', 2, now() - interval '60 days', 3, 1),
    (10, 'Подготовить рассылку', 'Текст и сегменты аудитории',
     'NEW', 3, now() + interval '7 days', 4, 2)
ON CONFLICT DO NOTHING;

-- Синхронизация последовательностей с фактическими максимальными id.
SELECT setval(pg_get_serial_sequence('lib.users', 'id'),
              (SELECT max(id) FROM lib.users));
SELECT setval(pg_get_serial_sequence('lib.projects', 'id'),
              (SELECT max(id) FROM lib.projects));
SELECT setval(pg_get_serial_sequence('lib.tasks', 'id'),
              (SELECT max(id) FROM lib.tasks));
SELECT setval(pg_get_serial_sequence('lib.task_status_history', 'id'),
              (SELECT max(id) FROM lib.task_status_history));

\echo '07_seed: 5 users, 4 projects, 10 tasks inserted'
