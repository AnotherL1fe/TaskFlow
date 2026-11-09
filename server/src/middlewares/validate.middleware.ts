import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny } from 'zod';

interface ValidationIssue {
  path: string;
  message: string;
  code: string;
}

/**
 * Фабрика middleware: валидирует тело запроса zod-схемой.
 * При ошибке — 400 и массив issues; при успехе — типизированные данные
 * заменяют req.body (лишние поля отбрасываются/отклоняются схемой).
 */
export function validate(schema: ZodTypeAny): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }));

      res.status(400).json({
        error: 'Validation failed',
        issues,
      });
      return;
    }

    req.body = result.data;
    next();
  };
}
