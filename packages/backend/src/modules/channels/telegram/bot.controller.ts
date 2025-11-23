import type { Request, Response, NextFunction } from 'express';
import { handleBotWebhook } from './bot.service';

export const TelegramBotController = {
  async webhook(req: Request, res: Response, next: NextFunction) {
    try {
      const channelInstanceId = req.params.channelInstanceId;
      await handleBotWebhook(channelInstanceId, req.body);
      res.sendStatus(200);
    } catch (err) {
      next(err);
    }
  },
};
