import { Router } from 'express';
import { register, login, refresh, logout, me, changePassword } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);
router.patch('/password', authenticate, changePassword);

export default router;
