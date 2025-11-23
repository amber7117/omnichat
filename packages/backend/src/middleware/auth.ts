import type { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from '../utils/errors';
import type { AuthContext } from '../types';
import type { AuthedRequest } from '../types/http';

interface TokenPayload extends jwt.JwtPayload, AuthContext {}

export function authMiddleware(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new ApiError(401, 'Unauthorized');
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    req.auth = {
      userId: payload.userId,
      tenantId: payload.tenantId,
      email: payload.email,
    };
    next();
  } catch (err) {
    throw new ApiError(401, 'Invalid or expired token');
  }
}
