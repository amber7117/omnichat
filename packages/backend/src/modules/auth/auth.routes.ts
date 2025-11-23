import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { AuthController } from './auth.controller';

const router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);
router.get('/me', authMiddleware, AuthController.me);

export default router;
