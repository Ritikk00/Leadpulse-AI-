import { z } from 'zod';

export const leadInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^\d{10}$/, 'Phone must contain exactly 10 digits.'),
  email: z.union([z.string().trim().email().max(254), z.literal('')]).optional().default(''),
  requirement: z.string().trim().min(5).max(5000),
  timeline: z.enum(['Immediate (Ready now)', 'Within 15 - 30 Days', 'Exploring / General Inquiry']).optional().default('Immediate (Ready now)')
});

export const leadUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.union([z.string().trim().email().max(254), z.literal('')]).optional(),
  phone: z.string().trim().regex(/^\d{10}$/).optional(),
  source: z.string().trim().max(80).optional(),
  requirement: z.string().trim().min(5).max(5000).optional(),
  timeline: z.enum(['Immediate (Ready now)', 'Within 15 - 30 Days', 'Exploring / General Inquiry']).optional(),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED', 'LOST']).optional(),
  priority: z.enum(['HOT', 'WARM', 'COLD']).optional()
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const leadAssignmentSchema = z.object({ employeeId: z.string().regex(/^[\da-f]{24}$/i).nullable() });
export const trackingQuerySchema = z.object({ reference: z.string().trim().min(32).max(64).regex(/^[A-Za-z0-9_-]+$/) });

export const aiResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  priority: z.enum(['HOT', 'WARM', 'COLD']),
  detectedBudget: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(1000),
  suggestedWhatsAppMessage: z.string().trim().min(1).max(1000)
});

export function parseAiResult(value) {
  return aiResultSchema.parse(value);
}