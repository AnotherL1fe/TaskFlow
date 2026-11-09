import { useState } from 'react';
import type { Task, TaskStatus } from '../types/task';
import { TaskItem } from './TaskItem';

interface TaskListProps {
  tasks: Task[];
  onChangeStatus: (id: number, status: TaskStatus) => void;
}

type Filter = TaskStatus | 'ALL';

const FILTERS: ReadonlyArray<{ value: Filter; label: string }> = [
  { value: 'ALL', label: 'Все' },
  { value: 'NEW', label: 'Новые' },
  { value: 'IN_PROGRESS', label: 'В работе' },
  { value: 'DONE', label: 'Готовые' },
];

export function TaskList({ tasks, onChangeStatus }: TaskListProps): JSX.Element {
  const [filter, setFilter] = useState<Filter>('ALL');

  const visible = filter === 'ALL' ? tasks : tasks.filter((task) => task.status === filter);

  return (
    <section className="task-list">
      <div className="list-head">
        <h2>Задачи</h2>
        <label className="filter">
          <span>Фильтр</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
            {FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {tasks.length === 0 ? (
        <p className="empty">Задач пока нет — создайте первую.</p>
      ) : visible.length === 0 ? (
        <p className="empty">В этом статусе задач нет.</p>
      ) : (
        <div className="task-grid">
          {visible.map((task) => (
            <TaskItem key={task.id} task={task} onChangeStatus={onChangeStatus} />
          ))}
        </div>
      )}
    </section>
  );
}
