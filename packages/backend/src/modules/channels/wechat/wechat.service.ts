import { prisma } from '../../../db/prisma';
import { logger } from '../../../utils/logger';
import { handleInboundMessage } from '../../inbound/dispatcher';
import crypto from 'crypto';
import { parseStringPromise } from 'xml2js'; // You might need to install xml2js

export class WeChatService {
  static async verifySignature(channelInstanceId: string, signature: string, timestamp: string, nonce: string): Promise<boolean> {
    const instance = await prisma.channelInstance.findUnique({
      where: { id: channelInstanceId },
    });

    if (!instance || !instance.config) return false;
    
    const config = instance.config as any;
    const token = config.token;

    if (!token) return false;

    const str = [token, timestamp, nonce].sort().join('');
    const sha1 = crypto.createHash('sha1').update(str).digest('hex');
    return sha1 === signature;
  }

  static async handleMessage(channelInstanceId: string, rawBody: string) {
    const instance = await prisma.channelInstance.findUnique({
      where: { id: channelInstanceId },
    });

    if (!instance) {
      throw new Error('Channel instance not found');
    }

    let msg: any;
    try {
      const result = await parseStringPromise(rawBody);
      msg = result.xml;
    } catch (e) {
      logger.error({ err: e }, 'Failed to parse WeChat XML');
      return;
    }

    if (!msg) return;

    const openId = msg.FromUserName?.[0];
    const msgType = msg.MsgType?.[0];
    const content = msg.Content?.[0];
    const msgId = msg.MsgId?.[0];
    const createTime = msg.CreateTime?.[0];

    logger.info({ channelInstanceId, msgType, openId }, 'WeChat message received');

    await handleInboundMessage({
      tenantId: instance.tenantId,
      channelInstanceId,
      channelType: 'wechat',
      externalUserId: openId,
      text: content,
      raw: msg,
      timestamp: new Date(parseInt(createTime) * 1000),
      providerMessageId: msgId
    });
  }
}
