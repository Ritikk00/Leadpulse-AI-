import test from 'node:test';
import assert from 'node:assert/strict';
import Lead, { LEAD_PRIORITIES, LEAD_STATUSES } from '../src/models/Lead.js';
import { aiResultSchema, leadAssignmentSchema, leadInputSchema, leadUpdateSchema, parseAiResult, trackingQuerySchema } from '../src/utils/validation.js';

test('Mongoose lead model uses the universal inquiry and AI qualification fields', () => {
  assert.equal(Lead.schema.path('name').isRequired, true);
  assert.equal(Lead.schema.path('phone').isRequired, true);
  assert.equal(Lead.schema.path('email').defaultValue, '');
  assert.equal(Lead.schema.path('aiScore').defaultValue, 50);
  assert.equal(Lead.schema.path('priority').defaultValue, 'WARM');
  assert.equal(Lead.schema.path('detectedBudget').defaultValue, 'Not Specified');
  assert.equal(Lead.schema.path('lastContactedAt').defaultValue, null);
  assert.equal(Lead.schema.path('followUpCount').defaultValue, 0);
  assert.equal(Lead.schema.path('followUpCount').options.min, 0);
  assert.equal(Lead.schema.path('status').defaultValue, 'NEW');
  assert.deepEqual(Lead.schema.path('status').enumValues, LEAD_STATUSES);
  assert.deepEqual(Lead.schema.path('priority').enumValues, LEAD_PRIORITIES);
  assert.equal(Lead.schema.path('budget'), undefined);
  assert.equal(Lead.schema.path('company'), undefined);
  assert.equal(Lead.schema.options.timestamps, true);
});

test('lead intake accepts a valid public payload and applies defaults', () => {
  const result = leadInputSchema.parse({ name: 'Taylor Reed', phone: '1234567890', requirement: 'Need a new website' });
  assert.equal(result.email, '');
  assert.equal(result.timeline, 'Immediate (Ready now)');
});

test('lead intake validates the universal contact and timeline fields', () => {
  assert.equal(leadInputSchema.safeParse({ name: 'Taylor', phone: '1234567890', email: 'not-email', requirement: 'Project inquiry' }).success, false);
  assert.equal(leadInputSchema.safeParse({ name: 'Taylor', phone: '12345', requirement: 'Project inquiry' }).success, false);
  assert.equal(leadInputSchema.safeParse({ name: 'Taylor', phone: '1234567890', requirement: 'Project inquiry', timeline: 'Someday' }).success, false);
  assert.equal(leadInputSchema.safeParse({ name: 'Taylor', phone: '1234567890', requirement: 'Project inquiry' }).success, true);
});

test('lead update rejects an empty patch and invalid status', () => {
  assert.equal(leadUpdateSchema.safeParse({}).success, false);
  assert.equal(leadUpdateSchema.safeParse({ status: 'Archived' }).success, false);
  assert.equal(leadUpdateSchema.safeParse({ assignedTo: '507f1f77bcf86cd799439011' }).success, false);
});

test('assignment and public tracking accept only validated identifiers', () => {
  assert.equal(leadAssignmentSchema.safeParse({ employeeId: '507f1f77bcf86cd799439011' }).success, true);
  assert.equal(leadAssignmentSchema.safeParse({ employeeId: null }).success, true);
  assert.equal(leadAssignmentSchema.safeParse({ employeeId: 'admin' }).success, false);
  assert.equal(trackingQuerySchema.safeParse({ reference: 'A'.repeat(43) }).success, true);
  assert.equal(trackingQuerySchema.safeParse({ reference: 'short' }).success, false);
});

test('AI response is validated before it can be persisted', () => {
  assert.equal(parseAiResult({ score: 76, priority: 'HOT', detectedBudget: '₹60 Lakhs', summary: 'Urgent and clear requirement.', suggestedWhatsAppMessage: 'Hello Taylor.' }).score, 76);
  assert.equal(aiResultSchema.safeParse({ score: 120, priority: 'Urgent', detectedBudget: '', summary: '', suggestedWhatsAppMessage: '' }).success, false);
});