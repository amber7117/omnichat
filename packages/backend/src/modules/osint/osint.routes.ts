import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { OsintController } from './osint.controller';

const router = Router();

router.post('/search', requireAuth, OsintController.search);

export default router;
