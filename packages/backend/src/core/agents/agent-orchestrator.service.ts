import OpenAI from 'openai';
import { logger } from '../../utils/logger';
import { mcpClient } from '../mcp/mcp-client';
import { prisma } from '../../db/prisma';
import type { Agent, Message } from '@prisma/client';

interface AgentProcessParams {
  tenantId: string;
  agent: Agent;
  channelType: string;
  channelInstanceId: string;
  conversationId: string;
  customerId: string;
  lastMessages: Partial<Message>[]; // recent conversation messages
  inboundText: string;
  inboundTranscription?: string;
  inboundSummary?: string;
  context?: Record<string, any>;
  openaiThreadId?: string | null;
}

export async function processAgentMessage(params: AgentProcessParams): Promise<{ replyText: string | null; toolCalls?: any[]; newThreadId?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.error('Missing OPENAI_API_KEY');
    return { replyText: 'System Error: AI not configured.' };
  }

  const client = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });

  // Check for Knowledge Base
  const knowledgeBase = (params.agent as any).knowledgeBase;
  if (knowledgeBase && knowledgeBase.openaiVectorStoreId) {
    return processWithAssistant(client, params, knowledgeBase.openaiVectorStoreId);
  }

  const model = params.agent.model || process.env.OPENAI_MODEL || 'gpt-4o';

  // 1. Prepare Tools
  const availableTools = await mcpClient.listTools();
  // Filter tools based on agent config if needed
  const tools = availableTools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  // 2. Build Messages
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: params.agent.prompt || 'You are a helpful assistant.',
    },
  ];

  // Add conversation history
  for (const m of params.lastMessages) {
    let content = m.text || '';
    if (m.transcription) content += `\n[Audio Transcription]: ${m.transcription}`;
    if (m.summary) content += `\n[Video Summary]: ${m.summary}`;

    if (content) {
      messages.push({
        role: m.direction === 'OUTBOUND' ? 'assistant' : 'user',
        content: content,
      });
    }
  }

  // Add current user message
  let currentContent = params.inboundText || '';
  if (params.inboundTranscription) currentContent += `\n[Audio Transcription]: ${params.inboundTranscription}`;
  if (params.inboundSummary) currentContent += `\n[Video Summary]: ${params.inboundSummary}`;

  messages.push({
    role: 'user',
    content: currentContent || '(Empty message)',
  });

  let replyText: string | null = null;
  const toolCallsLog: any[] = [];

  try {
    // 3. Main Loop (Handle Tool Calls)
    let iterations = 0;
    const maxIterations = 5;

    while (iterations < maxIterations) {
      const completion = await client.chat.completions.create({
        model,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        temperature: params.agent.temperature ?? 0.7,
      });

      const choice = completion.choices[0];
      const message = choice.message;

      // Add the assistant's response to history
      messages.push(message);

      if (message.tool_calls && message.tool_calls.length > 0) {
        logger.info({ toolCalls: message.tool_calls }, 'Agent requested tool calls');
        toolCallsLog.push(...message.tool_calls);

        // Execute tools
        for (const toolCall of message.tool_calls) {
          const fnName = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);

          logger.info({ fnName, args }, 'Executing MCP tool');
          const result = await mcpClient.callTool(fnName, args);

          // Add tool result to messages
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result.content.map((c) => c.text).join('\n'),
          });
        }
        iterations++;
      } else {
        // Final response
        replyText = message.content;
        break;
      }
    }
  } catch (err) {
    logger.error({ err }, 'Agent orchestration failed');
    return { replyText: 'Sorry, I encountered an error processing your request.' };
  }

  return { replyText, toolCalls: toolCallsLog };
}

async function processWithAssistant(client: OpenAI, params: AgentProcessParams, vectorStoreId: string) {
  let assistantId = (params.agent as any).openaiAssistantId;
  let newThreadId: string | undefined;

  // 1. Ensure Assistant Exists
  if (!assistantId) {
    const assistant = await (client.beta as any).assistants.create({
      name: params.agent.name,
      instructions: params.agent.prompt || 'You are a helpful assistant.',
      model: params.agent.model || 'gpt-4o',
      tools: [{ type: 'file_search' }],
      tool_resources: {
        file_search: {
          vector_store_ids: [vectorStoreId],
        },
      },
    });
    assistantId = assistant.id;
    await prisma.agent.update({
      where: { id: params.agent.id },
      data: { openaiAssistantId: assistantId } as any,
    });
  } else {
    // Optional: Update assistant instructions if changed (skipping for performance)
  }

  // 2. Ensure Thread Exists
  let threadId = params.openaiThreadId;
  if (!threadId) {
    const thread = await (client.beta as any).threads.create();
    threadId = thread.id;
    newThreadId = thread.id;
  }

  // 3. Add Message
  let content = params.inboundText || '';
  if (params.inboundTranscription) content += `\n[Audio Transcription]: ${params.inboundTranscription}`;

  await (client.beta as any).threads.messages.create(threadId, {
    role: 'user',
    content: content || '.',
  });

  // 4. Run Assistant
  const run = await (client.beta as any).threads.runs.createAndPoll(threadId, {
    assistant_id: assistantId,
  });

  if (run.status === 'completed') {
    const messages = await (client.beta as any).threads.messages.list(run.thread_id);
    const lastMessage = messages.data[0];
    if (lastMessage.role === 'assistant') {
      const textContent = lastMessage.content.find((c: any) => c.type === 'text') as OpenAI.Beta.Threads.Messages.TextContentBlock;
      return {
        replyText: textContent?.text?.value || null,
        newThreadId
      };
    }
  } else {
    logger.error({ run }, 'Assistant run failed');
    return { replyText: 'Sorry, I encountered an error.', newThreadId };
  }

  return { replyText: null, newThreadId };
}
