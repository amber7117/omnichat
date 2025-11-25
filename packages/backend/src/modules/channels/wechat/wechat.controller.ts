import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { WeChatService } from './wechat.service';

export class WeChatController {
  static async webhook(req: Request, res: Response) {
    const { signature, timestamp, nonce, echostr } = req.query;
    const { channelInstanceId } = req.params;

    // Verification (GET request)
    if (req.method === 'GET') {
      try {
        const isValid = await WeChatService.verifySignature(
          channelInstanceId, 
          signature as string, 
          timestamp as string, 
          nonce as string
        );
        
        if (isValid) {
          return res.send(echostr);
        }
        return res.status(401).send('Invalid signature');
      } catch (error) {
        logger.error({ error }, 'WeChat verification error');
        return res.status(500).send('Error');
      }
    }

    // Message Handling (POST request)
    if (req.method === 'POST') {
      try {
        // Verify signature for POST
        const isValid = await WeChatService.verifySignature(
          channelInstanceId, 
          signature as string, 
          timestamp as string, 
          nonce as string
        );

        if (!isValid) {
           logger.warn({ channelInstanceId }, 'Invalid signature on WeChat POST');
           return res.status(401).send('Invalid signature');
        }

        await WeChatService.handleMessage(channelInstanceId, req.body);
        return res.send('success');
      } catch (error) {
        logger.error({ error }, 'WeChat webhook error');
        return res.status(500).send('Error');
      }
    }

    return res.status(405).send('Method Not Allowed');
  }
}
