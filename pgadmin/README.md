# Подключение pgAdmin 4 к TaskFlow

В каталоге лежит `servers.json` — описание подключения к локальному PostgreSQL
проекта. Сервер **TaskFlow (local)** уже зарегистрирован в pgAdmin 4 и проверен:
в дереве видны группа **TaskFlow** и все базы контура.

| База               | Назначение                                         |
| ------------------ | -------------------------------------------------- |
| `taskflow_db`      | рабочая БД приложения (миграции Prisma)            |
| `taskflow_sql`     | контур ПМ.11 (представления, функции, аудит, роли) |
| `taskflow_test`    | БД интеграционных тестов Jest                      |
| `taskflow_restore` | результат проверки восстановления из дампа         |

Параметры подключения: `localhost:5432`, пользователь `postgres`, maintenance DB
`postgres`. Локальный кластер запущен с `trust`-аутентификацией, поэтому пароль
не требуется. Для сервера включён флаг «Save Password», чтобы pgAdmin не
показывал диалог пароля при каждом запуске: при `trust` пустой пароль
принимается. Если диалог всё же появился, просто нажмите **OK**, не заполняя
поле.

Если вы переключите кластер на `scram-sha-256` (см. `postgres/pg_hba.conf`),
используйте пароль роли `postgres` или `taskflow` и отметьте **Save Password**
в диалоге подключения.

## Импорт через интерфейс pgAdmin

1. Откройте pgAdmin 4.
2. Меню **Tools → Import/Export Servers**.
3. Вкладка **Import**, файл — `pgadmin/servers.json`.
4. Нажмите **Import**.

## Импорт через CLI (без запущенного pgAdmin)

Закройте pgAdmin. Команде нужен каталог `runtime` в `PATH` — там лежит
`libpq.dll`, без него встроенный Python падает с `no pq wrapper available`.
Затем выполните из каталога `E:\pgAdmin 4\web`:

```bat
set "PATH=E:\pgAdmin 4\runtime;E:\pgAdmin 4\18\bin;%PATH%"
cd /d "E:\pgAdmin 4\web"
"E:\pgAdmin 4\python\python.exe" -s setup.py load-servers ^
  "C:\Users\churk\Desktop\УП Быканов\TaskFlow\pgadmin\servers.json" ^
  --user pgadmin4@pgadmin.org ^
  --sqlite-path "C:\Users\churk\AppData\Roaming\pgAdmin\pgadmin4.db"
```

Ожидаемый вывод:

```text
Loading servers with:
User: pgadmin4@pgadmin.org
SQLite pgAdmin config: C:\Users\churk\AppData\Roaming\pgAdmin\pgadmin4.db
Added 1 Server Group(s) and 1 Server(s).
```

Команда использует штатный механизм импорта pgAdmin и не требует ручного
редактирования `pgadmin4.db`.

## Где хранится конфигурация pgAdmin

- данные и список серверов: `%APPDATA%\pgAdmin\pgadmin4.db`;
- кэш Electron: `%APPDATA%\pgadmin4\`;
- установка: `E:\pgAdmin 4\`.

## Проверка подключения

В дереве pgAdmin выберите **TaskFlow (local) → Databases**. Должны отображаться
`postgres`, `taskflow_db`, `taskflow_sql`, `taskflow_test` и `taskflow_restore`
(всего 5 баз). Эквивалентная проверка из консоли:

```bat
psql -h localhost -p 5432 -U postgres -d postgres -c "\l"
```

Результат проверки в этом окружении: pgAdmin 4 v9.11, сервер `TaskFlow (local)`
подключён, `Databases (5)` — `postgres`, `taskflow_db`, `taskflow_restore`,
`taskflow_sql`, `taskflow_test`.
