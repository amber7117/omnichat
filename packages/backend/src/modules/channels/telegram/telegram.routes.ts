import { Router } from 'express';
import { authMiddleware } from '../../../middleware/auth';
import { TelegramBotController } from './bot.controller';
import { TelegramUserController } from './user.controller';

const router = Router();

// Telegram Bot webhook - public endpoint called by Telegram
router.post('/bot/webhook/:channelInstanceId', TelegramBotController.webhook);

// Telegram Bot status - protected
router.get('/:channelInstanceId/status', authMiddleware, TelegramBotController.status);

// Telegram User (MTProto) login flow - protected
router.post('/user/start', authMiddleware, TelegramUserController.start);
router.post('/user/confirm', authMiddleware, TelegramUserController.confirm);
router.post('/user/logout', authMiddleware, TelegramUserController.logout);

export default router;
