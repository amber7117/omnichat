import { Prisma, MessageDirection, QueueStatus, MessageStatus, type Conversation, type Customer } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { ApiError } from '../../utils/errors';
import { emitToChannel } from '../../utils/socket';

interface SendMessageInput {
  tenantId: string;
  userId: string;
  channelInstanceId: string;
  conversationId?: string;
  customerId?: string;
  text?: string;
  attachments?: Array<{
    type: string;
    url?: string;
    mimeType?: string;
    extra?: Record<string, unknown>;
  }>;
}

export async function sendMessage(input: SendMessageInput) {
  const channel = await prisma.channelInstance.findFirst({
    where: { id: input.channelInstanceId, tenantId: input.tenantId },
  });
  if (!channel) throw new ApiError(404, 'Channel not found');

  let conversation: (Conversation & { customer: Customer }) | null = null;

  if (input.conversationId) {
    conversation = (await prisma.conversation.findFirst({
      where: { id: input.conversationId, tenantId: input.tenantId, channelInstanceId: channel.id },
      include: { customer: true },
    })) as Conversation & { customer: Customer } | null;
  } else if (input.customerId) {
    conversation = (await prisma.conversation.findFirst({
      where: { tenantId: input.tenantId, channelInstanceId: channel.id, customerId: input.customerId, status: 'OPEN' },
      include: { customer: true },
    })) as Conversation & { customer: Customer } | null;
  }

  if (!conversation) {
    throw new ApiError(404, 'Conversation not found');
  }

  const message = await prisma.message.create({
    data: {
      tenantId: input.tenantId,
      conversationId: conversation.id,
      channelInstanceId: channel.id,
      direction: MessageDirection.OUTBOUND,
      status: MessageStatus.QUEUED,
      text: input.text,
      userId: input.userId,
      attachments: input.attachments as Prisma.InputJsonValue | undefined,
    },
  });

  const updatedConversation = await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });

  await prisma.channelMessageQueue.create({
    data: {
      tenantId: input.tenantId,
      channelInstanceId: channel.id,
      messageId: message.id,
      payload: {
        text: input.text,
        externalConversationId: conversation.externalConversationId,
        externalUserId: conversation.customer.externalId,
        attachments: input.attachments,
      } as Prisma.InputJsonValue,
      status: QueueStatus.PENDING,
    },
  });

  emitToChannel(channel.id, 'message-created', {
    channelInstanceId: channel.id,
    conversationId: conversation.id,
    message,
  });
  emitToChannel(channel.id, 'conversation-updated', {
    channelInstanceId: channel.id,
    conversation: updatedConversation,
  });

  return message;
}
