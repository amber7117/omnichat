import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { MessageController } from './message.controller';

const router = Router();

router.use(authMiddleware);
router.post('/send', MessageController.send);

export default router;
