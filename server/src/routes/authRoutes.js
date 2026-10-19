import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { forgotPassword, login, logout, me, refresh, register, requireSetupOpen, resetPassword, setupStatus } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { env } from '../config/env.js';

const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: env.NODE_ENV === 'development' ? 30 : 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { success: false, message: 'Too many authentication attempts. Try again shortly.' } });
const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const credentialsSchema = z.object({ email, password: z.string().min(8).max(128) });
const registerSchema = credentialsSchema.extend({ name: z.string().trim().min(2).max(100) });
const forgotSchema = z.object({ email });
const resetSchema = z.object({ token: z.string().min(32).max(200), password: z.string().min(8).max(128) });

router.get('/setup-status', setupStatus);
router.post('/setup', authLimiter, requireSetupOpen, validate(registerSchema), register);
router.post('/register', authLimiter, requireSetupOpen, validate(registerSchema), register);
router.post('/login', authLimiter, validate(credentialsSchema), login);
router.post('/refresh', authLimiter, refresh);
router.post('/logout', logout);
router.post('/forgot-password', authLimiter, validate(forgotSchema), forgotPassword);
router.post('/reset-password', authLimiter, validate(resetSchema), resetPassword);
router.get('/me', requireAuth, me);

export default router;