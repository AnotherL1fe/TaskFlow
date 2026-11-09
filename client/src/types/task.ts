export type TaskStatus = 'NEW' | 'IN_PROGRESS' | 'DONE';

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number;
  deadline: string | null;
  projectId: number;
  assigneeId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: number;
  title: string;
  ownerId: number;
  isArchived: boolean;
}

export interface TaskCreateDto {
  title: string;
  description?: string;
  priority: number;
  deadline?: string;
  projectId: number;
  assigneeId?: number;
}

export interface PaginatedTasks {
  items: Task[];
  total: number;
  page: number;
  limit: number;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: 'ADMIN' | 'USER';
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}
