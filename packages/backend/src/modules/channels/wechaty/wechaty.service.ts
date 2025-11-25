import { WechatyBuilder, Wechaty, ScanStatus, Message, Contact } from 'wechaty';
import { prisma } from '../../../db/prisma';
import { logger } from '../../../utils/logger';
import { emitToChannel } from '../../../utils/socket';
import { handleInboundMessage } from '../../inbound/dispatcher';
import { MessageStatus, ChannelType } from '@prisma/client';


const botMap = new Map<string, Wechaty>();

export function getWechatyBot(channelInstanceId: string): Wechaty | undefined {
  return botMap.get(channelInstanceId);
}

export async function bootstrapWechatyBots(): Promise<void> {
  const instances = await prisma.channelInstance.findMany({
    where: { type: ChannelType.WECHATY, status: { in: ['CONNECTED', 'CONNECTING'] } },
  });

  for (const instance of instances) {
    try {
      await createWechatyBot(instance.id, instance.tenantId);
      logger.info({ channelInstanceId: instance.id }, 'Wechaty bot bootstrapped');
    } catch (err) {
      logger.error({ err, channelInstanceId: instance.id }, 'Failed to bootstrap Wechaty bot');
    }
  }
}

export async function createWechatyBot(channelInstanceId: string, tenantId: string): Promise<Wechaty> {
  // Stop existing if any
  const existing = botMap.get(channelInstanceId);
  if (existing) {
    try {
      await existing.stop();
    } catch (e) {
      logger.warn({ err: e, channelInstanceId }, 'Failed to stop existing bot');
    }
    botMap.delete(channelInstanceId);
  }

  const bot = WechatyBuilder.build({
    name: `wechaty-${channelInstanceId}`,
    puppet: 'wechaty-puppet-wechat4u', // Use free web protocol
    puppetOptions: {
      uos: true, // Try to use UOS protocol to avoid block
    },
  });

  botMap.set(channelInstanceId, bot);

  bot.on('scan', async (qrcode, status) => {
    if (status === ScanStatus.Waiting || status === ScanStatus.Timeout) {
      const expiresAt = new Date(Date.now() + 60_000); // QR usually valid for short time
      
      await prisma.channelInstance.update({
        where: { id: channelInstanceId },
        data: {
          status: 'CONNECTING',
          qrCode: qrcode,
          qrCodeExpiry: expiresAt,
          lastConnectAttempt: new Date(),
        },
      });

      emitToChannel(channelInstanceId, 'wechaty-qr', { 
        tenantId, 
        channelInstanceId, 
        qr: qrcode, 
        status: ScanStatus[status] 
      });
      
      logger.info({ channelInstanceId, status: ScanStatus[status] }, 'Wechaty QR generated');
    }
  });

  bot.on('login', async (user: Contact) => {
    logger.info({ channelInstanceId, user: user.name() }, 'Wechaty logged in');
    
    await prisma.channelInstance.update({
      where: { id: channelInstanceId },
      data: {
        status: 'CONNECTED',
        qrCode: null,
        qrCodeExpiry: null,
        lastConnectedAt: new Date(),
        lastError: null,
        metadata: {
          userName: user.name(),
          userId: user.id,
        },
      },
    });

    emitToChannel(channelInstanceId, 'wechaty-connected', { 
      tenantId, 
      channelInstanceId,
      user: { name: user.name(), id: user.id }
    });
  });

  bot.on('logout', async (user) => {
    logger.info({ channelInstanceId, user: user.name() }, 'Wechaty logged out');
    
    await prisma.channelInstance.update({
      where: { id: channelInstanceId },
      data: {
        status: 'DISCONNECTED',
        lastError: 'Logged out',
        lastErrorAt: new Date(),
      },
    });

    emitToChannel(channelInstanceId, 'channel-status', {
      tenantId,
      channelInstanceId,
      status: 'DISCONNECTED',
    });
    
    // Don't delete from map immediately, maybe user wants to re-login
    // But usually we stop the bot
    // await bot.stop();
    // botMap.delete(channelInstanceId);
  });

  bot.on('message', async (msg: Message) => {
    if (msg.self()) return; // Ignore self messages

    const contact = msg.talker();
    const room = msg.room();
    const text = msg.text();
    const type = msg.type();

    logger.info({ 
      channelInstanceId, 
      from: contact.name(), 
      room: await room?.topic(), 
      type 
    }, 'Wechaty message received');

    try {
      // Basic text handling for now
      // TODO: Handle images, audio, etc.
      
      const externalUserId = contact.id;
      const externalConversationId = room ? room.id : contact.id; // Room ID or Contact ID

      await handleInboundMessage({
        tenantId,
        channelInstanceId,
        channelType: ChannelType.WECHATY,
        externalUserId,
        externalConversationId,
        text,
        raw: {
          id: msg.id,
          type: msg.type(),
          text: msg.text(),
          talkerId: contact.id,
          roomId: room?.id,
          date: msg.date(),
        },
        timestamp: new Date(msg.date().getTime()),
        providerMessageId: msg.id,
      });

    } catch (err) {
      logger.error({ err, channelInstanceId }, 'Failed to process inbound Wechaty message');
    }
  });

  bot.on('error', async (err) => {
    logger.error({ err, channelInstanceId }, 'Wechaty error');
    // Don't update status to ERROR immediately on every error, but maybe track it
  });

  try {
    await bot.start();
    logger.info({ channelInstanceId }, 'Wechaty bot started');
  } catch (err) {
    logger.error({ err, channelInstanceId }, 'Failed to start Wechaty bot');
    throw err;
  }

  return bot;
}

export async function stopWechatyBot(channelInstanceId: string): Promise<void> {
  const bot = botMap.get(channelInstanceId);
  if (bot) {
    await bot.stop();
    botMap.delete(channelInstanceId);
    
    await prisma.channelInstance.update({
      where: { id: channelInstanceId },
      data: {
        status: 'DISCONNECTED',
      },
    });
  }
}
