import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { AgentController } from './agent.controller';

const router = Router();

router.use(authMiddleware);
router.get('/', AgentController.list);
router.post('/', AgentController.create);
router.patch('/:id', AgentController.update);
router.delete('/:id', AgentController.remove);

export default router;
