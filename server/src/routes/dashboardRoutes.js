import { Router } from 'express';
import { dashboard } from '../controllers/leadController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.get('/', requireAuth, dashboard);
export default router;