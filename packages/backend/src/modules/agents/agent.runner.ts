import OpenAI from 'openai';
import { logger } from '../../utils/logger';

interface AgentConfig {
  model?: string;
  prompt?: string;
  temperature?: number | null;
}

interface RunParams {
  config: AgentConfig;
  userText: string;
  context?: string;
}

export async function runAgentReply(params: RunParams): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY');
  }

  const client = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });

  const model = params.config.model || process.env.OPENAI_MODEL || 'deepseek-chat';

  try {
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      {
        role: 'system',
        content: params.config.prompt ?? 'You are a helpful assistant.',
      },
    ];
    if (params.context) {
      messages.push({
        role: 'assistant',
        content: `Conversation context (recent messages):\n${params.context}`,
      });
    }
    messages.push({
      role: 'user',
      content: params.userText,
    });

    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature: params.config.temperature ?? 0.6,
    });

    const content = completion.choices[0]?.message?.content;
    return content ?? buildFallback(params);
  } catch (err) {
    logger.error({ err }, 'Agent LLM call failed, falling back');
    return buildFallback(params);
  }
}

function buildFallback(params: RunParams): string {
  const prefix = params.config.prompt ? `${params.config.prompt}\n\n` : '';
  return `${prefix}Auto-reply: ${params.userText}`;
}
