import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { addLeadNote, addWhatsAppActivity, analyzeLeadById, assignLead, createLead, deleteLead, getLead, inquireLead, leadMetadata, listLeads, trackLead, updateLead } from '../controllers/leadController.js';
import { requireAdmin, requireAuth, requireRole } from '../middleware/auth.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { leadAssignmentSchema, leadInputSchema, leadUpdateSchema, trackingQuerySchema } from '../utils/validation.js';

const router = Router();
const intakeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many inquiries. Please try again in 15 minutes.' }
});
const trackingLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });
const noteSchema = z.object({ message: z.string().trim().min(2).max(500) });
const whatsappSchema = z.object({ followUp: z.boolean().optional().default(false) });

router.post('/inquire', intakeLimiter, validate(leadInputSchema), inquireLead);
router.post('/public', intakeLimiter, validate(leadInputSchema), inquireLead);
router.get('/track', trackingLimiter, validateQuery(trackingQuerySchema), trackLead);
router.use(requireAuth);
router.get('/meta', leadMetadata);
router.get('/', listLeads);
router.post('/', validate(leadInputSchema), createLead);
router.patch('/:id/assign', requireAdmin, validate(leadAssignmentSchema), assignLead);
router.get('/:id', getLead);
router.patch('/:id', validate(leadUpdateSchema), updateLead);
router.delete('/:id', requireRole('admin'), deleteLead);
router.post('/:id/analyze', analyzeLeadById);
router.post('/:id/activities', validate(noteSchema), addLeadNote);
router.post('/:id/whatsapp', validate(whatsappSchema), addWhatsAppActivity);

export default router;