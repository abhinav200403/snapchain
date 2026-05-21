import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, refresh, logout, me, changePassword, verifyEmail, resendVerification } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts — please try again in 15 minutes' },
});

const router = Router();

router.post('/register', register);
router.post('/login', loginLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);
router.patch('/password', authenticate, changePassword);
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', authenticate, resendVerification);

export default router;
