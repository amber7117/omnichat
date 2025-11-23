import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { ConversationController } from './conversation.controller';

const router = Router();

router.use(authMiddleware);
router.get('/', ConversationController.list);
router.get('/:id/messages', ConversationController.messages);
router.patch('/:id/auto-reply', ConversationController.setAutoReply);

export default router;
