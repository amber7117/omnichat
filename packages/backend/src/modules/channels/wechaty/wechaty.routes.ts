import { Router } from 'express';
import { WechatyController } from './wechaty.controller';

const router = Router();

router.post('/:channelInstanceId/start', WechatyController.start);
router.post('/:channelInstanceId/stop', WechatyController.stop);
router.get('/:channelInstanceId/status', WechatyController.getStatus);

export default router;
