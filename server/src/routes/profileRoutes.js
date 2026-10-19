import { Router } from 'express';
import { z } from 'zod';
import { updateProfile } from '../controllers/accountController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
const profileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  currentPassword: z.string().min(8).max(128).optional(),
  newPassword: z.string().min(8).max(128).optional()
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required');

router.patch('/', requireAuth, validate(profileSchema), updateProfile);
export default router;