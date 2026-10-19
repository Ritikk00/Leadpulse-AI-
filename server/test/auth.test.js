import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { createAccessToken, createRefreshToken, hashToken, refreshCookieOptions } from '../src/services/tokens.js';
import { requireAdmin, requireRole } from '../src/middleware/auth.js';
import User from '../src/models/User.js';
import Settings from '../src/models/Settings.js';
import { requireSetupOpen, setupStatus } from '../src/controllers/authController.js';

test('access and refresh JWTs have distinct purpose and refresh token is cookie-only', () => {
  const user = { id: '507f1f77bcf86cd799439011', role: 'admin' };
  const access = jwt.decode(createAccessToken(user));
  const refresh = jwt.decode(createRefreshToken(user));
  assert.equal(access.type, undefined);
  assert.equal(refresh.type, 'refresh');
  assert.equal(refresh.sub, user.id);
  assert.equal(refreshCookieOptions.httpOnly, true);
  assert.equal(refreshCookieOptions.sameSite, 'strict');
  assert.equal(refreshCookieOptions.secure, process.env.NODE_ENV === 'production');
  assert.notEqual(hashToken(createRefreshToken(user)), hashToken(createRefreshToken(user)));
});

test('roles default to employee and only admins pass the admin guard', () => {
  assert.deepEqual(User.schema.path('role').enumValues, ['admin', 'employee']);
  assert.equal(User.schema.path('role').defaultValue, 'employee');
  let error;
  requireAdmin({ user: { role: 'employee' } }, {}, (value) => { error = value; });
  assert.equal(error.status, 403);
  requireRole('admin')({ user: { role: 'admin' } }, {}, (value) => { error = value; });
  assert.equal(error, undefined);
});

test('workspace auto-assignment defaults to manual mode', () => {
  assert.equal(Settings.schema.path('autoAssign').defaultValue, false);
});

test('setup status reports database readiness without treating it as a completed setup', async () => {
  const originalReadyState = User.db.readyState;
  let statusCode;
  let body;
  const response = {
    status(code) { statusCode = code; return this; },
    json(value) { body = value; return this; }
  };

  try {
    User.db.readyState = 0;
    await setupStatus({}, response);
    assert.equal(statusCode, 503);
    assert.deepEqual(body, { success: false, isSetupComplete: null, message: 'Database connecting...' });
  } finally {
    User.db.readyState = originalReadyState;
  }
});

test('setup is forbidden before request validation when an admin exists', async () => {
  const originalReadyState = User.db.readyState;
  const originalExists = User.exists;
  let statusCode;
  let body;
  let continued = false;
  const response = {
    status(code) { statusCode = code; return this; },
    json(value) { body = value; return this; }
  };

  try {
    User.db.readyState = 1;
    User.exists = async () => ({ _id: '507f1f77bcf86cd799439011' });
    await requireSetupOpen({}, response, () => { continued = true; });
    assert.equal(statusCode, 403);
    assert.deepEqual(body, { success: false, message: 'Setup already completed. Please log in.' });
    assert.equal(continued, false);
  } finally {
    User.db.readyState = originalReadyState;
    User.exists = originalExists;
  }
});