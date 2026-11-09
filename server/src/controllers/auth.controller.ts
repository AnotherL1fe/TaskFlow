import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { BadRequestError, ForbiddenError, UnauthorizedError } from '../errors/app-error';
import type { User } from '../generated/prisma/client';
import type { LoginDto, RegisterDto } from '../types/dto';

const BCRYPT_ROUNDS = 10;

interface PublicUser {
  id: number;
  username: string;
  email: string;
  role: 'ADMIN' | 'USER';
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  };
}

function signToken(user: User): string {
  return jwt.sign(
    {
      sub: String(user.id),
      id: user.id,
      username: user.username,
      role: user.role,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] },
  );
}

/** POST /api/register — 201 + JWT */
export async function register(req: Request, res: Response): Promise<void> {
  const dto = req.body as RegisterDto;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: dto.username }, { email: dto.email }] },
    select: { id: true },
  });

  if (existing) {
    throw new BadRequestError('Username or email is already taken');
  }

  const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      username: dto.username,
      email: dto.email,
      passwordHash,
    },
  });

  res.status(201).json({ token: signToken(user), user: toPublicUser(user) });
}

/** POST /api/login — 200 + JWT */
export async function login(req: Request, res: Response): Promise<void> {
  const dto = req.body as LoginDto;

  const user = await prisma.user.findUnique({ where: { email: dto.email } });

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
  if (!passwordMatches) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (user.isBlocked) {
    throw new ForbiddenError('User is blocked');
  }

  res.status(200).json({ token: signToken(user), user: toPublicUser(user) });
}
