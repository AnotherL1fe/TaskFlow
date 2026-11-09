import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { prisma } from '../src/config/db';

jest.setTimeout(30_000);

/**
 * setupFilesAfterEnv: миграции на тестовой БД + гарантированная очистка.
 * DATABASE_URL уже указывает на DATABASE_URL_TEST (см. setupEnv.ts).
 */
beforeAll(() => {
  const root = path.resolve(__dirname, '..');
  const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');

  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST },
    stdio: 'pipe',
  });
});

afterAll(async () => {
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});
