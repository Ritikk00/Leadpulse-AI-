import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import User from '../src/models/User.js';
import Settings from '../src/models/Settings.js';
import Lead from '../src/models/Lead.js';
import LeadActivity from '../src/models/LeadActivity.js';
import { createAccessToken, hashToken, refreshCookieOptions } from '../src/services/tokens.js';

async function waitForActivity(leadId, type) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const event = await LeadActivity.findOne({ lead: leadId, type });
    if (event) return event;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${type} activity for lead ${leadId}`);
}

function cookieDetails(header) {
  const [cookiePair = '', ...attributes] = header.split(';').map((part) => part.trim());
  const separator = cookiePair.indexOf('=');
  return {
    name: separator < 0 ? '' : cookiePair.slice(0, separator),
    attributes: Object.fromEntries(attributes.map((attribute) => {
      const [name, ...values] = attribute.split('=');
      return [name.toLowerCase(), values.join('=') || true];
    }))
  };
}

test('health endpoint responds with the API status', async () => {
  const response = await request(app).get('/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.data.status, 'ok');
});

test('API stays reachable while database initialization is pending', async () => {
  const originalInitialized = app.locals.databaseInitialized;
  try {
    app.locals.databaseInitialized = false;
    const [health, setupStatus, setup] = await Promise.all([
      request(app).get('/api/health'),
      request(app).get('/api/auth/setup-status'),
      request(app).post('/api/auth/setup').send({ name: 'First Admin', email: 'first@example.test', password: 'TestPassword!42' })
    ]);
    assert.equal(health.status, 200);
    assert.equal(setupStatus.status, 503);
    assert.deepEqual(setupStatus.body, { success: false, isSetupComplete: null, message: 'Database connecting...' });
    assert.equal(setup.status, 503);
  } finally {
    app.locals.databaseInitialized = originalInitialized;
  }
});

test('public lead intake validates payloads before reaching persistence', async () => {
  const response = await request(app).post('/api/leads/inquire').send({ name: 'Taylor', phone: '1234567890', email: 'invalid', requirement: 'Project request' });
  assert.equal(response.status, 400);
  assert.deepEqual(Object.keys(response.body).sort(), ['message', 'success']);
  assert.equal(response.body.success, false);
  assert.ok(response.body.message);
});

test('public tracking validates references and staff management requires authentication', async () => {
  const responses = await Promise.all([
    request(app).get('/api/leads/track'),
    request(app).get('/api/users/employees'),
    request(app).patch('/api/leads/507f1f77bcf86cd799439011/assign').send({ employeeId: null })
  ]);
  assert.deepEqual(responses.map((response) => response.status), [400, 401, 401]);
});

test('settings endpoints require authentication', async () => {
  const [read, update] = await Promise.all([
    request(app).get('/api/settings'),
    request(app).put('/api/settings').send({ autoAssign: true })
  ]);
  assert.deepEqual([read.status, update.status], [401, 401]);
});

test('protected APIs reject missing, invalid, and expired access tokens and refresh cookies', async () => {
  const expiredToken = jwt.sign({}, process.env.JWT_ACCESS_SECRET, {
    subject: '507f1f77bcf86cd799439011', issuer: 'ai-lead-starter', expiresIn: -1
  });
  const responses = await Promise.all([
    request(app).get('/api/dashboard'),
    request(app).get('/api/leads/507f1f77bcf86cd799439011'),
    request(app).post('/api/leads/507f1f77bcf86cd799439011/analyze'),
    request(app).get('/api/dashboard').set('Authorization', 'Bearer invalid-token'),
    request(app).get('/api/dashboard').set('Authorization', `Bearer ${expiredToken}`),
    request(app).post('/api/auth/refresh'),
    request(app).post('/api/auth/refresh').set('Cookie', 'refreshToken=invalid-token')
  ]);
  assert.deepEqual(responses.map((response) => response.status), [401, 401, 401, 401, 401, 401, 401]);
});

test('Mongo-backed account and lead lifecycle', { skip: !process.env.MONGO_TEST_URI }, async (t) => {
  await mongoose.connect(process.env.MONGO_TEST_URI);
  await Promise.all([User.deleteMany({}), Lead.deleteMany({}), LeadActivity.deleteMany({}), Settings.deleteMany({})]);
  t.after(async () => {
    await Promise.all([User.deleteMany({}), Lead.deleteMany({}), LeadActivity.deleteMany({}), Settings.deleteMany({})]);
    await mongoose.disconnect();
  });

  const setupStatus = await request(app).get('/api/auth/setup-status');
  assert.equal(setupStatus.body.isSetupComplete, false);
  const registration = await request(app).post('/api/auth/setup').send({ name: 'Test Owner', email: 'owner@example.test', password: 'TestPassword!42' });
  assert.equal(registration.status, 201);
  assert.equal(registration.body.data.user.role, 'admin');
  assert.equal((await request(app).get('/api/auth/setup-status')).body.isSetupComplete, true);
  assert.equal((await request(app).post('/api/auth/setup').send({ name: 'Another Owner', email: 'another@example.test', password: 'TestPassword!42' })).status, 403);
  assert.equal((await request(app).post('/api/auth/register').send({ name: 'Public Account', email: 'public-account@example.test', password: 'TestPassword!42' })).status, 403);
  assert.ok(registration.headers['set-cookie'].some((cookie) => cookie.includes('HttpOnly')));
  const ownerToken = registration.body.data.accessToken;
  const defaultSettings = await request(app).get('/api/settings').set('Authorization', `******`);
  assert.equal(defaultSettings.status, 200);
  assert.equal(defaultSettings.body.settings.autoAssign, false);
  assert.equal(defaultSettings.body.data.settings.autoAssign, false);
  const refreshCookie = registration.headers['set-cookie'].find((cookie) => cookie.startsWith('refreshToken='));
  const owner = await User.findOne({ email: 'owner@example.test' }).select('+refreshTokenHash');
  assert.equal(owner.refreshTokenHash, hashToken(decodeURIComponent(refreshCookie.split(';')[0].split('=')[1])));

  assert.equal((await request(app).post('/api/auth/login').send({ email: owner.email, password: 'incorrect-password' })).status, 401);
  const login = await request(app).post('/api/auth/login').send({ email: owner.email, password: 'TestPassword!42' });
  assert.equal(login.status, 200);
  assert.equal('passwordHash' in login.body.data.user, false);
  assert.equal('refreshTokenHash' in login.body.data.user, false);
  assert.equal('refreshToken' in login.body.data, false);
  assert.equal(User.schema.path('accessToken'), undefined);
  assert.equal(User.schema.path('refreshToken'), undefined);
  const loginCookieHeader = login.headers['set-cookie'].find((cookie) => cookie.startsWith('refreshToken=')) || '';
  const loginCookieDetails = cookieDetails(loginCookieHeader);
  assert.equal(loginCookieDetails.name, 'refreshToken');
  assert.equal(loginCookieDetails.attributes.httponly, true);
  assert.equal(Boolean(loginCookieDetails.attributes.secure), refreshCookieOptions.secure);
  assert.equal(loginCookieDetails.attributes.samesite, 'Strict');
  assert.equal(loginCookieDetails.attributes.path, '/api/auth');
  assert.equal(Number(loginCookieDetails.attributes['max-age']), refreshCookieOptions.maxAge / 1000);
  assert.equal('accessToken' in loginCookieDetails.attributes, false);
  const loginCookie = loginCookieHeader;
  const loginRefreshToken = decodeURIComponent(loginCookie.split(';')[0].split('=')[1]);
  assert.equal((await User.findById(owner._id).select('+refreshTokenHash')).refreshTokenHash, hashToken(loginRefreshToken));

  const refresh = await request(app).post('/api/auth/refresh').set('Cookie', loginCookie.split(';')[0]);
  assert.equal(refresh.status, 200);
  assert.ok(refresh.body.data.accessToken);
  assert.equal('refreshToken' in refresh.body.data, false);
  assert.equal(refresh.headers['set-cookie'], undefined);
  assert.equal((await User.findById(owner._id).select('+refreshTokenHash')).refreshTokenHash, hashToken(loginRefreshToken));
  const refreshedToken = refresh.body.data.accessToken;

  const created = await request(app).post('/api/leads').set('Authorization', `Bearer ${refreshedToken}`).send({
    name: 'Morgan Buyer', email: 'morgan@example.test', phone: '1234567890', requirement: 'A customer onboarding portal'
  });
  assert.equal(created.status, 201);
  const leadId = created.body.data.lead._id;
  assert.equal(created.body.data.lead.ownerId, owner.id);

  const originalAiKey = env.GROQ_API_KEY;
  const originalFetch = globalThis.fetch;
  const analysis = { score: 82, priority: 'HOT', detectedBudget: 'Not Specified', summary: 'Clear business requirement.', suggestedWhatsAppMessage: 'Hello Public Buyer, thanks for your inquiry.' };
  env.GROQ_API_KEY = 'test-provider-key';
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(analysis) } }] }), { status: 200 });
  t.after(() => {
    env.GROQ_API_KEY = originalAiKey;
    globalThis.fetch = originalFetch;
  });

  const publicLead = await request(app).post('/api/leads/inquire').send({
    name: 'Public Buyer', phone: '2345678901', email: 'public@example.test', requirement: 'A public enquiry form submission', timeline: 'Within 15 - 30 Days'
  });
  assert.equal(publicLead.status, 201);
  assert.equal(typeof publicLead.body.data.trackingReference, 'string');
  assert.equal(publicLead.body.data.lead.name, 'Public Buyer');
  assert.equal(publicLead.body.data.lead.phone, '2345678901');
  assert.equal(publicLead.body.data.lead.timeline, 'Within 15 - 30 Days');
  assert.equal(publicLead.body.data.lead.status, 'NEW');
  assert.equal('trackingCodeHash' in publicLead.body.data.lead, false);
  const trackedLead = await request(app).get('/api/leads/track').query({ reference: publicLead.body.data.trackingReference });
  assert.equal(trackedLead.status, 200);
  assert.deepEqual(Object.keys(trackedLead.body.data.lead).sort(), ['createdAt', 'name', 'requirement', 'status', 'updatedAt']);
  const publicLeadRecord = await Lead.findOne({ email: 'public@example.test' });
  assert.equal(String(publicLeadRecord.ownerId), owner.id);
  assert.equal(publicLeadRecord.assignedTo, null);
  assert.equal(publicLeadRecord.status, 'NEW');
  assert.equal(publicLeadRecord.trackingCodeHash, undefined);
  const publicActivity = await LeadActivity.findOne({ lead: publicLeadRecord._id, type: 'ai_analyzed' });
  const qualifiedPublicLead = await Lead.findById(publicLeadRecord._id);
  assert.equal(qualifiedPublicLead.aiScore, analysis.score);
  assert.equal(qualifiedPublicLead.aiSummary, analysis.summary);
  assert.equal(qualifiedPublicLead.suggestedWhatsAppMessage, analysis.suggestedWhatsAppMessage);
  assert.equal(qualifiedPublicLead.detectedBudget, analysis.detectedBudget);
  assert.equal(publicActivity.message, 'AI qualification completed');
  assert.equal(publicActivity.metadata.score, analysis.score);
  assert.ok(publicActivity.createdAt instanceof Date);
  const dashboard = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${refreshedToken}`);
  assert.equal(dashboard.body.data.metrics.total, 2);
  assert.equal((await request(app).get('/api/leads').set('Authorization', `Bearer ${refreshedToken}`)).body.data.pagination.total, 2);

  const secondRegistration = await request(app).post('/api/auth/setup').send({ name: 'Second Employee', email: 'second@example.test', password: 'TestPassword!42' });
  assert.equal(secondRegistration.status, 403);
  assert.equal(secondRegistration.body.message, 'System initialization is closed. Only the administrator can invite new staff.');
  const secondAccount = await request(app).post('/api/users/employees').set('Authorization', `Bearer ${refreshedToken}`).send({ name: 'Second Employee', email: 'second@example.test', temporaryPassword: 'TestPassword!42' });
  assert.equal(secondAccount.status, 201);
  assert.equal(secondAccount.body.data.employee.role, 'employee');
  assert.equal(secondAccount.body.data.delivery.sent, false);
  assert.equal(secondAccount.body.data.credentials.temporaryPassword, 'TestPassword!42');
  const secondToken = (await request(app).post('/api/auth/login').send({ email: 'second@example.test', password: 'TestPassword!42' })).body.data.accessToken;
  const employeeId = secondAccount.body.data.employee.id;
  assert.equal((await request(app).get(`/api/leads/${leadId}`).set('Authorization', `Bearer ${secondToken}`)).status, 404);
  assert.equal((await request(app).post(`/api/leads/${leadId}/whatsapp`).set('Authorization', `Bearer ${secondToken}`)).status, 404);
  assert.equal((await request(app).get('/api/leads').set('Authorization', `Bearer ${secondToken}`)).body.data.pagination.total, 0);
  assert.equal((await request(app).get('/api/dashboard').set('Authorization', `Bearer ${secondToken}`)).body.data.metrics.total, 0);
  assert.equal((await request(app).get('/api/users/employees').set('Authorization', `Bearer ${secondToken}`)).status, 403);
  assert.equal((await request(app).patch(`/api/leads/${leadId}/assign`).set('Authorization', `Bearer ${secondToken}`).send({ employeeId })).status, 403);
  assert.equal((await request(app).patch(`/api/leads/${leadId}`).set('Authorization', `Bearer ${secondToken}`).send({ status: 'CLOSED' })).status, 404);
  assert.equal((await request(app).delete(`/api/leads/${leadId}`).set('Authorization', `Bearer ${secondToken}`)).status, 404);
  assert.equal((await request(app).post(`/api/leads/${leadId}/activities`).set('Authorization', `Bearer ${secondToken}`).send({ message: 'Cross-user note' })).status, 404);
  assert.equal((await request(app).post(`/api/leads/${leadId}/analyze`).set('Authorization', `Bearer ${secondToken}`)).status, 404);

  const employees = await request(app).get('/api/users/employees').set('Authorization', `Bearer ${refreshedToken}`);
  assert.deepEqual(employees.body.data.employees.map(({ id }) => id), [employeeId]);
  const assignment = await request(app).patch(`/api/leads/${leadId}/assign`).set('Authorization', `Bearer ${refreshedToken}`).send({ employeeId });
  assert.equal(assignment.status, 200);
  assert.equal(assignment.body.data.lead.assignedTo._id, employeeId);
  assert.equal((await request(app).get(`/api/leads/${leadId}`).set('Authorization', `Bearer ${secondToken}`)).status, 200);
  const employeeWhatsAppActivity = await request(app).post(`/api/leads/${leadId}/whatsapp`).set('Authorization', `Bearer ${secondToken}`);
  assert.equal(employeeWhatsAppActivity.status, 201);
  assert.equal(employeeWhatsAppActivity.body.data.activity.actor.name, 'Second Employee');
  assert.equal((await request(app).get('/api/leads').set('Authorization', `Bearer ${secondToken}`)).body.data.pagination.total, 1);
  assert.equal((await request(app).get('/api/dashboard').set('Authorization', `Bearer ${secondToken}`)).body.data.metrics.total, 1);
  assert.equal((await request(app).patch(`/api/leads/${leadId}`).set('Authorization', `Bearer ${secondToken}`).send({ assignedTo: null })).status, 400);
  assert.equal((await request(app).patch(`/api/leads/${leadId}/assign`).set('Authorization', `Bearer ${refreshedToken}`).send({ employeeId: null })).status, 200);
  assert.equal((await request(app).get(`/api/leads/${leadId}`).set('Authorization', `Bearer ${secondToken}`)).status, 404);

  const retrieved = await request(app).get(`/api/leads/${leadId}`).set('Authorization', `Bearer ${refreshedToken}`);
  assert.equal(retrieved.status, 200);
  assert.equal(retrieved.body.data.lead.name, 'Morgan Buyer');
  assert.ok(retrieved.body.data.activities.some((event) => event.type === 'created'));
  const whatsappActivity = await request(app).post(`/api/leads/${leadId}/whatsapp`).set('Authorization', `Bearer ${refreshedToken}`);
  assert.equal(whatsappActivity.status, 201);
  assert.equal(whatsappActivity.body.data.activity.type, 'whatsapp');
  assert.equal(whatsappActivity.body.data.activity.message, 'WhatsApp chat initiated by Test Owner');
  assert.equal(whatsappActivity.body.data.activity.actor.name, 'Test Owner');

  const member = await User.create({ name: 'Test Employee', email: 'employee@example.test', passwordHash: await bcrypt.hash('TestPassword!42', 4), role: 'employee' });
  const memberToken = createAccessToken(member);
  const employeeSettings = await request(app).get('/api/settings').set('Authorization', `Bearer ${memberToken}`);
  assert.equal(employeeSettings.status, 200);
  assert.equal(typeof employeeSettings.body.settings.autoAssign, 'boolean');
  const hiddenLead = await request(app).get(`/api/leads/${leadId}`).set('Authorization', `Bearer ${memberToken}`);
  assert.equal(hiddenLead.status, 404);
  const isolatedList = await request(app).get('/api/leads').set('Authorization', `Bearer ${memberToken}`);
  assert.equal(isolatedList.body.data.pagination.total, 0);
  const isolatedDashboard = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${memberToken}`);
  assert.equal(isolatedDashboard.body.data.metrics.total, 0);
  const deniedUpdate = await request(app).patch(`/api/leads/${leadId}`).set('Authorization', `Bearer ${memberToken}`).send({ status: 'CLOSED' });
  assert.equal(deniedUpdate.status, 404);
  const deniedNote = await request(app).post(`/api/leads/${leadId}/activities`).set('Authorization', `Bearer ${memberToken}`).send({ message: 'Cross-user note' });
  assert.equal(deniedNote.status, 404);
  const deniedWhatsApp = await request(app).post(`/api/leads/${leadId}/whatsapp`).set('Authorization', `Bearer ${memberToken}`);
  assert.equal(deniedWhatsApp.status, 404);
  const deniedAnalysis = await request(app).post(`/api/leads/${leadId}/analyze`).set('Authorization', `Bearer ${memberToken}`);
  assert.equal(deniedAnalysis.status, 404);
  const deniedDelete = await request(app).delete(`/api/leads/${leadId}`).set('Authorization', `Bearer ${memberToken}`);
  assert.equal(deniedDelete.status, 403);

  const aiResponse = await request(app).post(`/api/leads/${leadId}/analyze`).set('Authorization', `Bearer ${refreshedToken}`);
  assert.ok([200, 503].includes(aiResponse.status));

  const logout = await request(app).post('/api/auth/logout').set('Cookie', loginCookie.split(';')[0]);
  assert.equal(logout.status, 200);
  const logoutCookieHeader = logout.headers['set-cookie'].find((cookie) => cookie.startsWith('refreshToken=')) || '';
  const logoutCookieDetails = cookieDetails(logoutCookieHeader);
  assert.equal(logoutCookieDetails.name, 'refreshToken');
  assert.equal(logoutCookieDetails.attributes.path, '/api/auth');
  assert.equal(logoutCookieDetails.attributes.httponly, true);
  assert.match(String(logoutCookieDetails.attributes.expires), /Thu, 01 Jan 1970/i);
  assert.equal((await User.findById(owner._id).select('+refreshTokenHash')).refreshTokenHash, null);
  assert.equal((await request(app).post('/api/auth/refresh').set('Cookie', loginCookie.split(';')[0])).status, 401);
  await User.findByIdAndDelete(owner._id);
  const reopenedSetup = await request(app).get('/api/auth/setup-status');
  assert.equal(reopenedSetup.body.isSetupComplete, false);
  const replacementAdmin = await request(app).post('/api/auth/setup').send({ name: 'Replacement Owner', email: 'replacement@example.test', password: 'TestPassword!42' });
  assert.equal(replacementAdmin.status, 201);
  assert.equal(replacementAdmin.body.data.user.role, 'admin');
  assert.equal((await request(app).get('/api/auth/setup-status')).body.isSetupComplete, true);
  const roundRobinStaff = await User.find({ role: 'employee', status: { $ne: 'inactive' } }).sort({ createdAt: 1 }).select('_id').lean();
  assert.ok(roundRobinStaff.length > 1);
  const employeeSettingsUpdate = await request(app).put('/api/settings').set('Authorization', `Bearer ${memberToken}`).send({ autoAssign: true });
  assert.equal(employeeSettingsUpdate.status, 403);
  const enabledSettings = await request(app).put('/api/settings').set('Authorization', `Bearer ${replacementAdmin.body.data.accessToken}`).send({ autoAssign: true });
  assert.equal(enabledSettings.status, 200);
  assert.equal(enabledSettings.body.settings.autoAssign, true);
  for (let index = 0; index < roundRobinStaff.length * 2; index += 1) {
    const inquiry = await request(app).post('/api/leads/inquire').send({
      name: `Round Robin Lead ${index}`,
      phone: `555000${String(index).padStart(4, '0')}`,
      email: `round-robin-${index}@example.test`,
      requirement: 'Please contact me about a business service.'
    });
    assert.equal(inquiry.status, 201);
    assert.equal(inquiry.body.data.lead.assignedTo, String(roundRobinStaff[index % roundRobinStaff.length]._id));
    const assignmentActivity = await LeadActivity.findOne({ lead: inquiry.body.data.lead._id, type: 'assigned' });
    assert.equal(assignmentActivity.message, `Auto-assigned to ${roundRobinStaff[index % roundRobinStaff.length].name} via Round-Robin`);
  }
  await request(app).put('/api/settings').set('Authorization', `Bearer ${replacementAdmin.body.data.accessToken}`).send({ autoAssign: false }).expect(200);
  const manualInquiry = await request(app).post('/api/leads/inquire').send({
    name: 'Manual Queue Lead',
    phone: '5559990000',
    email: 'manual-queue@example.test',
    requirement: 'Please contact me about another business service.'
  });
  assert.equal(manualInquiry.status, 201);
  assert.equal(manualInquiry.body.data.lead.assignedTo, null);
  assert.equal((await request(app).get('/api/dashboard').set('Authorization', `Bearer ${refreshedToken}`)).status, 401);
});