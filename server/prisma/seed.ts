import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/db';
import { Role, TaskStatus } from '../src/generated/prisma/enums';

/**
 * Демонстрационные данные TaskFlow.
 * Идемпотентно: повторный запуск (npm run prisma:seed) не создаёт дубликатов
 * и не перезаписывает данные, созданные пользователями через интерфейс.
 */

interface DemoUser {
  username: string;
  email: string;
  password: string;
  role: Role;
  isBlocked: boolean;
}

const DEMO_USERS: DemoUser[] = [
  {
    username: 'ivan',
    email: 'ivan@example.com',
    password: 'secret123',
    role: Role.USER,
    isBlocked: false,
  },
  {
    username: 'petr',
    email: 'petr@example.com',
    password: 'secret123',
    role: Role.USER,
    isBlocked: false,
  },
  {
    username: 'admin',
    email: 'admin@example.com',
    password: 'admin123',
    role: Role.ADMIN,
    isBlocked: false,
  },
  {
    username: 'blocked',
    email: 'blocked@example.com',
    password: 'secret123',
    role: Role.USER,
    isBlocked: true,
  },
  {
    username: 'olga',
    email: 'olga@example.com',
    password: 'secret123',
    role: Role.USER,
    isBlocked: false,
  },
];

interface DemoProject {
  title: string;
  ownerEmail: string;
  isArchived: boolean;
}

const DEMO_PROJECTS: DemoProject[] = [
  { title: 'Внедрение TaskFlow', ownerEmail: 'ivan@example.com', isArchived: false },
  { title: 'Миграция БД', ownerEmail: 'admin@example.com', isArchived: false },
  { title: 'Архив 2025', ownerEmail: 'ivan@example.com', isArchived: true },
  { title: 'Маркетинг', ownerEmail: 'petr@example.com', isArchived: false },
];

interface DemoTask {
  title: string;
  description: string;
  status: TaskStatus;
  priority: number;
  deadlineOffsetDays: number;
  projectTitle: string;
  assigneeEmail: string | null;
}

const DEMO_TASKS: DemoTask[] = [
  {
    title: 'Подготовить техническое задание',
    description: 'Согласовать объём ПМ.02 и ПМ.11',
    status: TaskStatus.DONE,
    priority: 5,
    deadlineOffsetDays: -10,
    projectTitle: 'Внедрение TaskFlow',
    assigneeEmail: 'ivan@example.com',
  },
  {
    title: 'Спроектировать схему БД',
    description: 'Таблицы, связи, ограничения целостности',
    status: TaskStatus.IN_PROGRESS,
    priority: 4,
    deadlineOffsetDays: 5,
    projectTitle: 'Внедрение TaskFlow',
    assigneeEmail: 'petr@example.com',
  },
  {
    title: 'Реализовать REST API',
    description: 'CRUD задач, аутентификация, ошибки',
    status: TaskStatus.NEW,
    priority: 5,
    deadlineOffsetDays: -2,
    projectTitle: 'Внедрение TaskFlow',
    assigneeEmail: 'ivan@example.com',
  },
  {
    title: 'Написать тесты',
    description: 'TC-01…TC-08 и моки интеграций',
    status: TaskStatus.NEW,
    priority: 4,
    deadlineOffsetDays: 10,
    projectTitle: 'Внедрение TaskFlow',
    assigneeEmail: null,
  },
  {
    title: 'Настроить резервное копирование',
    description: 'pg_dump, retention, restore drill',
    status: TaskStatus.IN_PROGRESS,
    priority: 3,
    deadlineOffsetDays: -1,
    projectTitle: 'Внедрение TaskFlow',
    assigneeEmail: 'admin@example.com',
  },
  {
    title: 'Перенести данные в схему lib',
    description: 'Контроль количества строк после миграции',
    status: TaskStatus.DONE,
    priority: 5,
    deadlineOffsetDays: -20,
    projectTitle: 'Миграция БД',
    assigneeEmail: 'admin@example.com',
  },
  {
    title: 'Проверить права report_user',
    description: 'SELECT разрешён, INSERT запрещён',
    status: TaskStatus.IN_PROGRESS,
    priority: 4,
    deadlineOffsetDays: -3,
    projectTitle: 'Миграция БД',
    assigneeEmail: 'admin@example.com',
  },
  {
    title: 'Настроить pg_hba и SSL',
    description: 'scram-sha-256, hostssl, firewall',
    status: TaskStatus.NEW,
    priority: 5,
    deadlineOffsetDays: 2,
    projectTitle: 'Миграция БД',
    assigneeEmail: null,
  },
  {
    title: 'Закрыть отчёт 2025',
    description: 'Архивный проект',
    status: TaskStatus.DONE,
    priority: 2,
    deadlineOffsetDays: -60,
    projectTitle: 'Архив 2025',
    assigneeEmail: 'ivan@example.com',
  },
  {
    title: 'Подготовить рассылку',
    description: 'Текст и сегменты аудитории',
    status: TaskStatus.NEW,
    priority: 3,
    deadlineOffsetDays: 7,
    projectTitle: 'Маркетинг',
    assigneeEmail: 'petr@example.com',
  },
];

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function seedUsers(): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  const hashes = new Map<string, string>();

  for (const user of DEMO_USERS) {
    let passwordHash = hashes.get(user.password);
    if (!passwordHash) {
      passwordHash = await bcrypt.hash(user.password, 10);
      hashes.set(user.password, passwordHash);
    }

    const record = await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        username: user.username,
        email: user.email,
        passwordHash,
        role: user.role,
        isBlocked: user.isBlocked,
      },
    });
    ids.set(user.email, record.id);
  }

  return ids;
}

async function seedProjects(userIds: Map<string, number>): Promise<Map<string, number>> {
  const ids = new Map<string, number>();

  for (const project of DEMO_PROJECTS) {
    const ownerId = userIds.get(project.ownerEmail);
    if (!ownerId) {
      throw new Error(`Не найден владелец проекта: ${project.ownerEmail}`);
    }

    const existing = await prisma.project.findFirst({
      where: { title: project.title, ownerId },
    });
    const record =
      existing ??
      (await prisma.project.create({
        data: { title: project.title, ownerId, isArchived: project.isArchived },
      }));
    ids.set(project.title, record.id);
  }

  return ids;
}

async function seedTasks(
  projectIds: Map<string, number>,
  userIds: Map<string, number>,
): Promise<number> {
  let created = 0;

  for (const task of DEMO_TASKS) {
    const projectId = projectIds.get(task.projectTitle);
    if (!projectId) {
      throw new Error(`Не найден проект задачи: ${task.projectTitle}`);
    }

    const existing = await prisma.task.findFirst({
      where: { title: task.title, projectId },
    });
    if (existing) {
      continue;
    }

    await prisma.task.create({
      data: {
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        deadline: daysFromNow(task.deadlineOffsetDays),
        projectId,
        assigneeId: task.assigneeEmail ? (userIds.get(task.assigneeEmail) ?? null) : null,
      },
    });
    created += 1;
  }

  return created;
}

async function main(): Promise<void> {
  const userIds = await seedUsers();
  const projectIds = await seedProjects(userIds);
  const createdTasks = await seedTasks(projectIds, userIds);

  console.log(
    `Seed готов: пользователей ${userIds.size}, проектов ${projectIds.size}, ` +
      `новых задач ${createdTasks} (всего ${await prisma.task.count()}).`,
  );
  console.log('Демо-вход: ivan@example.com / secret123');
}

main()
  .catch((error: unknown) => {
    console.error('Seed завершился с ошибкой:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
