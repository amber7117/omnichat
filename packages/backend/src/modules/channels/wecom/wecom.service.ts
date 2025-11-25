import { prisma } from '../../../db/prisma';
import { logger } from '../../../utils/logger';
import { handleInboundMessage } from '../../inbound/dispatcher';
import { decrypt, getSignature } from '@wecom/crypto';
import { parseStringPromise } from 'xml2js';

export class WeComService {
  static async verify(channelInstanceId: string, msg_signature: string, timestamp: string, nonce: string, echostr: string): Promise<string | null> {
    const instance = await prisma.channelInstance.findUnique({ where: { id: channelInstanceId } });
    if (!instance?.config) return null;
    const { token, encodingAESKey } = instance.config as any;

    if (!token || !encodingAESKey) return null;

    const signature = getSignature(token, timestamp, nonce, echostr);
    if (signature !== msg_signature) {
        return null;
    }
    
    const { message } = decrypt(encodingAESKey, echostr);
    return message;
  }

  static async handleMessage(channelInstanceId: string, msg_signature: string, timestamp: string, nonce: string, rawBody: string) {
    const instance = await prisma.channelInstance.findUnique({ where: { id: channelInstanceId } });
    if (!instance?.config) throw new Error('Config missing');
    const { token, encodingAESKey } = instance.config as any;

    // Parse XML to get Encrypt field
    let xml: any;
    try {
        xml = await parseStringPromise(rawBody);
    } catch (e) {
        logger.error({ err: e }, 'Failed to parse WeCom XML');
        return;
    }
    
    const encrypt = xml.xml.Encrypt?.[0];
    if (!encrypt) return;

    const signature = getSignature(token, timestamp, nonce, encrypt);
    if (signature !== msg_signature) {
        throw new Error('Invalid signature');
    }

    const { message } = decrypt(encodingAESKey, encrypt);
    // message is the decrypted XML string
    
    const msgXml = await parseStringPromise(message);
    const msg = msgXml.xml;
    
    const fromUser = msg.FromUserName?.[0];
    const content = msg.Content?.[0];
    const msgId = msg.MsgId?.[0];
    
    logger.info({ channelInstanceId, fromUser }, 'WeCom message received');

    await handleInboundMessage({
      tenantId: instance.tenantId,
      channelInstanceId,
      channelType: 'wecom',
      externalUserId: fromUser,
      text: content,
      raw: msg,
      timestamp: new Date(),
      providerMessageId: msgId
    });
  }
}
