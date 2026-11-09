import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { UnauthorizedError } from '../errors/app-error';

/** Проверяем не только подпись, но и структуру payload. */
const JwtPayloadSchema = z.object({
  sub: z.string().min(1),
  id: z.number().int().positive(),
  username: z.string().min(1),
  role: z.enum(['ADMIN', 'USER']),
});

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    next(new UnauthorizedError('Authorization header with Bearer token is required'));
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    next(new UnauthorizedError('Bearer token is empty'));
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const payload = JwtPayloadSchema.safeParse(decoded);

    if (!payload.success) {
      next(new UnauthorizedError('Invalid token payload'));
      return;
    }

    req.user = payload.data;
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}
