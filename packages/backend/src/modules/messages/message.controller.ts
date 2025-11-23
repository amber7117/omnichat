import type { Response, NextFunction } from 'express';
import { z } from 'zod';
import { sendMessage } from './message.service';
import type { AuthedRequest } from '../../types/http';

const attachmentSchema = z.object({
  type: z.string(),
  url: z.string().url().optional(),
  mimeType: z.string().optional(),
  extra: z.record(z.any()).optional(),
});

const sendSchema = z
  .object({
    channelInstanceId: z.string(),
    conversationId: z.string().optional(),
    customerId: z.string().optional(),
    text: z.string().min(1).optional(),
    attachments: z.array(attachmentSchema).optional(),
  })
  .refine((data) => Boolean(data.text) || (data.attachments && data.attachments.length > 0), {
    message: 'text or attachments required',
  });

export const MessageController = {
  async send(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const body = sendSchema.parse(req.body);
      const message = await sendMessage({
        tenantId: req.auth.tenantId,
        userId: req.auth.userId,
        ...body,
      });
      res.status(201).json(message);
    } catch (err) {
      return next(err as Error);
    }
  },
};
