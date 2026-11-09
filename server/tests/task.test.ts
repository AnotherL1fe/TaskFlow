import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/db';
import { NotifierFactory } from '../src/services/notification.service';
import { logger } from '../src/utils/logger';

/**
 * TC-07: Telegram недоступен.
 * Мокаем реализацию Notifier целиком — сеть и реальный бот не нужны.
 */
jest.mock('../src/integrations/telegram.notifier', () => ({
  TelegramNotifier: class {
    async send(): Promise<boolean> {
      return false;
    }
  },
}));

const app = createApp();

function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

let ivanToken = '';
let adminToken = '';
let ivanId = 0;
let petrId = 0;
let projectId = 0;
let foreignProjectId = 0;

async function login(email: string): Promise<string> {
  const response = await request(app).post('/api/login').send({ email, password: 'secret123' });

  expect(response.status).toBe(200);
  return response.body.token as string;
}

beforeAll(async () => {
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('secret123', 4);

  const ivan = await prisma.user.create({
    data: { username: 'ivan', email: 'ivan@example.com', passwordHash },
  });
  const petr = await prisma.user.create({
    data: { username: 'petr', email: 'petr@example.com', passwordHash, isBlocked: true },
  });
  const admin = await prisma.user.create({
    data: { username: 'admin', email: 'admin@example.com', passwordHash, role: 'ADMIN' },
  });

  ivanId = ivan.id;
  petrId = petr.id;

  const project = await prisma.project.create({
    data: { title: 'Open project', ownerId: ivan.id },
  });
  const foreign = await prisma.project.create({
    data: { title: 'Admin project', ownerId: admin.id },
  });

  projectId = project.id;
  foreignProjectId = foreign.id;

  ivanToken = await login('ivan@example.com');
  adminToken = await login('admin@example.com');
});

beforeEach(async () => {
  await prisma.task.deleteMany();
  process.env.NOTIFIER = 'console';
  NotifierFactory.reset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  process.env.NOTIFIER = 'console';
  NotifierFactory.reset();
});

describe('Tasks API', () => {
  it('TC-01: создание валидной задачи -> 201', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set(auth(ivanToken))
      .send({
        title: 'Write report',
        description: 'Quarterly report',
        priority: 2,
        deadline: new Date(Date.now() + 86_400_000).toISOString(),
        projectId,
        assigneeId: ivanId,
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: expect.any(Number),
      title: 'Write report',
      status: 'NEW',
      priority: 2,
      projectId,
      assigneeId: ivanId,
    });

    const stored = await prisma.task.findUnique({ where: { id: response.body.id } });
    expect(stored).not.toBeNull();
  });

  it('TC-02: пустой title -> 400', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set(auth(ivanToken))
      .send({ title: '', priority: 2, projectId });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
    expect(response.body.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'title' })]),
    );
  });

  it('TC-03: title длиной 201 символ -> 400 (граница)', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set(auth(ivanToken))
      .send({ title: 'a'.repeat(201), priority: 2, projectId });

    expect(response.status).toBe(400);
    expect(response.body.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'title' })]),
    );
  });

  it('TC-04: назначение заблокированному пользователю -> 403', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .set(auth(ivanToken))
      .send({ title: 'Assignment test', priority: 2, projectId });

    const response = await request(app)
      .patch(`/api/tasks/${created.body.id}/assign`)
      .set(auth(ivanToken))
      .send({ assigneeId: petrId });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/blocked/i);

    const stored = await prisma.task.findUnique({ where: { id: created.body.id } });
    expect(stored?.assigneeId).toBeNull();
  });

  it('TC-05: NEW -> DONE -> 200', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .set(auth(ivanToken))
      .send({ title: 'Status test', priority: 3, projectId });

    const response = await request(app)
      .patch(`/api/tasks/${created.body.id}/status`)
      .set(auth(ivanToken))
      .send({ status: 'DONE' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('DONE');
  });

  it('TC-06: overdue возвращает только просроченные и не DONE', async () => {
    const now = Date.now();
    await prisma.task.createMany({
      data: [
        {
          title: 'Overdue NEW',
          priority: 1,
          projectId,
          status: 'NEW',
          deadline: new Date(now - 3_600_000),
        },
        {
          title: 'Overdue IN_PROGRESS',
          priority: 1,
          projectId,
          status: 'IN_PROGRESS',
          deadline: new Date(now - 86_400_000),
        },
        {
          title: 'Future',
          priority: 1,
          projectId,
          status: 'NEW',
          deadline: new Date(now + 86_400_000),
        },
        {
          title: 'Done overdue',
          priority: 1,
          projectId,
          status: 'DONE',
          deadline: new Date(now - 86_400_000),
        },
      ],
    });

    const response = await request(app)
      .get(`/api/tasks/overdue?projectId=${projectId}`)
      .set(auth(ivanToken));

    expect(response.status).toBe(200);
    const titles = (response.body as Array<{ title: string }>).map((task) => task.title).sort();
    expect(titles).toEqual(['Overdue IN_PROGRESS', 'Overdue NEW']);
  });

  it('TC-07: Telegram недоступен -> задача создана, в логе ERROR', async () => {
    const errorSpy = jest.spyOn(logger, 'error');
    process.env.NOTIFIER = 'telegram';
    NotifierFactory.reset();

    const response = await request(app)
      .post('/api/tasks')
      .set(auth(ivanToken))
      .send({ title: 'Task with failed notification', priority: 1, projectId });

    expect(response.status).toBe(201);

    const stored = await prisma.task.findUnique({ where: { id: response.body.id } });
    expect(stored).not.toBeNull();

    expect(errorSpy).toHaveBeenCalledWith(
      'Task notification was not delivered',
      expect.objectContaining({ taskId: response.body.id }),
    );
  });

  it('TC-08: доступ к чужому проекту -> 403', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set(auth(ivanToken))
      .send({ title: 'Foreign task', priority: 1, projectId: foreignProjectId });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/another user project/i);
  });

  it('TC-extra: неизвестный проект -> 404', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set(auth(ivanToken))
      .send({ title: 'No project', priority: 1, projectId: 999_999 });

    expect(response.status).toBe(404);
  });

  it('TC-extra: неизвестный исполнитель -> 404', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .set(auth(ivanToken))
      .send({ title: 'No assignee', priority: 1, projectId });

    const response = await request(app)
      .patch(`/api/tasks/${created.body.id}/assign`)
      .set(auth(ivanToken))
      .send({ assigneeId: 999_999 });

    expect(response.status).toBe(404);
  });

  it('TC-extra: пагинация и фильтр по статусу', async () => {
    await prisma.task.createMany({
      data: Array.from({ length: 5 }, (_, index) => ({
        title: `Paged ${index}`,
        priority: 2,
        projectId,
        status: index < 3 ? ('NEW' as const) : ('DONE' as const),
      })),
    });

    const response = await request(app)
      .get('/api/tasks?page=1&limit=2&status=NEW')
      .set(auth(ivanToken));

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.total).toBe(3);
    expect(response.body.page).toBe(1);
    expect(response.body.limit).toBe(2);
  });

  it('TC-extra: admin видит задачи чужого проекта', async () => {
    await prisma.task.create({
      data: { title: 'Admin visible', priority: 1, projectId: foreignProjectId },
    });

    const response = await request(app).get('/api/tasks').set(auth(adminToken));

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
  });

  it('TC-extra: без токена -> 401', async () => {
    const response = await request(app).get('/api/tasks');
    expect(response.status).toBe(401);
  });
});
