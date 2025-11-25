import { Router } from 'express';
import { WeComController } from './wecom.controller';
import express from 'express';

const router = Router();

router.use(express.text({ type: '*/xml' }));

router.get('/webhook/:channelInstanceId', WeComController.webhook);
router.post('/webhook/:channelInstanceId', WeComController.webhook);

export default router;
