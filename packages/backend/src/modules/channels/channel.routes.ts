import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { ChannelController } from './channel.controller';

const router = Router();

router.use(authMiddleware);
router.post('/', ChannelController.create);
router.get('/', ChannelController.list);
router.delete('/:id', ChannelController.delete);
router.post('/:id/whatsapp/start', ChannelController.startWhatsApp);
router.get('/:id/agent-binding', ChannelController.getAgentBinding);
router.patch('/:id/agent-binding', ChannelController.updateAgentBinding);

export default router;
