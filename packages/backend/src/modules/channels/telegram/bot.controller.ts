import type { Request, Response, NextFunction } from 'express';
import { handleBotWebhook, getBotStatus } from './bot.service';

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

  async status(req: Request, res: Response, next: NextFunction) {
    try {
      const channelInstanceId = req.params.channelInstanceId;
      const status = await getBotStatus(channelInstanceId);
      res.json(status);
    } catch (err) {
      next(err);
    }
  },
};
