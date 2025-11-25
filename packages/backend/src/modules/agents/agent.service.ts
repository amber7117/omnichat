import { Prisma, QueueStatus, type Agent, type Conversation, type Customer, type Message } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { logger } from '../../utils/logger';
import type { InboundMessagePayload } from '../../types';
import { processAgentMessage } from '../../core/agents/agent-orchestrator.service';
import { emitToChannel } from '../../utils/socket';

interface AutoReplyContext {
  payload: InboundMessagePayload;
  message: Message;
  conversation: Conversation;
  customer: Customer;
  channelMeta?: Record<string, unknown> | null;
}

const autoReplyCooldownMs = 5_000; // Reduced cooldown for better UX
const lastAutoReplyMap = new Map<string, number>(); // conversationId -> timestamp

// Simple in-memory cache for agents: tenantId -> { agent, expiresAt }
const agentCache = new Map<string, { agent: Agent; expiresAt: number }>();
const AGENT_CACHE_TTL = 60_000 * 5; // 5 minutes

export async function handleAutoReply(context: AutoReplyContext) {
  if (!context.payload.text) return;

  const lastAt = lastAutoReplyMap.get(context.conversation.id) ?? 0;
  if (Date.now() - lastAt < autoReplyCooldownMs) {
    logger.debug({ conversationId: context.conversation.id }, 'Auto-reply skipped due to cooldown');
    return;
  }

  // 1. Pick Agent (Cached)
  const agent = await getCachedDefaultAgent(context.conversation.tenantId);
  if (!agent) {
    logger.debug({ conversationId: context.conversation.id }, 'No active agent configured; skipping auto-reply');
    return;
  }

  // 2. Fetch Context (Optimized: Select only needed fields)
  const recentMessages = await prisma.message.findMany({
    where: { conversationId: context.conversation.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { direction: true, text: true, createdAt: true },
  });

  // 3. Orchestrate Agent (LLM + MCP)
  const { replyText, toolCalls, newThreadId } = await processAgentMessage({
    tenantId: context.conversation.tenantId,
    agent,
    channelType: context.channelMeta?.type as string || 'unknown',
    channelInstanceId: context.conversation.channelInstanceId,
    conversationId: context.conversation.id,
    customerId: context.customer.id,
    lastMessages: recentMessages.reverse(),
    inboundText: context.payload.text || '',
    inboundTranscription: context.payload.transcription,
    inboundSummary: context.payload.summary,
    context: context.channelMeta ?? undefined,
    openaiThreadId: (context.conversation as any).openaiThreadId,
  });

  if (!replyText) return;

  lastAutoReplyMap.set(context.conversation.id, Date.now());

  // 4. Persist & Send (Parallelize where possible)
  // We create the message first to get an ID
  const outbound = await prisma.message.create({
    data: {
      tenantId: context.conversation.tenantId,
      conversationId: context.conversation.id,
      channelInstanceId: context.conversation.channelInstanceId,
      direction: 'OUTBOUND',
      status: 'QUEUED',
      text: replyText,
      agentId: agent.id,
      rawPayload: toolCalls ? { toolCalls } : undefined,
    },
  });

  // Fire-and-forget non-critical updates to reduce latency
  const updates: Promise<any>[] = [
    prisma.conversation.update({
      where: { id: context.conversation.id },
      data: {
        lastMessageAt: new Date(),
        ...(newThreadId ? { openaiThreadId: newThreadId } : {}),
      },
    }),
    prisma.channelMessageQueue.create({
      data: {
        tenantId: context.conversation.tenantId,
        channelInstanceId: context.conversation.channelInstanceId,
        messageId: outbound.id,
        payload: {
          text: replyText,
          externalConversationId: context.conversation.externalConversationId,
          externalUserId: context.customer.externalId,
          attachments: [],
        },
        status: QueueStatus.PENDING,
      },
    }),
  ];

  Promise.all(updates).catch((err) => {
    logger.error({ err, conversationId: context.conversation.id }, 'Failed to update conversation or queue');
  });

  // Emit socket event immediately
  emitToChannel(context.conversation.channelInstanceId, 'message-created', {
    channelInstanceId: context.conversation.channelInstanceId,
    conversationId: context.conversation.id,
    message: outbound,
  });

  logger.info(
    {
      conversationId: context.conversation.id,
      outboundMessageId: outbound.id,
      agentId: agent.id,
    },
    'Auto-reply generated and enqueued'
  );
}

async function getCachedDefaultAgent(tenantId: string): Promise<Agent | null> {
  const cached = agentCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.agent;
  }

  const agent = await prisma.agent.findFirst({
    where: { tenantId, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  });

  if (agent) {
    agentCache.set(tenantId, { agent, expiresAt: Date.now() + AGENT_CACHE_TTL });
  }
  return agent;
}

export async function listAgents(tenantId: string): Promise<Agent[]> {
  return prisma.agent.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
}

export async function getAgent(tenantId: string, id: string): Promise<Agent | null> {
  return prisma.agent.findFirst({ where: { tenantId, id } });
}
