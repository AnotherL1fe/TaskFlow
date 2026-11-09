import type { ErrorRequestHandler } from 'express';
import { AppError } from '../errors/app-error';
import { logger } from '../utils/logger';

/**
 * Единый формат ошибок: { error: string }.
 * Последний middleware в цепочке; 4 аргумента обязательны для Express.
 */
export const errorMiddleware: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  // Ошибка express.json() при битом JSON.
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Invalid JSON payload' });
    return;
  }

  logger.error('Unhandled request error', {
    method: req.method,
    path: req.originalUrl,
    error: err,
  });

  res.status(500).json({ error: 'Internal server error' });
};
