import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../../middleware/auth';
import { AgentController } from './agent.controller';
import { KnowledgeController } from './knowledge.controller';

const upload = multer({ dest: 'uploads/' });
const router = Router();

router.use(authMiddleware);
router.get('/', AgentController.list);
router.post('/', AgentController.create);
router.patch('/:id', AgentController.update);
router.delete('/:id', AgentController.remove);

// Knowledge Base Routes
router.post('/:agentId/knowledge/files', upload.single('file'), KnowledgeController.upload);
router.get('/:agentId/knowledge/files', KnowledgeController.list);
router.delete('/:agentId/knowledge/files/:fileId', KnowledgeController.delete);

export default router;
