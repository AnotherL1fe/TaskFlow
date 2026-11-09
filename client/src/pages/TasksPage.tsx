import { useCallback, useEffect, useState } from 'react';
import { ApiError, errorMessage } from '../api/http';
import { getTasks, updateStatus } from '../api/taskApi';
import { TaskForm } from '../components/TaskForm';
import { TaskList } from '../components/TaskList';
import type { Task, TaskStatus } from '../types/task';

interface TasksPageProps {
  onLogout: () => void;
}

export function TasksPage({ onLogout }: TasksPageProps): JSX.Element {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const data = await getTasks({ page: 1, limit: 100 });
      setTasks(data.items);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        onLogout();
        return;
      }
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreated = useCallback((task: Task): void => {
    setTasks((previous) => [task, ...previous]);
  }, []);

  const handleStatusChange = useCallback(
    async (id: number, status: TaskStatus): Promise<void> => {
      setError(null);
      try {
        const updated = await updateStatus(id, status);
        setTasks((previous) => previous.map((task) => (task.id === id ? updated : task)));
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          onLogout();
          return;
        }
        setError(errorMessage(caught));
      }
    },
    [onLogout],
  );

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>TaskFlow</h1>
          <p className="muted">Управление задачами и проектами</p>
        </div>
        <div className="topbar-actions">
          <button type="button" className="secondary" onClick={() => void load()}>
            Обновить
          </button>
          <button type="button" className="link" onClick={onLogout}>
            Выйти
          </button>
        </div>
      </header>

      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}

      <main className="layout">
        <aside>
          <TaskForm onCreated={handleCreated} />
        </aside>

        <div>
          {loading ? (
            <p className="empty">Загружаем задачи…</p>
          ) : (
            <TaskList
              tasks={tasks}
              onChangeStatus={(id, status) => void handleStatusChange(id, status)}
            />
          )}
        </div>
      </main>
    </div>
  );
}
