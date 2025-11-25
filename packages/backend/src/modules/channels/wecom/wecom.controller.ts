import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { WeComService } from './wecom.service';

export class WeComController {
  static async webhook(req: Request, res: Response) {
    const { msg_signature, timestamp, nonce, echostr } = req.query;
    const { channelInstanceId } = req.params;

    if (req.method === 'GET') {
      try {
        const result = await WeComService.verify(
          channelInstanceId, 
          msg_signature as string, 
          timestamp as string, 
          nonce as string, 
          echostr as string
        );
        
        if (result) {
          return res.send(result);
        }
        return res.status(401).send('Invalid signature');
      } catch (error) {
        logger.error({ error }, 'WeCom verification error');
        return res.status(500).send('Error');
      }
    }

    if (req.method === 'POST') {
      try {
        await WeComService.handleMessage(
            channelInstanceId, 
            msg_signature as string, 
            timestamp as string, 
            nonce as string, 
            req.body
        );
        return res.send('success');
      } catch (error) {
        logger.error({ error }, 'WeCom webhook error');
        return res.status(500).send('Error');
      }
    }
    
    return res.status(405).send('Method Not Allowed');
  }
}
