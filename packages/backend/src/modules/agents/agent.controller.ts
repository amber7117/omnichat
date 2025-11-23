import type { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import type { AuthedRequest } from '../../types/http';
import { listAgents, getAgent } from './agent.service';

const agentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  prompt: z.string().optional(),
  apiKey: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  maxTokens: z.number().int().positive().optional(),
  toolConfig: z.record(z.any()).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const AgentController = {
  async list(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const agents = await listAgents(req.auth.tenantId);
      res.json({ ok: true, agents });
    } catch (err) {
      return next(err as Error);
    }
  },

  async create(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const body = agentSchema.parse(req.body);
      const agent = await prisma.agent.create({
        data: {
          tenantId: req.auth.tenantId,
          name: body.name,
          description: body.description,
          provider: body.provider,
          model: body.model,
          prompt: body.prompt,
          apiKey: body.apiKey,
          temperature: body.temperature,
          maxTokens: body.maxTokens,
          toolConfig: body.toolConfig as any,
          status: body.status ?? 'ACTIVE',
        },
      });
      res.status(201).json({ ok: true, agent });
    } catch (err) {
      return next(err as Error);
    }
  },

  async update(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const id = req.params.id;
      const body = agentSchema.partial().parse(req.body);
      const agent = await prisma.agent.update({
        where: { id, tenantId: req.auth.tenantId },
        data: {
          ...body,
          toolConfig: body.toolConfig as any,
        },
      });
      res.json({ ok: true, agent });
    } catch (err) {
      return next(err as Error);
    }
  },

  async remove(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const id = req.params.id;
      await prisma.agent.delete({
        where: { id, tenantId: req.auth.tenantId },
      });
      res.json({ ok: true });
    } catch (err) {
      return next(err as Error);
    }
  },
};
