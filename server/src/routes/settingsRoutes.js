import { Router } from 'express';
import { z } from 'zod';
import { getSettings, updateSettings } from '../controllers/accountController.js';
import { updateAutoAssign } from '../controllers/settingsController.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
const preferencesSchema = z.object({ adminNotifications: z.boolean(), acknowledgementEnabled: z.boolean() });
const autoAssignSchema = z.object({ autoAssign: z.boolean() });

router.use(requireAuth);
router.get('/', getSettings);
router.patch('/', validate(preferencesSchema), updateSettings);
router.put('/', requireAdmin, validate(autoAssignSchema), updateAutoAssign);

export default router;
