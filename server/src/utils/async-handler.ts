import type { NextFunction, Request, RequestHandler, Response } from 'express';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Express 4 не ловит отклонённые промисы сам.
 * Оборачиваем async-контроллеры, чтобы ошибки шли в error.middleware.
 */
export function asyncHandler(handler: AsyncRoute): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    void Promise.resolve(handler(req, res, next)).catch(next);
  };
}
