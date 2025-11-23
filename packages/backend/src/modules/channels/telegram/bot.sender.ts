import { Telegraf } from 'telegraf';
import { prisma } from '../../../db/prisma';
import { ApiError } from '../../../utils/errors';
import { logger } from '../../../utils/logger';

const botSenderMap = new Map<string, Telegraf>();

export async function ensureBotSender(channelInstanceId: string): Promise<Telegraf> {
  const existing = botSenderMap.get(channelInstanceId);
  if (existing) return existing;

  const channel = await prisma.channelInstance.findUnique({ where: { id: channelInstanceId } });
  if (!channel || channel.type !== 'TELEGRAM_BOT') throw new ApiError(404, 'Channel not found');

  const token = (channel.config as any)?.botToken as string | undefined;
  if (!token) throw new ApiError(400, 'Bot token missing');

  const bot = new Telegraf(token);
  botSenderMap.set(channelInstanceId, bot);
  logger.info({ channelInstanceId }, 'Telegram bot sender ready');
  return bot;
}
