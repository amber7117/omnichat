import type { Response, NextFunction } from 'express';
import { z } from 'zod';
import { getProfile, login, refreshSession, register } from './auth.service';
import type { AuthedRequest } from '../../types/http';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  tenantName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const AuthController = {
  async register(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = registerSchema.parse(req.body);
      const result = await register(body);
      res.status(201).json(result);
    } catch (err) {
      return next(err as Error);
    }
  },

  async login(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = loginSchema.parse(req.body);
      const result = await login(body);
      res.json(result);
    } catch (err) {
      return next(err as Error);
    }
  },

  async refresh(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = refreshSchema.parse(req.body);
      const result = await refreshSession(body.refreshToken);
      res.json(result);
    } catch (err) {
      return next(err as Error);
    }
  },

  async me(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const profile = await getProfile(req.auth.userId);
      res.json({ user: profile, tenantId: req.auth.tenantId });
    } catch (err) {
      return next(err as Error);
    }
  },
};
