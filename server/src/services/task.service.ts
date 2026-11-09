import { prisma } from '../config/db';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/app-error';
import type { Task } from '../generated/prisma/client';
import { TaskStatus } from '../generated/prisma/client';
import type { TaskStatusDto } from '../types/dto';
import type { TaskCreateDto } from '../types/dto';
import type { Notifier } from '../integrations/notifier';
import { afterCreateHook, NotifierFactory } from './notification.service';
import type { Project } from '../generated/prisma/client';

export interface Actor {
  id: number;
  role: 'ADMIN' | 'USER';
}

export interface TaskListOptions {
  page: number;
  limit: number;
  status?: TaskStatusDto;
}

export interface PaginatedTasks {
  items: Task[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Разрешены только переходы «вперёд».
 * NEW → IN_PROGRESS → DONE, при этом NEW → DONE допускается
 * (задача выполнена без промежуточного взятия в работу) — см. README.
 */
const ALLOWED_TRANSITIONS: Record<TaskStatusDto, readonly TaskStatusDto[]> = {
  NEW: ['IN_PROGRESS', 'DONE'],
  IN_PROGRESS: ['DONE'],
  DONE: [],
};

function isAdmin(actor: Actor): boolean {
  return actor.role === 'ADMIN';
}

function assertProjectAccess(project: Pick<Project, 'ownerId'>, actor: Actor): void {
  if (!isAdmin(actor) && project.ownerId !== actor.id) {
    throw new ForbiddenError('Access to another user project is forbidden');
  }
}

async function getProjectOrThrow(projectId: number): Promise<Project> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new NotFoundError(`Project ${projectId} not found`);
  }
  return project;
}

export async function createTask(
  dto: TaskCreateDto,
  actor: Actor,
  notifier: Notifier = NotifierFactory.get(),
): Promise<Task> {
  const project = await getProjectOrThrow(dto.projectId);
  assertProjectAccess(project, actor);

  if (dto.assigneeId !== undefined) {
    const assignee = await prisma.user.findUnique({ where: { id: dto.assigneeId } });
    if (!assignee) {
      throw new NotFoundError(`Assignee ${dto.assigneeId} not found`);
    }
    if (assignee.isBlocked) {
      throw new ForbiddenError('Blocked user cannot be assigned to a task');
    }
  }

  const task = await prisma.task.create({
    data: {
      title: dto.title,
      description: dto.description ?? null,
      priority: dto.priority,
      deadline: dto.deadline ?? null,
      projectId: dto.projectId,
      assigneeId: dto.assigneeId ?? null,
    },
  });

  // Observer: уведомление не влияет на результат создания задачи.
  await afterCreateHook(task, notifier);

  return task;
}

export async function assignTask(taskId: number, assigneeId: number, actor: Actor): Promise<Task> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new NotFoundError(`Task ${taskId} not found`);
  }

  const project = await getProjectOrThrow(task.projectId);
  assertProjectAccess(project, actor);

  const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
  if (!assignee) {
    throw new NotFoundError(`Assignee ${assigneeId} not found`);
  }
  if (assignee.isBlocked) {
    throw new ForbiddenError('Blocked user cannot be assigned to a task');
  }

  return prisma.task.update({ where: { id: taskId }, data: { assigneeId } });
}

export async function changeStatus(
  taskId: number,
  status: TaskStatusDto,
  actor: Actor,
): Promise<Task> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new NotFoundError(`Task ${taskId} not found`);
  }

  const project = await getProjectOrThrow(task.projectId);
  const canChange = isAdmin(actor) || project.ownerId === actor.id || task.assigneeId === actor.id;
  if (!canChange) {
    throw new ForbiddenError('Only project owner, assignee or admin can change task status');
  }

  const allowed = ALLOWED_TRANSITIONS[task.status];
  if (!allowed.includes(status)) {
    throw new BadRequestError(`Invalid status transition: ${task.status} -> ${status}`);
  }

  return prisma.task.update({ where: { id: taskId }, data: { status } });
}

export async function getOverdueTasks(projectId: number, actor: Actor): Promise<Task[]> {
  const project = await getProjectOrThrow(projectId);
  assertProjectAccess(project, actor);

  return prisma.task.findMany({
    where: {
      projectId,
      status: { not: TaskStatus.DONE },
      deadline: { lt: new Date() },
    },
    orderBy: { deadline: 'asc' },
  });
}

export async function listTasks(options: TaskListOptions, actor: Actor): Promise<PaginatedTasks> {
  const where: import('../generated/prisma/client').Prisma.TaskWhereInput = {
    ...(options.status ? { status: options.status } : {}),
    ...(isAdmin(actor)
      ? {}
      : {
          OR: [{ project: { ownerId: actor.id } }, { assigneeId: actor.id }],
        }),
  };

  const [items, total] = await prisma.$transaction([
    prisma.task.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    }),
    prisma.task.count({ where }),
  ]);

  return { items, total, page: options.page, limit: options.limit };
}
