import { Telegraf } from 'telegraf';
import type { Update, Message, PhotoSize, Document } from 'telegraf/types';
import { prisma } from '../../../db/prisma';
import { logger } from '../../../utils/logger';
import { handleInboundMessage } from '../../inbound/dispatcher';
import type { InboundAttachment } from '../../../types';

const botMap = new Map<string, Telegraf>();

function resolveBot(channelInstanceId: string): Telegraf | undefined {
  return botMap.get(channelInstanceId);
}

async function ensureBot(channelInstanceId: string, botToken: string): Promise<Telegraf> {
  let bot = resolveBot(channelInstanceId);
  if (bot) return bot;

  bot = new Telegraf(botToken);
  botMap.set(channelInstanceId, bot);
  return bot;
}

export async function handleBotWebhook(channelInstanceId: string, update: Update) {
  const channel = await prisma.channelInstance.findUnique({ where: { id: channelInstanceId } });
  if (!channel || channel.type !== 'TELEGRAM_BOT') {
    logger.warn({ channelInstanceId }, 'Telegram bot webhook for unknown channel');
    return;
  }
  const botToken = (channel.config as any)?.botToken as string | undefined;
  if (!botToken) {
    logger.error({ channelInstanceId }, 'Telegram bot token missing in config');
    return;
  }

  const bot = await ensureBot(channelInstanceId, botToken);
  // We won't rely on Telegraf middleware chain; we just parse the update manually.
  await processInboundUpdate(channel.tenantId, channelInstanceId, update);

  // Optionally, acknowledge commands via bot; left as no-op to keep webhook fast.
  try {
    // Minimal ack: do nothing. Telegraf does not require explicit response in webhook handler here.
  } catch (err) {
    logger.warn({ err, channelInstanceId }, 'Failed to ack telegram webhook');
  }
}

async function processInboundUpdate(tenantId: string, channelInstanceId: string, update: Update) {
  const message: any = (update as any).message ?? (update as any).channel_post;
  if (!message) return;

  const externalUserId = String(message.from?.id ?? message.chat.id);
  const externalConversationId = String(message.chat.id);
  const text = message.text || (message.caption ?? undefined);
  const attachments: InboundAttachment[] = extractAttachments(message);

  await handleInboundMessage({
    tenantId,
    channelInstanceId,
    channelType: 'telegram-bot',
    externalUserId,
    externalConversationId,
    text: text ?? undefined,
    attachments,
    raw: update,
    timestamp: new Date((message.date ?? Math.floor(Date.now() / 1000)) * 1000),
  });
}

function extractAttachments(message: any): InboundAttachment[] {
  const attachments: InboundAttachment[] = [];

  if (message.photo?.length) {
    const photo: PhotoSize = message.photo[message.photo.length - 1] as PhotoSize;
    attachments.push({
      type: 'image',
      extra: {
        fileId: photo.file_id,
        width: photo.width,
        height: photo.height,
      },
    });
  }

  if (message.document) {
    const doc: Document = message.document as Document;
    attachments.push({
      type: 'file',
      mimeType: doc.mime_type ?? undefined,
      extra: {
        fileId: doc.file_id,
        fileName: doc.file_name,
        fileSize: doc.file_size,
      },
    });
  }

  if (message.voice) {
    attachments.push({
      type: 'audio',
      mimeType: message.voice.mime_type ?? undefined,
      extra: {
        fileId: message.voice.file_id,
        duration: message.voice.duration,
      },
    });
  }

  if (message.video) {
    attachments.push({
      type: 'video',
      mimeType: message.video.mime_type ?? undefined,
      extra: {
        fileId: message.video.file_id,
        duration: message.video.duration,
        width: message.video.width,
        height: message.video.height,
      },
    });
  }

  return attachments;
}
