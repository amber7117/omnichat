import type {
  ConnectionState,
  WASocket,
} from 'baileys';

import type { Boom } from '@hapi/boom';
import { usePostgresAuthState } from './postgresAuthState';
import { prisma } from '../../../db/prisma';
import { logger } from '../../../utils/logger';
import { emitToChannel } from '../../../utils/socket';
import { handleInboundMessage } from '../../inbound/dispatcher';
import type { InboundAttachment } from '../../../types';
import { MessageStatus } from '@prisma/client';
import { storageService } from '../../storage/storage.service';
import { transcriptionService } from '../../ai/transcription.service';

// ------------------------------------------------------
// ESM-only Baileys 动态加载适配
// ------------------------------------------------------
let baileysRef: typeof import('baileys') | null = null;

async function getBaileys() {
  if (!baileysRef) {
    // 用 eval 避免被 tsc 编译成 require('baileys')
    baileysRef = (await eval('import("baileys")')) as typeof import('baileys');
  }
  return baileysRef;
}

const socketMap = new Map<string, WASocket>();

export function getWhatsAppSocket(channelInstanceId: string): WASocket | undefined {
  return socketMap.get(channelInstanceId);
}

export async function bootstrapWhatsAppConnections(): Promise<void> {
  const instances = await prisma.channelInstance.findMany({
    where: { type: 'WHATSAPP', status: { in: ['CONNECTED', 'CONNECTING'] } },
  });

  for (const instance of instances) {
    try {
      await createWhatsAppSocket(instance.id, instance.tenantId);
      logger.info({ channelInstanceId: instance.id }, 'WhatsApp socket bootstrapped');
    } catch (err) {
      logger.error({ err, channelInstanceId: instance.id }, 'Failed to bootstrap WhatsApp socket');
    }
  }
}

export async function createWhatsAppSocket(channelInstanceId: string, tenantId: string): Promise<WASocket> {
  const { state, saveCreds } = await usePostgresAuthState(channelInstanceId, tenantId, channelInstanceId);

  const baileys = await getBaileys();
  const { default: makeWASocket, fetchLatestBaileysVersion, downloadMediaMessage } = baileys;

  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: ['OmniChat', 'Desktop', '1.0.0'],
    syncFullHistory: false,
  });

  socketMap.set(channelInstanceId, sock);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      const expiresAt = new Date(Date.now() + 60_000);
      await prisma.channelInstance.update({
        where: { id: channelInstanceId },
        data: {
          status: 'CONNECTING',
          qrCode: qr,
          qrCodeExpiry: expiresAt,
          connectionAttempts: { increment: 1 },
          lastConnectAttempt: new Date(),
        },
      });

      emitToChannel(channelInstanceId, 'whatsapp-qr', { tenantId, channelInstanceId, qr, expiresAt });
      logger.info({ channelInstanceId }, 'WhatsApp QR generated');
    }

    if (connection === 'open') {
      const user = sock.user;
      const phoneNumber = user?.id ? user.id.split(':')[0].split('@')[0] : undefined;

      await prisma.channelInstance.update({
        where: { id: channelInstanceId },
        data: {
          status: 'CONNECTED',
          qrCode: null,
          qrCodeExpiry: null,
          lastConnectedAt: new Date(),
          lastError: null,
          lastErrorAt: null,
          externalId: phoneNumber, // Save the phone number
        },
      });
      emitToChannel(channelInstanceId, 'whatsapp-connected', { tenantId, channelInstanceId, phoneNumber });
      logger.info({ channelInstanceId, phoneNumber }, 'WhatsApp connection established');

      // 在连接建立后尝试同步最近历史消息
      syncRecentHistory(channelInstanceId, tenantId, sock).catch((err) => {
        logger.error({ err, channelInstanceId }, 'WhatsApp history sync failed');
      });
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const baileysLocal = await getBaileys();
      const isLoggedOut = statusCode === baileysLocal.DisconnectReason.loggedOut;

      await prisma.channelInstance.update({
        where: { id: channelInstanceId },
        data: {
          status: isLoggedOut ? 'ERROR' : 'DISCONNECTED',
          lastError: lastDisconnect?.error?.message ?? null,
          lastErrorAt: new Date(),
          qrCode: null,
          qrCodeExpiry: null,
        },
      });

      socketMap.delete(channelInstanceId);
      emitToChannel(channelInstanceId, 'channel-status', {
        tenantId,
        channelInstanceId,
        status: isLoggedOut ? 'ERROR' : 'DISCONNECTED',
      });

      if (!isLoggedOut) {
        // Basic retry to improve resilience; avoid tight loops.
        setTimeout(() => {
          createWhatsAppSocket(channelInstanceId, tenantId).catch((err) =>
            logger.error({ err, channelInstanceId }, 'WhatsApp auto-reconnect failed')
          );
        }, 5_000);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    const msg = messages?.[0];
    if (!msg?.message) return;
    if (msg.key.fromMe) return; // only care about inbound

    const baileysLocal = await getBaileys();
    const { getContentType, jidNormalizedUser } = baileysLocal;

    logger.info(
      { channelInstanceId, type, from: msg.key.remoteJid, messageId: msg.key.id },
      'WhatsApp message received'
    );

    try {
      let text = extractText(msg, getContentType);
      const { attachments, transcription, summary } = await processAttachments(msg, getContentType, downloadMediaMessage, logger);

      if (transcription) {
        text = (text ? text + '\n\n' : '') + transcription;
      }
      const externalUserId = jidNormalizedUser(msg.key.remoteJid || '');

      let externalUserName = msg.pushName || undefined;
      const isGroup = msg.key.remoteJid?.endsWith('@g.us');

      if (isGroup && msg.key.remoteJid) {
        try {
          // Attempt to get group subject for the conversation name
          const meta = await sock.groupMetadata(msg.key.remoteJid);
          externalUserName = meta.subject;
        } catch (err) {
          // Fallback or ignore
          logger.warn({ err, jid: msg.key.remoteJid }, 'Failed to fetch group metadata');
        }
      }

      await handleInboundMessage({
        tenantId,
        channelInstanceId,
        channelType: 'whatsapp',
        externalUserId,
        externalUserName,
        externalConversationId: msg.key.remoteJid ?? undefined,
        text,
        transcription,
        summary,
        attachments,
        raw: msg,
        timestamp: new Date(Number(msg.messageTimestamp ?? Date.now()) * 1000),
        providerMessageId: msg.key.id ?? undefined,
      });
    } catch (err) {
      logger.error({ err, channelInstanceId }, 'Failed to process inbound WhatsApp message');
    }
  });

  // 送达/已读回执更新
  sock.ev.on('messages.update', async (updates) => {
    for (const u of updates) {
      const key = u.key;
      const status = (u.update as any)?.status;
      if (!key?.id || status === undefined) continue;
      // 仅处理自己发出的
      if (!key.fromMe) continue;

      let mapped: MessageStatus | undefined;
      // Baileys status codes: 1 serverAck, 2 delivery, 3 read, 4 played
      if (status === 3 || status === 'READ') mapped = MessageStatus.READ;
      else if (status === 2 || status === 'DELIVERED') mapped = MessageStatus.DELIVERED;
      else if (status === 1 || status === 'SENT') mapped = MessageStatus.SENT;

      if (mapped) {
        try {
          await prisma.message.updateMany({
            where: { providerMessageId: key.id, channelInstanceId: channelInstanceId },
            data: { status: mapped },
          });
        } catch (err) {
          logger.warn({ err, channelInstanceId, providerMessageId: key.id }, 'Failed to update message status');
        }
      }
    }
  });

  return sock;
}

function extractText(
  msg: any,
  getContentType: (message: any) => string | undefined
): string | undefined {
  const contentType = getContentType(msg.message);
  if (!contentType) return undefined;

  if (contentType === 'conversation') return msg.message.conversation;
  if (contentType === 'extendedTextMessage') return msg.message.extendedTextMessage?.text;
  if (contentType === 'imageMessage') return msg.message.imageMessage?.caption;
  if (contentType === 'videoMessage') return msg.message.videoMessage?.caption;
  return undefined;
}

async function processAttachments(
  msg: any,
  getContentType: (message: any) => string | undefined,
  downloadMediaMessage: any,
  logger: any
): Promise<{ attachments: InboundAttachment[]; transcription?: string; summary?: string }> {
  const attachments: InboundAttachment[] = [];
  let transcription = "";
  let summary = "";
  const contentType = getContentType(msg.message);
  if (!contentType) return { attachments };

  const handleMedia = async (media: any, type: 'image' | 'video' | 'audio' | 'file', mimeType: string, ext: string) => {
    try {
      // Download media buffer
      const buffer = await downloadMediaMessage(msg, 'buffer', {});

      // Upload to R2
      const key = `whatsapp/${msg.key.remoteJid}/${msg.key.id}/${Date.now()}.${ext}`;
      const url = await storageService.uploadFile(key, buffer, mimeType);

      attachments.push({
        type,
        mimeType,
        url,
        extra: {
          fileLength: media.fileLength,
          mediaKey: media.mediaKey?.toString('base64'),
          fileSha256: media.fileSha256?.toString('base64'),
        },
      });

      // Transcribe/Summarize
      if (type === 'audio' || type === 'video') {
        const text = await transcriptionService.transcribeAudio(buffer, `file.${ext}`);
        if (text) {
          transcription += `[${type.toUpperCase()} Transcription]:\n${text}\n`;

          if (type === 'video') {
            const vidSummary = await transcriptionService.summarizeVideo(text);
            if (vidSummary) {
              summary += `[Video Summary]:\n${vidSummary}\n`;
            }
          }
        }
      }
    } catch (err) {
      logger.error({ err, msgId: msg.key.id }, `Failed to process ${type} attachment`);
    // Fallback: push without URL if download failed, or just skip
    }
  };

  if (contentType === 'imageMessage' && msg.message.imageMessage) {
    await handleMedia(msg.message.imageMessage, 'image', msg.message.imageMessage.mimetype, 'jpg');
  }
  else if (contentType === 'videoMessage' && msg.message.videoMessage) {
    await handleMedia(msg.message.videoMessage, 'video', msg.message.videoMessage.mimetype, 'mp4');
  }
  else if (contentType === 'audioMessage' && msg.message.audioMessage) {
    const ext = msg.message.audioMessage.mimetype.includes('ogg') ? 'ogg' : 'mp3';
    await handleMedia(msg.message.audioMessage, 'audio', msg.message.audioMessage.mimetype, ext);
  }
  else if (contentType === 'documentMessage' && msg.message.documentMessage) {
    const media = msg.message.documentMessage;
    const ext = media.fileName?.split('.').pop() || 'bin';
    await handleMedia(media, 'file', media.mimetype, ext);
  }
  else if (contentType === 'locationMessage' && msg.message.locationMessage) {
    const loc = msg.message.locationMessage;
    attachments.push({
      type: 'location',
      extra: {
        degreesLatitude: loc.degreesLatitude,
        degreesLongitude: loc.degreesLongitude,
        name: loc.name,
        address: loc.address,
      },
    });
  }

  return { attachments, transcription, summary };
}

/**
 * 拉取历史消息（每个已知会话最多 10 条），幂等写入并触发自动回复
 */
async function syncRecentHistory(channelInstanceId: string, tenantId: string, sock: WASocket) {
  const conversations = await prisma.conversation.findMany({
    where: { channelInstanceId },
    select: { externalConversationId: true },
    take: 20, // 避免过多对话一次性同步
  });

  const chatIds = Array.from(
    new Set(
      conversations
        .map((c) => c.externalConversationId)
        .filter((id): id is string => Boolean(id))
    )
  );

  // 若没有历史对话，则跳过
  if (chatIds.length === 0) return;

  const fetchMessages = (sock as any).fetchMessagesFromWA?.bind(sock) as
    | ((jid: string, count: number) => Promise<any[]>)
    | undefined;

  if (!fetchMessages) {
    logger.warn({ channelInstanceId }, 'fetchMessagesFromWA not available; skip history sync');
    return;
  }

  const baileys = await getBaileys();
  const { getContentType, jidNormalizedUser, downloadMediaMessage } = baileys;

  for (const jid of chatIds) {
    try {
      // 控制速率，避免频繁请求
      await new Promise((resolve) => setTimeout(resolve, 500));
      // fetchMessagesFromWA: Baileys 提供按 JID 拉取最近消息
      const msgs = await fetchMessages(jid, 10);
      for (const m of msgs) {
        if (!m.message) continue;
        let text = extractText(m, getContentType);
        const { attachments, transcription, summary } = await processAttachments(m, getContentType, downloadMediaMessage, logger);

        if (transcription) {
          text = (text ? text + '\n\n' : '') + transcription;
        }
        const externalUserId = jidNormalizedUser(m.key.remoteJid || '');
        await handleInboundMessage({
          tenantId,
          channelInstanceId,
          channelType: 'whatsapp',
          externalUserId,
          externalUserName: m.pushName || undefined,
          externalConversationId: m.key.remoteJid ?? undefined,
          text,
          transcription,
          summary,
          attachments,
          raw: m,
          timestamp: new Date(Number(m.messageTimestamp ?? Date.now()) * 1000),
          providerMessageId: m.key.id,
        });
      }
    } catch (err) {
      logger.warn({ err, channelInstanceId, jid }, 'History sync for chat failed');
    }
  }
}
