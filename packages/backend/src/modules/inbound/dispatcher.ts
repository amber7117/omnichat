import { MessageDirection, MessageStatus, Prisma, type ChannelInstance } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { ApiError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import type { InboundMessagePayload } from '../../types';
import { handleAutoReply } from '../agents/agent.service';
import { emitToChannel } from '../../utils/socket';

// Cache for Channel Instances: id -> { instance, expiresAt }
const channelCache = new Map<string, { instance: ChannelInstance; expiresAt: number }>();
const CHANNEL_CACHE_TTL = 60_000 * 5; // 5 minutes

async function getCachedChannelInstance(id: string): Promise<ChannelInstance | null> {
  const cached = channelCache.get(id);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.instance;
  }
  const instance = await prisma.channelInstance.findUnique({ where: { id } });
  if (instance) {
    channelCache.set(id, { instance, expiresAt: Date.now() + CHANNEL_CACHE_TTL });
  }
  return instance;
}

export async function handleInboundMessage(payload: InboundMessagePayload & { providerMessageId?: string }) {
  // 1. Validate Channel (Cached)
  const channelInstance = await getCachedChannelInstance(payload.channelInstanceId);

  if (!channelInstance) {
    throw new ApiError(400, 'Unknown channel instance');
  }

  if (channelInstance.tenantId !== payload.tenantId) {
    throw new ApiError(403, 'Tenant mismatch for inbound message');
  }

  // 2. Idempotency Check (Optimized: Select only ID)
  if (payload.providerMessageId) {
    const existing = await prisma.message.findFirst({
      where: { channelInstanceId: payload.channelInstanceId, providerMessageId: payload.providerMessageId },
      select: { id: true },
    });
    if (existing) {
      logger.debug({ providerMessageId: payload.providerMessageId }, 'Skipping duplicated inbound message');
      return null;
    }
  }

  // 3. Customer & Conversation Resolution (Parallelized)
  // We need customer ID for conversation, so we can't fully parallelize, but we can optimize.
  // Actually, we can try to find conversation by external ID first if available.

  let conversationId: string | undefined;
  let customerId: string | undefined;

  // Try to find conversation by external ID directly (fastest)
  if (payload.externalConversationId) {
    const existingConv = await prisma.conversation.findFirst({
      where: {
        tenantId: payload.tenantId,
        channelInstanceId: payload.channelInstanceId,
        externalConversationId: payload.externalConversationId,
      },
      select: { id: true, customerId: true, autoReplyEnabled: true },
    });
    if (existingConv) {
      conversationId = existingConv.id;
      customerId = existingConv.customerId;
    }
  }

  // If not found, we need to resolve customer
  if (!customerId) {
    const customer = await prisma.customer.upsert({
      where: {
        channelInstanceId_externalId: {
          channelInstanceId: payload.channelInstanceId,
          externalId: payload.externalUserId,
        },
      },
      update: { lastContactedAt: payload.timestamp },
      create: {
        tenantId: payload.tenantId,
        channelInstanceId: payload.channelInstanceId,
        externalId: payload.externalUserId,
        lastContactedAt: payload.timestamp,
      },
      select: { id: true },
    });
    customerId = customer.id;
  }

  // If conversation still not found, find open one or create
  let conversation: { id: string; autoReplyEnabled: boolean; customerId: string } | null = null;

  if (conversationId) {
    // We already found it
    conversation = { id: conversationId, autoReplyEnabled: true, customerId }; // Re-fetch if needed, but we have ID
    // Actually we need the full object or at least autoReplyEnabled.
    // Let's just fetch what we need.
    const c = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, autoReplyEnabled: true, customerId: true, tenantId: true, channelInstanceId: true, externalConversationId: true },
    });
    if (c) conversation = c;
  } else {
    // Find open conversation for customer
    conversation = await prisma.conversation.findFirst({
      where: {
        tenantId: payload.tenantId,
        channelInstanceId: payload.channelInstanceId,
        customerId: customerId,
        status: 'OPEN',
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, autoReplyEnabled: true, customerId: true, tenantId: true, channelInstanceId: true, externalConversationId: true },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          tenantId: payload.tenantId,
          channelInstanceId: payload.channelInstanceId,
          customerId: customerId,
          externalConversationId: payload.externalConversationId,
          status: 'OPEN',
          autoReplyEnabled: true,
        },
        select: { id: true, autoReplyEnabled: true, customerId: true, tenantId: true, channelInstanceId: true, externalConversationId: true },
      });
    }
  }

  if (!conversation) throw new Error('Failed to resolve conversation');

  // 4. Create Message (Critical Path)
  const message = await prisma.message.create({
    data: {
      tenantId: payload.tenantId,
      conversationId: conversation.id,
      channelInstanceId: payload.channelInstanceId,
      direction: MessageDirection.INBOUND,
      status: MessageStatus.READ,
      text: payload.text,
      attachments: payload.attachments as Prisma.InputJsonValue | undefined,
      rawPayload: payload.raw as Prisma.InputJsonValue,
      externalSenderId: payload.externalUserId,
      sentAt: payload.timestamp,
      providerMessageId: payload.providerMessageId,
    },
  });

  // 5. Async Updates (Fire and Forget)
  // Update conversation lastMessageAt
  prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: payload.timestamp },
  }).catch(err => logger.error({ err }, 'Failed to update conversation lastMessageAt'));

  // Emit events
  emitToChannel(payload.channelInstanceId, 'message-created', {
    channelInstanceId: payload.channelInstanceId,
    channelType: channelInstance.type,
    conversationId: conversation.id,
    message,
  });
  
  // We can skip emitting conversation-updated for every message if not strictly needed, or debounce it.
  // But for now keep it.
  // emitToChannel(...)

  logger.info(
    {
      conversationId: conversation.id,
      channelInstanceId: payload.channelInstanceId,
      tenantId: payload.tenantId,
    },
    'Inbound message stored'
  );

  // 6. Trigger Auto-Reply
  try {
    if (conversation.autoReplyEnabled !== false) {
      // We need full objects for handleAutoReply, but we can optimize that function too.
      // For now, we construct what's needed.
      // We need to fetch the full customer object? handleAutoReply uses customer.externalId.
      // We have customerId.
      const fullCustomer = await prisma.customer.findUnique({ where: { id: conversation.customerId } });
      const fullConversation = await prisma.conversation.findUnique({ where: { id: conversation.id } });

      if (fullCustomer && fullConversation) {
        await handleAutoReply({
          payload,
          customer: fullCustomer,
          conversation: fullConversation,
          message,
          channelMeta: channelInstance.metadata as Record<string, unknown> | null,
        });
      }
    } else {
      logger.debug({ conversationId: conversation.id }, 'Auto-reply disabled for this conversation');
    }
  } catch (err) {
    logger.error({ err, conversationId: conversation.id }, 'Auto-reply failed');
  }

  return { conversation, message };
}

