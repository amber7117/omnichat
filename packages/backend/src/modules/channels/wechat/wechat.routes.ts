import { Router } from 'express';
import { WeChatController } from './wechat.controller';
import express from 'express';

const router = Router();

// Parse XML body as string
router.use(express.text({ type: '*/xml' }));

router.get('/webhook/:channelInstanceId', WeChatController.webhook);
router.post('/webhook/:channelInstanceId', WeChatController.webhook);

export default router;
