import type { Task, TaskStatus } from '../types/task';

interface TaskItemProps {
  task: Task;
  onChangeStatus: (id: number, status: TaskStatus) => void;
}

interface StatusAction {
  label: string;
  next: TaskStatus;
}

const ACTIONS: Record<TaskStatus, readonly StatusAction[]> = {
  NEW: [
    { label: 'Взять в работу', next: 'IN_PROGRESS' },
    { label: 'Завершить', next: 'DONE' },
  ],
  IN_PROGRESS: [{ label: 'Завершить', next: 'DONE' }],
  DONE: [],
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  NEW: 'Новая',
  IN_PROGRESS: 'В работе',
  DONE: 'Готово',
};

function formatDeadline(value: string | null): string {
  if (!value) {
    return 'без дедлайна';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TaskItem({ task, onChangeStatus }: TaskItemProps): JSX.Element {
  const actions = ACTIONS[task.status];
  const isOverdue =
    task.deadline !== null &&
    task.status !== 'DONE' &&
    new Date(task.deadline).getTime() < Date.now();

  return (
    <article className={`task-item task-${task.status.toLowerCase()}`}>
      <div className="task-head">
        <h3>{task.title}</h3>
        <span className={`badge badge-${task.status.toLowerCase()}`}>
          {STATUS_LABELS[task.status]}
        </span>
      </div>

      {task.description && <p className="task-description">{task.description}</p>}

      <div className="task-meta">
        <span>Приоритет: {task.priority}</span>
        <span className={isOverdue ? 'overdue' : undefined}>
          Дедлайн: {formatDeadline(task.deadline)}
        </span>
        <span>Проект #{task.projectId}</span>
        <span>Исполнитель: {task.assigneeId === null ? 'не назначен' : `#${task.assigneeId}`}</span>
      </div>

      {actions.length > 0 && (
        <div className="task-actions">
          {actions.map((action) => (
            <button
              key={action.next}
              type="button"
              className="secondary"
              onClick={() => onChangeStatus(task.id, action.next)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
