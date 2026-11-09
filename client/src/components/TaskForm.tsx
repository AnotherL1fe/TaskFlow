import { useState, type FormEvent } from 'react';
import { errorMessage } from '../api/http';
import { createTask } from '../api/taskApi';
import type { Task, TaskCreateDto } from '../types/task';

interface TaskFormProps {
  onCreated: (task: Task) => void;
}

interface FormState {
  title: string;
  description: string;
  priority: number;
  deadline: string;
  projectId: string;
}

const INITIAL_STATE: FormState = {
  title: '',
  description: '',
  priority: 3,
  deadline: '',
  projectId: '1',
};

export function TaskForm({ onCreated }: TaskFormProps): JSX.Element {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    const title = form.title.trim();
    if (title.length === 0) {
      setError('Название задачи обязательно');
      return;
    }

    const projectId = Number(form.projectId);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      setError('Укажите корректный ID проекта');
      return;
    }

    const dto: TaskCreateDto = {
      title,
      priority: form.priority,
      projectId,
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      ...(form.deadline ? { deadline: new Date(form.deadline).toISOString() } : {}),
    };

    setBusy(true);
    try {
      const task = await createTask(dto);
      onCreated(task);
      setForm((previous) => ({ ...INITIAL_STATE, projectId: previous.projectId }));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card task-form" onSubmit={(event) => void handleSubmit(event)}>
      <h2>Новая задача</h2>

      <label className="field">
        <span>Название *</span>
        <input
          value={form.title}
          onChange={(event) => update('title', event.target.value)}
          maxLength={200}
          placeholder="Например, подготовить отчёт"
          required
        />
      </label>

      <label className="field">
        <span>Описание</span>
        <textarea
          value={form.description}
          onChange={(event) => update('description', event.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Детали задачи (необязательно)"
        />
      </label>

      <div className="row">
        <label className="field">
          <span>Приоритет (1–5)</span>
          <select
            value={form.priority}
            onChange={(event) => update('priority', Number(event.target.value))}
          >
            {[1, 2, 3, 4, 5].map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>ID проекта</span>
          <input
            type="number"
            min={1}
            value={form.projectId}
            onChange={(event) => update('projectId', event.target.value)}
            required
          />
        </label>
      </div>

      <label className="field">
        <span>Дедлайн</span>
        <input
          type="datetime-local"
          value={form.deadline}
          onChange={(event) => update('deadline', event.target.value)}
        />
      </label>

      {error && <p className="alert">{error}</p>}

      <button type="submit" className="primary" disabled={busy}>
        {busy ? 'Создаём…' : 'Создать задачу'}
      </button>
    </form>
  );
}
