import { Request, Response } from 'express';
import { prisma } from '../../../db/prisma';
import { logger } from '../../../utils/logger';
import { createWechatyBot, stopWechatyBot, getWechatyBot } from './wechaty.service';
import { ChannelType } from '@prisma/client';

interface AuthenticatedRequest extends Request {
  user?: {
    tenantId: string;
    id: string;
  };
}

export class WechatyController {
  static async start(req: Request, res: Response) {
    const { channelInstanceId } = req.params;
    const { tenantId } = (req as AuthenticatedRequest).user!;

    try {
      const instance = await prisma.channelInstance.findUnique({
        where: { id: channelInstanceId, tenantId },
      });

      if (!instance) {
        return res.status(404).json({ error: 'Channel instance not found' });
      }

      if (instance.type !== ChannelType.WECHATY) {
        return res.status(400).json({ error: 'Invalid channel type' });
      }

      // Start the bot (async)
      createWechatyBot(channelInstanceId, tenantId).catch(err => {
        logger.error({ err, channelInstanceId }, 'Failed to start Wechaty bot in background');
      });

      return res.json({ ok: true, message: 'Wechaty bot starting...' });
    } catch (error) {
      logger.error({ error }, 'Failed to start Wechaty bot');
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async stop(req: Request, res: Response) {
    const { channelInstanceId } = req.params;
    const { tenantId } = (req as AuthenticatedRequest).user!;

    try {
      await stopWechatyBot(channelInstanceId);
      return res.json({ ok: true, message: 'Wechaty bot stopped' });
    } catch (error) {
      logger.error({ error }, 'Failed to stop Wechaty bot');
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getStatus(req: Request, res: Response) {
    const { channelInstanceId } = req.params;
    const { tenantId } = (req as AuthenticatedRequest).user!;

    try {
      const instance = await prisma.channelInstance.findUnique({
        where: { id: channelInstanceId, tenantId },
      });

      if (!instance) {
        return res.status(404).json({ error: 'Channel instance not found' });
      }

      const bot = getWechatyBot(channelInstanceId);
      const isLoggedIn = bot?.isLoggedIn || false;
      const user = isLoggedIn ? bot?.currentUser : null;

      return res.json({
        ok: true,
        status: instance.status,
        isLoggedIn,
        user: user ? { name: user.name(), id: user.id } : null,
        qrCode: instance.qrCode,
        qrCodeExpiry: instance.qrCodeExpiry,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get Wechaty status');
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}
