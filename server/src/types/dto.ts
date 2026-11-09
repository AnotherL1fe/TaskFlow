import { z } from 'zod';

/**
 * DTO-схемы (Data Transfer Object).
 * Единый источник истины для валидации запросов и TypeScript-типов (z.infer).
 */

export const TaskCreateSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'название не может быть пустым')
      .max(200, 'название не длиннее 200 символов'),
    description: z.string().max(2000, 'описание не длиннее 2000 символов').optional(),
    priority: z
      .number()
      .int('приоритет должен быть целым числом')
      .min(1, 'приоритет от 1 до 5')
      .max(5, 'приоритет от 1 до 5'),
    deadline: z.coerce.date({ invalid_type_error: 'некорректная дата' }).optional(),
    projectId: z
      .number()
      .int('идентификатор проекта должен быть целым числом')
      .positive('идентификатор проекта должен быть положительным'),
    assigneeId: z
      .number()
      .int('идентификатор исполнителя должен быть целым числом')
      .positive('идентификатор исполнителя должен быть положительным')
      .optional(),
  })
  .strict();

export type TaskCreateDto = z.infer<typeof TaskCreateSchema>;

export const TaskStatusSchema = z.enum(['NEW', 'IN_PROGRESS', 'DONE'], {
  errorMap: () => ({ message: 'статус должен быть NEW, IN_PROGRESS или DONE' }),
});

export type TaskStatusDto = z.infer<typeof TaskStatusSchema>;

/** Тело PATCH /api/tasks/:id/status */
export const TaskStatusUpdateSchema = z.object({ status: TaskStatusSchema }).strict();

export type TaskStatusUpdateDto = z.infer<typeof TaskStatusUpdateSchema>;

export const AssignSchema = z
  .object({
    assigneeId: z
      .number()
      .int('идентификатор исполнителя должен быть целым числом')
      .positive('идентификатор исполнителя должен быть положительным'),
  })
  .strict();

export type AssignDto = z.infer<typeof AssignSchema>;

export const RegisterSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, 'имя пользователя: минимум 3 символа')
      .max(50, 'имя пользователя: максимум 50 символов')
      .regex(/^[a-zA-Z0-9_.-]+$/, 'имя пользователя может содержать только буквы, цифры, _ . -'),
    email: z.string().trim().toLowerCase().email('некорректный email').max(255),
    password: z
      .string()
      .min(8, 'пароль: минимум 8 символов')
      .max(72, 'пароль: максимум 72 символа (ограничение bcrypt)'),
  })
  .strict();

export type RegisterDto = z.infer<typeof RegisterSchema>;

export const LoginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('некорректный email'),
    password: z.string().min(1, 'введите пароль'),
  })
  .strict();

export type LoginDto = z.infer<typeof LoginSchema>;

/** Query-параметры GET /api/tasks */
export const TaskListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: TaskStatusSchema.optional(),
});

export type TaskListQueryDto = z.infer<typeof TaskListQuerySchema>;

/** Query-параметры GET /api/tasks/overdue */
export const OverdueQuerySchema = z.object({
  projectId: z.coerce
    .number()
    .int('идентификатор проекта должен быть целым числом')
    .positive('идентификатор проекта должен быть положительным'),
});

export type OverdueQueryDto = z.infer<typeof OverdueQuerySchema>;

/** Параметр пути :id */
export const IdParamSchema = z.object({
  id: z.coerce
    .number()
    .int('идентификатор должен быть целым числом')
    .positive('идентификатор должен быть положительным'),
});

export type IdParamDto = z.infer<typeof IdParamSchema>;
