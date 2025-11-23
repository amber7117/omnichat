import OpenAI from 'openai';
import { logger } from '../../utils/logger';
import { mcpClient } from '../mcp/mcp-client';
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
  context?: Record<string, any>;
}

export async function processAgentMessage(params: AgentProcessParams): Promise<{ replyText: string | null; toolCalls?: any[] }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.error('Missing OPENAI_API_KEY');
    return { replyText: 'System Error: AI not configured.' };
  }

  const client = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });

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
    if (m.text) {
      messages.push({
        role: m.direction === 'OUTBOUND' ? 'assistant' : 'user',
        content: m.text,
      });
    }
  }

  // Add current user message
  messages.push({
    role: 'user',
    content: params.inboundText,
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
