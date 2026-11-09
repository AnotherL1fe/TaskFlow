import type { PaginatedTasks, Task, TaskCreateDto, TaskStatus } from '../types/task';
import { apiRequest } from './http';

export interface GetTasksParams {
  page?: number;
  limit?: number;
  status?: TaskStatus;
}

export function getTasks(params: GetTasksParams = {}): Promise<PaginatedTasks> {
  const search = new URLSearchParams();

  if (params.page !== undefined) {
    search.set('page', String(params.page));
  }
  if (params.limit !== undefined) {
    search.set('limit', String(params.limit));
  }
  if (params.status !== undefined) {
    search.set('status', params.status);
  }

  const query = search.toString();
  return apiRequest<PaginatedTasks>(`/api/tasks${query ? `?${query}` : ''}`);
}

export function createTask(dto: TaskCreateDto): Promise<Task> {
  return apiRequest<Task>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export function updateStatus(id: number, status: TaskStatus): Promise<Task> {
  return apiRequest<Task>(`/api/tasks/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function assignTask(id: number, assigneeId: number): Promise<Task> {
  return apiRequest<Task>(`/api/tasks/${id}/assign`, {
    method: 'PATCH',
    body: JSON.stringify({ assigneeId }),
  });
}
