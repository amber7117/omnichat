import { Router } from 'express';
import { FacebookController } from './facebook.controller';

const router = Router();

router.get('/webhook', FacebookController.verify);
router.post('/webhook', FacebookController.webhook);

export default router;
