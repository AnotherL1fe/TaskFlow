import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

/**
 * Jest setupFiles: выполняется до импорта тестового модуля.
 * Переключаем приложение на тестовую БД ДО того, как config/env.ts
 * прочитает process.env.
 */
const root = path.resolve(__dirname, '..');
const testEnvFile = path.join(root, '.env.test');

if (fs.existsSync(testEnvFile)) {
  dotenv.config({ path: testEnvFile });
} else {
  dotenv.config({ path: path.join(root, '.env') });
}

if (!process.env.DATABASE_URL_TEST) {
  throw new Error('DATABASE_URL_TEST is not configured for tests');
}

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.NODE_ENV = 'test';
