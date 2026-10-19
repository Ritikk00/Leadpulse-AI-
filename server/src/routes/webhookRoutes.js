import { Router } from 'express';
import { createWebhookLead, webhookAnalyzeLead, webhookFollowUp, webhookLeadStatus } from '../controllers/leadController.js';
import { requireWebhookSecret } from '../middleware/webhookAuth.js';

const router = Router();
router.use(requireWebhookSecret);
router.post('/leads', createWebhookLead);
router.post('/lead-status', webhookLeadStatus);
router.post('/follow-up', webhookFollowUp);
router.post('/lead-analyze', webhookAnalyzeLead);
export default router;