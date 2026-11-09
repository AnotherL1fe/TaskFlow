import type { Request, Response } from 'express';
import { UnauthorizedError } from '../errors/app-error';
import type { Actor } from '../services/task.service';
import {
  assignTask,
  changeStatus,
  createTask,
  getOverdueTasks,
  listTasks,
} from '../services/task.service';
import {
  IdParamSchema,
  OverdueQuerySchema,
  TaskListQuerySchema,
  type AssignDto,
  type TaskCreateDto,
  type TaskStatusUpdateDto,
} from '../types/dto';
import { parseOrThrow } from '../utils/parse';

function actorFrom(req: Request): Actor {
  if (!req.user) {
    throw new UnauthorizedError('Authenticated user is missing in request');
  }
  return { id: req.user.id, role: req.user.role };
}

/** GET /api/tasks?page=&limit=&status= */
export async function list(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(TaskListQuerySchema, req.query);
  const result = await listTasks(query, actorFrom(req));
  res.status(200).json(result);
}

/** POST /api/tasks */
export async function create(req: Request, res: Response): Promise<void> {
  const dto = req.body as TaskCreateDto;
  const task = await createTask(dto, actorFrom(req));
  res.status(201).json(task);
}

/** PATCH /api/tasks/:id/status */
export async function updateStatus(req: Request, res: Response): Promise<void> {
  const { id } = parseOrThrow(IdParamSchema, req.params);
  const { status } = req.body as TaskStatusUpdateDto;
  const task = await changeStatus(id, status, actorFrom(req));
  res.status(200).json(task);
}

/** PATCH /api/tasks/:id/assign */
export async function assign(req: Request, res: Response): Promise<void> {
  const { id } = parseOrThrow(IdParamSchema, req.params);
  const { assigneeId } = req.body as AssignDto;
  const task = await assignTask(id, assigneeId, actorFrom(req));
  res.status(200).json(task);
}

/** GET /api/tasks/overdue?projectId= */
export async function overdue(req: Request, res: Response): Promise<void> {
  const { projectId } = parseOrThrow(OverdueQuerySchema, req.query);
  const tasks = await getOverdueTasks(projectId, actorFrom(req));
  res.status(200).json(tasks);
}
