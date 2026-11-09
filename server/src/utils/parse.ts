import type { z } from 'zod';
import { BadRequestError } from '../errors/app-error';

/**
 * Парсинг с немедленным преобразованием ошибки zod в BadRequestError (400).
 * Используется для query/params, где нет отдельного middleware валидации.
 */
export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'value'}: ${issue.message}`)
      .join('; ');
    throw new BadRequestError(`Validation failed: ${details}`);
  }
  return result.data;
}
