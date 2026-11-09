import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { env } from './env';

/**
 * В Prisma 7 клиент работает через driver adapter (без Rust query engine).
 * Схема lib задаётся явно, т.к. она отличается от public.
 */
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL }, { schema: 'lib' });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Singleton: при hot-reload (tsx watch) переиспользуем существующий клиент,
 * чтобы не плодить пулы соединений.
 */
export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
