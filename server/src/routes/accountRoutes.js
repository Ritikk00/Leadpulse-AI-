import { Router } from 'express';
import { z } from 'zod';
import { getSettings, updateSettings } from '../controllers/accountController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
const settingsSchema = z.object({ adminNotifications: z.boolean(), acknowledgementEnabled: z.boolean() });

router.use(requireAuth);
router.get('/', getSettings);
router.patch('/', validate(settingsSchema), updateSettings);
export default router;