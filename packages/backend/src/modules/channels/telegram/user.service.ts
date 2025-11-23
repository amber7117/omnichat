import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage } from 'telegram/events';

import { Prisma } from '@prisma/client';
import { prisma } from '../../../db/prisma';
import { env } from '../../../config/env';
import { ApiError } from '../../../utils/errors';
import { logger } from '../../../utils/logger';
import { handleInboundMessage } from '../../inbound/dispatcher';

const APP_ID = Number(env.TELEGRAM_API_ID);
const APP_HASH = env.TELEGRAM_API_HASH;

if (!APP_HASH || Number.isNaN(APP_ID)) {
  logger.error(
    { APP_ID: env.TELEGRAM_API_ID, APP_HASH_PRESENT: !!APP_HASH },
    'Telegram API credentials are invalid, please check TELEGRAM_API_ID / TELEGRAM_API_HASH'
  );
}

// Global cache for active Telegram clients
const clientMap = new Map<string, TelegramClient>();

// Temporary cache for login sessions: channelInstanceId -> client
// This is crucial because the client that requested the code MUST be the one to sign in.
const loginClientMap = new Map<string, TelegramClient>();

export interface StartLoginResult {
  phoneCodeHash: string;
  phoneNumber: string;
  status: 'CODE_SENT';
}

export interface ConfirmLoginResult {
  status: 'LOGGED_IN';
  session: string; // StringSession
}

type ChannelMetadata = {
  phoneNumber?: string;
  phoneCodeHash?: string | null;
  [key: string]: unknown;
};

const normalizePhone = (phone: string) => phone.replace(/\s+/g, '').trim();

async function getMetadata(channelInstanceId: string): Promise<ChannelMetadata> {
  const channel = await prisma.channelInstance.findUnique({
    where: { id: channelInstanceId },
  });

  return ((channel?.metadata as ChannelMetadata | null) ?? {}) as ChannelMetadata;
}

// Helper to get or create a persistent client
async function getOrCreateClient(channelInstanceId: string, sessionString: string = ''): Promise<TelegramClient> {
  let client = clientMap.get(channelInstanceId);
  
  if (client) {
    if (!client.connected) {
      try {
        await client.connect();
      } catch (err) {
        logger.warn({ err, channelInstanceId }, 'Failed to reconnect existing Telegram client, creating new one');
        clientMap.delete(channelInstanceId);
        client = undefined;
      }
    }
  }

  if (!client) {
    client = new TelegramClient(
      new StringSession(sessionString),
      APP_ID,
      APP_HASH,
      { connectionRetries: 5 }
    );
    await client.connect();
    
    // Setup inbound message listener
    client.addEventHandler(async (event: any) => {
      const message = event.message;
      if (!message || message.out) return; // Ignore outgoing messages

      try {
        const sender = await message.getSender();
        const senderId = sender?.id?.toString() || 'unknown';
        const senderName = (sender?.firstName || '') + ' ' + (sender?.lastName || '');
        const username = sender?.username;

        const text = message.text || '';
        // TODO: Handle attachments (photos, documents, etc.)
        
        // Get tenantId from channel instance
        const channel = await prisma.channelInstance.findUnique({
          where: { id: channelInstanceId },
          select: { tenantId: true }
        });

        if (!channel) return;

        await handleInboundMessage({
          tenantId: channel.tenantId,
          channelInstanceId,
          channelType: 'telegram_user',
          externalUserId: senderId,
          externalConversationId: senderId, // For DM, conversation ID is usually the user ID
          text,
          attachments: [], // TODO: Extract attachments
          raw: message,
          timestamp: new Date(message.date * 1000),
          providerMessageId: message.id.toString(),
        });
      } catch (err) {
        logger.error({ err, channelInstanceId }, 'Failed to process inbound Telegram message');
      }
    }, new NewMessage({}));

    clientMap.set(channelInstanceId, client);
  }

  return client;
}

export async function bootstrapTelegramConnections(): Promise<void> {
  const instances = await prisma.channelInstance.findMany({
    where: { 
      type: 'TELEGRAM_USER', 
      status: { in: ['CONNECTED', 'CONNECTING'] } 
    },
  });

  for (const instance of instances) {
    try {
      // Fetch session string
      const session = await prisma.telegramSession.findFirst({
        where: { channelInstanceId: instance.id, sessionType: 'user' },
      });

      if (session && (session.data as any)?.sessionString) {
        await getOrCreateClient(instance.id, (session.data as any).sessionString);
        logger.info({ channelInstanceId: instance.id }, 'Telegram client bootstrapped');
      }
    } catch (err) {
      logger.error({ err, channelInstanceId: instance.id }, 'Failed to bootstrap Telegram client');
    }
  }
}

// ======================================================================
// 1) 开始登录：发送验证码（client.sendCode）
// ======================================================================
export async function startUserLogin(
  channelInstanceId: string,
  tenantId: string,
  phoneNumber: string
): Promise<StartLoginResult> {
  if (!APP_HASH || Number.isNaN(APP_ID)) {
    throw new ApiError(
      400,
      'Missing or invalid TELEGRAM_API_ID / TELEGRAM_API_HASH'
    );
  }

  const phone = normalizePhone(phoneNumber);
  
  // Check if we have an existing login client and disconnect it
  const existingClient = loginClientMap.get(channelInstanceId);
  if (existingClient) {
    await existingClient.disconnect().catch(() => void 0);
    loginClientMap.delete(channelInstanceId);
  }

  // Use a fresh client for login flow
  const client = new TelegramClient(
    new StringSession(''),
    APP_ID,
    APP_HASH,
    { connectionRetries: 1 }
  );

  try {
    await client.connect();

    const res = await client.sendCode(
      { apiId: APP_ID, apiHash: APP_HASH },
      phone
    );

    const prevMeta = await getMetadata(channelInstanceId);

    await prisma.channelInstance.update({
      where: { id: channelInstanceId },
      data: {
        metadata: {
          ...prevMeta,
          phoneNumber: phone,
          phoneCodeHash: res.phoneCodeHash,
        } as Prisma.InputJsonValue,
        status: 'CONNECTING',
        lastConnectAttempt: new Date(),
      },
    });

    logger.info(
      { channelInstanceId, tenantId, phone },
      'Telegram user login code sent'
    );

    // Store the client for the confirmation step
    loginClientMap.set(channelInstanceId, client);

    return {
      phoneCodeHash: res.phoneCodeHash,
      phoneNumber: phone,
      status: 'CODE_SENT',
    };
  } catch (err: any) {
    const msg = String(err?.message || '').toUpperCase();

    // Clean up on error
    await client.disconnect().catch(() => void 0);

    if (msg.includes('PHONE_NUMBER_INVALID')) {
      throw new ApiError(400, 'PHONE_NUMBER_INVALID');
    }
    if (msg.includes('PHONE_NUMBER_BANNED')) {
      throw new ApiError(400, 'PHONE_NUMBER_BANNED');
    }
    if (msg.includes('PHONE_NUMBER_FLOOD')) {
      throw new ApiError(429, 'PHONE_NUMBER_FLOOD');
    }

    logger.error(
      { err, channelInstanceId },
      'Failed to send Telegram login code'
    );
    throw err;
  }
}

// ======================================================================
// 2) 确认登录：用验证码换取 StringSession（相当于 client.start + session.save）
// ======================================================================
export async function confirmUserLogin(
  channelInstanceId: string,
  tenantId: string,
  params: {
    phoneNumber: string;
    code: string;
    phoneCodeHash?: string;
    password?: string; // 先不支持 2FA，遇到直接报错
  }
): Promise<ConfirmLoginResult> {
  if (!APP_HASH || Number.isNaN(APP_ID)) {
    throw new ApiError(
      400,
      'Missing or invalid TELEGRAM_API_ID / TELEGRAM_API_HASH'
    );
  }

  const meta = await getMetadata(channelInstanceId);

  const phone = normalizePhone(
    params.phoneNumber || meta.phoneNumber || ''
  );
  const phoneCodeHash = params.phoneCodeHash || meta.phoneCodeHash || '';

  if (!phone) throw new ApiError(400, 'PHONE_MISSING');
  if (!phoneCodeHash) throw new ApiError(400, 'PHONE_CODE_MISSING');

  // Retrieve the client that requested the code
  let client = loginClientMap.get(channelInstanceId);

  if (!client) {
    // Fallback: Try to create a new client if the cached one is gone (e.g. server restart)
    // Note: This usually fails with PHONE_CODE_EXPIRED because the code is bound to the session/connection ID.
    logger.warn({ channelInstanceId }, 'Login client not found in cache, creating new one (may fail)');
    client = new TelegramClient(
      new StringSession(''),
      APP_ID,
      APP_HASH,
      { connectionRetries: 1 }
    );
    await client.connect();
  } else if (!client.connected) {
      try {
          await client.connect();
      } catch (err) {
          logger.warn({ err, channelInstanceId }, 'Failed to reconnect login client');
          throw new ApiError(500, 'LOGIN_CLIENT_DISCONNECTED');
      }
  }

  try {
    try {
      // 对应文档里的 client.start(...) 内部做的 SignIn 步骤
      await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: phone,
          phoneCodeHash,
          phoneCode: params.code,
        })
      );
    } catch (err: any) {
      const msg = String(err?.message || '').toUpperCase();

      if (msg.includes('PHONE_CODE_EXPIRED')) {
        throw new ApiError(400, 'PHONE_CODE_EXPIRED');
      }
      if (msg.includes('PHONE_CODE_INVALID') || msg.includes('PHONE_CODE_EMPTY')) {
        throw new ApiError(400, 'PHONE_CODE_INVALID');
      }

      // 账户开启了 2FA，这里暂时不支持密码登录，直接提示前端
      if (msg.includes('SESSION_PASSWORD_NEEDED')) {
        throw new ApiError(400, 'TWO_FACTOR_AUTH_NOT_SUPPORTED');
      }

      throw err;
    }

    // ✅ 等价于文档里 client.session.save() 然后存到 localStorage
    // 我们这里是存到 DB
    const sessionString = (client.session as StringSession).save();

    await prisma.telegramSession.upsert({
      where: {
        channelInstanceId_sessionType: {
          channelInstanceId,
          sessionType: 'user',
        },
      },
      update: {
        data: { sessionString } as Prisma.InputJsonValue,
      },
      create: {
        tenantId,
        channelInstanceId,
        sessionType: 'user',
        data: { sessionString } as Prisma.InputJsonValue,
      },
    });

    const newMeta: ChannelMetadata = {
      ...meta,
      phoneNumber: phone,
      phoneCodeHash: null,
    };

    await prisma.channelInstance.update({
      where: { id: channelInstanceId },
      data: {
        status: 'CONNECTED',
        metadata: newMeta as Prisma.InputJsonValue,
        lastConnectedAt: new Date(),
      },
    });

    logger.info({ channelInstanceId, tenantId }, 'Telegram user logged in');
    
    // Move client to global cache and remove from login cache
    clientMap.set(channelInstanceId, client);
    loginClientMap.delete(channelInstanceId);

    return {
      status: 'LOGGED_IN',
      session: sessionString,
    };
  } catch (err) {
    logger.error({ err, channelInstanceId }, 'Telegram user login failed');
    // Only disconnect if it was a new client or if we want to force cleanup
    // If it's the cached login client, maybe keep it for retry? 
    // But usually a failed sign-in means we need to start over.
    await client.disconnect().catch(() => void 0);
    loginClientMap.delete(channelInstanceId);
    throw err;
  }
}

// ======================================================================
// 3) 登出：删除本地 session，并把渠道标记为 DISCONNECTED
// ======================================================================
export async function logoutUserSession(channelInstanceId: string) {
  await prisma.telegramSession.deleteMany({
    where: { channelInstanceId, sessionType: 'user' },
  });

  const meta = await getMetadata(channelInstanceId);

  await prisma.channelInstance.update({
    where: { id: channelInstanceId },
    data: {
      status: 'DISCONNECTED',
      metadata: {
        ...meta,
        phoneCodeHash: null,
      } as Prisma.InputJsonValue,
    },
  });
  
  const client = clientMap.get(channelInstanceId);
  if (client) {
    await client.disconnect().catch(() => void 0);
    clientMap.delete(channelInstanceId);
  }

  logger.info({ channelInstanceId }, 'Telegram user session removed');
}

// ======================================================================
// 4) 通用 helper：依据 DB 里的 StringSession 创建 TelegramClient
// ======================================================================
export async function withTelegramUserClient<T>(
  channelInstanceId: string,
  fn: (client: TelegramClient) => Promise<T>
): Promise<T> {
  if (!APP_HASH || Number.isNaN(APP_ID)) {
    throw new ApiError(
      400,
      'Missing or invalid TELEGRAM_API_ID / TELEGRAM_API_HASH'
    );
  }

  // Try to get from cache first
  let client = clientMap.get(channelInstanceId);
  
  if (!client || !client.connected) {
    const session = await prisma.telegramSession.findFirst({
      where: { channelInstanceId, sessionType: 'user' },
    });

    if (!session) {
      throw new ApiError(400, 'NO_TELEGRAM_USER_SESSION');
    }

    const sessionString = (session.data as any)?.sessionString as
      | string
      | undefined;
    if (!sessionString) {
      throw new ApiError(500, 'TELEGRAM_SESSION_DATA_CORRUPTED');
    }
    
    client = await getOrCreateClient(channelInstanceId, sessionString);
  }

  try {
    return await fn(client);
  } catch (err) {
    logger.error({ err, channelInstanceId }, 'Error executing Telegram client action');
    throw err;
  }
}

// ======================================================================
// 5) 示例：用用户 session 发送文本 / 文件消息
// ======================================================================
export async function sendTelegramUserText(
  channelInstanceId: string,
  chatId: string,
  text: string,
  fileUrl?: string,
  type?: string
) {
  return withTelegramUserClient(channelInstanceId, async (client) => {
    if (fileUrl) {
      await client.sendFile(chatId, {
        file: fileUrl,
        caption: text,
        forceDocument: type === 'file',
      });
      return;
    }

    await client.sendMessage(chatId, { message: text });
  });
}

// ======================================================================
// 6) 示例：处理 Telegram 事件（如新消息）
// ======================================================================
export async function handleTelegramEventUpdate(update: any) {
  if (update._ === 'updateNewMessage') {
    const newMessage = update.message as Api.Message;

    // 这里可以添加对新消息的处理逻辑
    logger.info({ newMessage }, 'Received new message');

    // 示例：自动回复消息
    if (newMessage.chat && newMessage.text) {
      const chatId = newMessage.chat.id;
      const replyText = `你发送了：${newMessage.text}`;

      await sendTelegramUserText(chatId.toString(), chatId.toString(), replyText);
    }
  }
}
