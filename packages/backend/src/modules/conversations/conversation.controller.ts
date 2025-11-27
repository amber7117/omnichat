import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma';
import type { AuthedRequest } from '../../types/http';

export const ConversationController = {
  async list(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const conversations = await prisma.conversation.findMany({
        where: { tenantId: req.auth.tenantId },
        orderBy: { updatedAt: 'desc' },
        include: {
          customer: true,
          channelInstance: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      const result = conversations.map((conv) => {
        const last = conv.messages?.[0];
        let phoneNumber: string | undefined;
        if (conv.channelInstance.type === 'WHATSAPP' && conv.customer.externalId) {
          // Only extract phone number if it's NOT a group
          if (!conv.customer.externalId.endsWith('@g.us')) {
            phoneNumber = conv.customer.externalId.split('@')[0];
          }
        }

        return {
          id: conv.id,
          channelInstanceId: conv.channelInstanceId,
          channelType: conv.channelInstance.type,
          customer: {
            id: conv.customer.id,
            name: conv.customer.name ?? conv.customer.externalUsername ?? conv.customer.externalId,
            externalId: conv.customer.externalId,
          },
          phoneNumber,
          status: conv.status,
          lastMessageAt: conv.updatedAt,
          autoReplyEnabled: conv.autoReplyEnabled,
          autoReplyAgentId: conv.autoReplyAgentId,
          lastMessage: last
            ? {
                id: last.id,
                text: (last.text as string | null) ?? '',
                direction: last.direction,
                createdAt: last.createdAt,
              }
            : null,
        };
      });

      res.json({ ok: true, conversations: result });
    } catch (err) {
      return next(err as Error);
    }
  },

  async messages(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const id = req.params.id;
      const limit = Math.min(Number(req.query.limit) || 50, 200);

      const conversation = await prisma.conversation.findFirst({
        where: { id, tenantId: req.auth.tenantId },
        include: { channelInstance: true, customer: true },
      });
      if (!conversation) {
        res.status(404).json({ message: 'Conversation not found' });
        return;
      }

      const messages = await prisma.message.findMany({
        where: { conversationId: id, tenantId: req.auth.tenantId },
        orderBy: { createdAt: 'asc' },
        take: limit,
        select: {
          id: true,
          direction: true,
          status: true,
          text: true,
          createdAt: true,
          channelInstanceId: true,
          attachments: true,
          providerMessageId: true,
        },
      });

      res.json({
        ok: true,
        conversation: {
          id: conversation.id,
          channelInstanceId: conversation.channelInstanceId,
          channelType: conversation.channelInstance.type,
          customer: {
            id: conversation.customerId,
            name: conversation.customer.name ?? conversation.customer.externalUsername ?? conversation.customer.externalId,
          },
          autoReplyEnabled: conversation.autoReplyEnabled,
          autoReplyAgentId: conversation.autoReplyAgentId,
        },
        messages,
      });
    } catch (err) {
      return next(err as Error);
    }
  },

  async setAutoReply(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const id = req.params.id;
      const { enabled, agentId } = req.body as { enabled?: boolean; agentId?: string };
      const updated = await prisma.conversation.update({
        where: { id, tenantId: req.auth.tenantId },
        data: {
          autoReplyEnabled: enabled ?? true,
          autoReplyAgentId: agentId,
        },
        select: { id: true, autoReplyEnabled: true, autoReplyAgentId: true },
      });
      res.json({ ok: true, conversation: updated });
    } catch (err) {
      return next(err as Error);
    }
  },
};
