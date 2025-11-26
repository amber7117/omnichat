import type { Response, NextFunction } from 'express';
import { z } from 'zod';
import { ChannelType } from '@prisma/client';
import { createChannelInstance, listChannelInstances, getChannelInstance } from './channel.service';
import { createWhatsAppSocket } from './whatsapp';
import type { AuthedRequest } from '../../types/http';
import { prisma } from '../../db/prisma';

const createSchema = z.object({
  name: z.string().min(2),
  type: z.string(),
  metadata: z.record(z.any()).optional(),
  config: z.record(z.any()).optional(),
  externalId: z.string().optional(),
});

export const ChannelController = {
  async create(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      // Check subscription limits
      // const tenant = await prisma.tenant.findUnique({
      //   where: { id: req.auth.tenantId },
      //   include: { channelInstances: true },
      // });

      // if (!tenant) {
      //   res.status(404).json({ message: 'Tenant not found' });
      //   return;
      // }

      // TODO: Add maxChannels property to Tenant model
      // if (tenant.channelInstances.length >= tenant.maxChannels) {
      //   res.status(403).json({
      //     message: 'Channel limit reached. Please upgrade your plan to add more channels.',
      //     code: 'LIMIT_REACHED',
      //     current: tenant.channelInstances.length,
      //     max: tenant.maxChannels,
      //   });
      //   return;
      // }

      const body = createSchema.parse(req.body);
      const channel = await createChannelInstance(req.auth.tenantId, {
        ...body,
        type: body.type as ChannelType,
      });
      res.status(201).json(channel);
    } catch (err) {
      return next(err as Error);
    }
  },

  async getAgentBinding(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const id = req.params.id;
      const channel = await getChannelInstance(req.auth.tenantId, id);
      const binding = (channel.metadata as any)?.agentBinding || null;
      res.json({ ok: true, binding });
    } catch (err) {
      return next(err as Error);
    }
  },

  async updateAgentBinding(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const id = req.params.id;
      const channel = await getChannelInstance(req.auth.tenantId, id);
      const body = req.body as { agentId?: string; behavior?: string; autoReply?: boolean };

      const currentMeta = (channel.metadata as Record<string, unknown> | null) || {};
      const nextMeta = {
        ...currentMeta,
        agentBinding: {
          agentId: body.agentId,
          behavior: body.behavior,
          autoReply: body.autoReply ?? false,
        },
      };

      await prisma.channelInstance.update({
        where: { id: channel.id },
        data: { metadata: nextMeta as any },
      });

      res.json({ ok: true, binding: nextMeta.agentBinding });
    } catch (err) {
      return next(err as Error);
    }
  },

  async list(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const channels = await listChannelInstances(req.auth.tenantId);
      res.json(channels);
    } catch (err) {
      return next(err as Error);
    }
  },

  async startWhatsApp(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const id = req.params.id;
      const channel = await getChannelInstance(req.auth.tenantId, id);
      if (channel.type !== 'WHATSAPP') {
        res.status(400).json({ message: 'Channel is not WhatsApp' });
        return;
      }
      createWhatsAppSocket(channel.id, channel.tenantId).catch((err) => {
        console.error(err);
      });
      res.json({ status: 'starting' });
    } catch (err) {
      return next(err as Error);
    }
  },

  async delete(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const id = req.params.id;
      await import('./channel.service').then((m) => m.deleteChannelInstance(req.auth!.tenantId, id));
      res.json({ ok: true });
    } catch (err) {
      return next(err as Error);
    }
  },

  async getLimits(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.auth.tenantId },
        include: { channelInstances: true },
      });

      if (!tenant) {
        res.status(404).json({ message: 'Tenant not found' });
        return;
      }

      res.json({
        currentChannels: tenant.channelInstances.length,
        // TODO: Add maxChannels and subscriptionPlan properties to Tenant model
        // maxChannels: tenant.maxChannels,
        // subscriptionPlan: tenant.subscriptionPlan,
      });
    } catch (err) {
      return next(err as Error);
    }
  },
};
