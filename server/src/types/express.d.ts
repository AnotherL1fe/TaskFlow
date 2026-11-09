import type { JwtPayload } from 'jsonwebtoken';

/**
 * Полезная нагрузка JWT, которую кладёт auth.controller.
 * sub — стандартное строковое поле JWT (id пользователя).
 */
export interface AuthPayload extends JwtPayload {
  sub: string;
  id: number;
  username: string;
  role: 'ADMIN' | 'USER';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}
