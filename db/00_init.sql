-- ============================================================================
-- 00_init.sql — роли, база данных и схема lib
-- Запуск: psql -h localhost -U postgres -d postgres -v dbname=taskflow_db -f db/00_init.sql
-- Скрипт идемпотентен: повторный запуск не разрушает существующие объекты.
-- ============================================================================
\set ON_ERROR_STOP on

\if :{?dbname}
\else
  \set dbname taskflow_db
\endif

-- Роли создаются от суперпользователя. Пароли приведены для учебного контура,
-- в production должны приходить из секрет-менеджера.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taskflow') THEN
    CREATE ROLE taskflow LOGIN PASSWORD 'taskflow';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'app_user';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'report_user') THEN
    CREATE ROLE report_user LOGIN PASSWORD 'report_user';
  END IF;
END
$$;

-- Создание БД только при отсутствии. Имя экранируется через format('%I').
SELECT format('CREATE DATABASE %I OWNER taskflow ENCODING ''UTF8''', :'dbname')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'dbname')
\gexec

\connect :dbname

CREATE SCHEMA IF NOT EXISTS lib AUTHORIZATION taskflow;

-- Схема public не используется приложением: закрываем её от публичного доступа.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

ALTER DATABASE :"dbname" SET search_path TO lib, public;

\echo '00_init: roles taskflow/app_user/report_user, database and schema lib are ready'
