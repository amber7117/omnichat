import type { NextFunction, Response } from 'express';
import crypto from 'crypto';
import { env } from '../../../config/env';
import { prisma } from '../../../db/prisma';
import { handleInboundMessage } from '../../inbound/dispatcher';
import { logger } from '../../../utils/logger';
import type { AuthedRequest } from '../../../types/http';

export const FacebookController = {
  async verify(req: AuthedRequest, res: Response): Promise<void> {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === env.FACEBOOK_VERIFY_TOKEN) {
      res.status(200).send(challenge);
      return;
    }
    res.sendStatus(403);
  },

  async webhook(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (env.FACEBOOK_APP_SECRET) {
        const signature = req.header('x-hub-signature-256');
        if (!validateSignature(req.rawBody as Buffer | undefined, env.FACEBOOK_APP_SECRET, signature)) {
          logger.warn('Facebook webhook signature validation failed');
          res.sendStatus(401);
          return;
        }
      }

      const body = req.body;
      if (!body?.object || body.object !== 'page') {
        res.sendStatus(404);
        return;
      }

      const entries = body.entry ?? [];

      for (const entry of entries) {
        const pageId: string | undefined = entry.id;
        if (!pageId) continue;

        const channel = await prisma.channelInstance.findFirst({
          where: { type: 'FACEBOOK', externalId: pageId },
        });
        if (!channel) {
          logger.warn({ pageId }, 'No channel instance for Facebook page');
          continue;
        }

        const messagingEvents = entry.messaging ?? [];
        for (const event of messagingEvents) {
          const senderId: string | undefined = event.sender?.id;
          const recipientId: string | undefined = event.recipient?.id;
          const text: string | undefined = event.message?.text;
          if (!senderId || !recipientId) continue;

          const attachments =
            (event.message?.attachments ?? []).map((att: any) => ({
              type: att.type ?? 'file',
              url: att.payload?.url,
              mimeType: att.payload?.mime_type,
              extra: {
                title: att.payload?.title,
                stickerId: att.payload?.sticker_id,
                coordinates: att.payload?.coordinates,
              },
            })) ?? [];

          await handleInboundMessage({
            tenantId: channel.tenantId,
            channelInstanceId: channel.id,
            channelType: 'facebook',
            externalUserId: senderId, // PSID
            externalConversationId: recipientId, // page id or thread id if present
            text,
            attachments,
            raw: event,
            timestamp: new Date((event.timestamp ?? Date.now())),
          });
        }
      }

      res.sendStatus(200);
    } catch (err) {
      return next(err as Error);
    }
  },
};

function validateSignature(rawBody: Buffer | undefined, appSecret: string, signatureHeader?: string | null): boolean {
  if (!rawBody || !signatureHeader) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
}
