import { Prisma, ChannelType, QueueStatus, MessageStatus } from '@prisma/client';
import { prisma } from '../../../db/prisma';
import { logger } from '../../../utils/logger';
import { getWhatsAppSocket } from '../whatsapp/baileysClient';
import { ensureBotSender } from '../telegram/bot.sender';
import axios from 'axios';
import { sendTelegramUserText } from '../telegram/user.service';

const BATCH = 10;
const INTERVAL_MS = 2000;

export function startOutboundWorker() {
  setInterval(async () => {
    try {
      const jobs = await prisma.channelMessageQueue.findMany({
        where: {
          status: QueueStatus.PENDING,
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
        },
        orderBy: { createdAt: 'asc' },
        take: BATCH,
        include: {
          channelInstance: true,
          message: {
            include: {
              conversation: {
                include: { customer: true },
              },
            },
          },
        },
      });

      for (const job of jobs) {
        await prisma.channelMessageQueue.update({
          where: { id: job.id },
          data: { status: QueueStatus.SENDING },
        });

        try {
          const dispatchResult = await dispatch(job);
          // 更新消息状态/ providerMessageId（仅 WhatsApp）
          if (job.messageId) {
            await prisma.message.update({
              where: { id: job.messageId },
              data: {
                status: MessageStatus.SENT,
                providerMessageId: (dispatchResult as any)?.key?.id || (dispatchResult as any)?.id || undefined,
              },
            });
          }
          await prisma.channelMessageQueue.update({
            where: { id: job.id },
            data: { status: QueueStatus.SENT },
          });
        } catch (err) {
          logger.error({ err, jobId: job.id, channel: job.channelInstanceId }, 'Outbound send failed');
          if (job.messageId) {
            await prisma.message.update({
              where: { id: job.messageId },
              data: { status: MessageStatus.FAILED },
            });
          }
          const retryCount = job.retryCount + 1;
          const nextRetryAt = new Date(Date.now() + Math.min(2 ** retryCount * 1000, 60_000));
          await prisma.channelMessageQueue.update({
            where: { id: job.id },
            data: {
              status: retryCount >= 5 ? QueueStatus.DEAD : QueueStatus.PENDING,
              retryCount,
              nextRetryAt: retryCount >= 5 ? null : nextRetryAt,
              lastError: (err as Error).message,
            },
          });
        }
      }
    } catch (err) {
      logger.error({ err }, 'Outbound worker tick failed');
    }
  }, INTERVAL_MS);
}

async function dispatch(job: any) {
  const channel = job.channelInstance;
  const payload = job.payload as { text?: string; externalConversationId?: string; externalUserId?: string; attachments?: any[] };
  const conversation = job.message?.conversation;
  const customer = conversation?.customer;

  switch (channel.type as ChannelType) {
    case 'WHATSAPP':
      return sendWhatsApp(
        job.channelInstanceId,
        payload.text,
        payload.externalConversationId || conversation?.externalConversationId || customer?.externalId,
        payload.attachments
      );
    case 'TELEGRAM_BOT':
      return sendTelegramBot(
        channel.id,
        payload.text,
        payload.externalConversationId || conversation?.externalConversationId || customer?.externalId,
        payload.attachments
      );
    case 'FACEBOOK':
      return sendFacebookMessenger(
        channel.id,
        payload.text,
        payload.externalUserId || customer?.externalId,
        payload.attachments
      );
    case 'TELEGRAM_USER':
      return sendTelegramUser(
        channel.id,
        payload.text,
        payload.externalConversationId || conversation?.externalConversationId || customer?.externalId,
        payload.attachments
      );
    default:
      throw new Error(`Unsupported channel type ${channel.type}`);
  }
}

async function sendWhatsApp(channelInstanceId: string, text?: string, remoteJid?: string, attachments?: any[]) {
  if (!text && (!attachments || attachments.length === 0)) throw new Error('Missing text or attachments');
  const sock = getWhatsAppSocket(channelInstanceId);
  if (!sock) throw new Error('WhatsApp socket not connected');

  const jid = remoteJid;
  if (!jid) throw new Error('Missing remote JID');

  const media = attachments?.[0];
  let result;
  if (media?.url && media?.type) {
    if (media.type === 'image') {
      result = await sock.sendMessage(jid, { image: { url: media.url }, caption: text });
      return result;
    }
    if (media.type === 'video') {
      result = await sock.sendMessage(jid, { video: { url: media.url }, caption: text });
      return result;
    }
    if (media.type === 'audio') {
      result = await sock.sendMessage(jid, { audio: { url: media.url }, caption: text });
      return result;
    }
    if (media.type === 'file') {
      result = await sock.sendMessage(jid, { document: { url: media.url }, mimetype: media.mimeType, caption: text });
      return result;
    }
  }

  result = await sock.sendMessage(jid, { text: text ?? '' });
  return result;
}

async function sendTelegramBot(channelInstanceId: string, text?: string, chatId?: string, attachments?: any[]) {
  if (!text && (!attachments || attachments.length === 0)) throw new Error('Missing text or attachments');
  if (!chatId) throw new Error('Missing chatId');
  const sender = await ensureBotSender(channelInstanceId);
  const media = attachments?.[0];
  if (media?.url && media?.type === 'image') {
    await sender.telegram.sendPhoto(chatId, media.url, { caption: text });
  } else if (media?.url && media?.type === 'video') {
    await sender.telegram.sendVideo(chatId, media.url, { caption: text });
  } else if (media?.url && media?.type === 'audio') {
    await sender.telegram.sendAudio(chatId, media.url, { caption: text });
  } else if (media?.url && media?.type === 'file') {
    await sender.telegram.sendDocument(chatId, media.url, { caption: text });
  } else if (text) {
    await sender.telegram.sendMessage(chatId, text);
  } else {
    throw new Error('Unsupported attachment for Telegram bot');
  }
}

async function sendTelegramUser(channelInstanceId: string, text?: string, chatId?: string, attachments?: any[]) {
  if (!text && (!attachments || attachments.length === 0)) throw new Error('Missing text or attachments');
  if (!chatId) throw new Error('Missing chatId');
  const media = attachments?.[0];
  if (media?.url) {
    await sendTelegramUserText(channelInstanceId, chatId, text ?? '', media.url, media.type);
    return;
  }
  if (text) {
    await sendTelegramUserText(channelInstanceId, chatId, text);
    return;
  }
  throw new Error('Unsupported attachment for Telegram user');
}

async function sendFacebookMessenger(channelInstanceId: string, text?: string, recipientId?: string, attachments?: any[]) {
  if (!text && (!attachments || attachments.length === 0)) throw new Error('Missing text or attachments');
  if (!recipientId) throw new Error('Missing recipient PSID');
  const targetId = recipientId;

  const channel = await prisma.channelInstance.findUnique({ where: { id: channelInstanceId } });
  const pageAccessToken = (channel?.config as any)?.pageAccessToken as string | undefined;
  if (!pageAccessToken) throw new Error('Missing page access token');

  const url = `https://graph.facebook.com/v17.0/me/messages`;
  const media = attachments?.[0];
  const messagePayload =
    media?.url && media?.type
      ? {
          attachment: {
            type: media.type,
            payload: {
              url: media.url,
              is_reusable: false,
            },
          },
          ...(text ? { text } : {}),
        }
      : { text };

  await axios.post(
    url,
    {
      recipient: { id: targetId },
      message: messagePayload,
    },
    { params: { access_token: pageAccessToken } }
  );
}
