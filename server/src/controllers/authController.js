import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { createAccessToken, createRefreshToken, hashToken, refreshCookieOptions } from '../services/tokens.js';
import { sendPasswordReset } from '../services/emailService.js';

const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email, role: user.role });
const setRefreshCookie = (res, token) => res.cookie('refreshToken', token, refreshCookieOptions);
const clearRefreshCookie = (res) => {
  const { maxAge: _maxAge, ...options } = refreshCookieOptions;
  res.clearCookie('refreshToken', options);
};

export async function register(req, res) {
  if (User.db.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Database connecting...' });
  }
  if (await User.exists({ role: 'admin' })) {
    return res.status(403).json({ success: false, message: 'Setup already completed. Please log in.' });
  }
  const { name, email, password } = req.validatedBody;
  if (await User.exists({ email })) throw new AppError(409, 'An account with this email already exists.');
  const user = await User.create({ name, email, role: 'admin', passwordHash: await bcrypt.hash(password, 12) });
  const refreshToken = createRefreshToken(user);
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();
  setRefreshCookie(res, refreshToken);
  res.status(201).json({ success: true, data: { user: publicUser(user), accessToken: createAccessToken(user) } });
}

export async function requireSetupOpen(_req, res, next) {
  try {
    if (User.db.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Database connecting...' });
    }
    if (await User.exists({ role: 'admin' })) {
      return res.status(403).json({ success: false, message: 'Setup already completed. Please log in.' });
    }
    next();
  } catch (error) {
    console.error(`[auth:setup] Setup check failed: ${error.message}`);
    res.status(503).json({ success: false, message: 'Database connecting...' });
  }
}

export async function setupStatus(_req, res) {
  try {
    if (_req.app?.locals.databaseInitialized === false || User.db.readyState !== 1) {
      return res.status(503).json({ success: false, isSetupComplete: null, message: 'Database connecting...' });
    }
    const adminExists = await User.exists({ role: 'admin' });
    res.json({ success: true, isSetupComplete: Boolean(adminExists) });
  } catch (error) {
    console.error(`[auth:setup-status] Database check failed: ${error.message}`);
    res.status(503).json({ success: false, isSetupComplete: null, message: 'Database connecting...' });
  }
}

export async function login(req, res) {
  const { email, password } = req.validatedBody;
  const user = await User.findOne({ email }).select('+passwordHash +refreshTokenHash +tokenVersion');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new AppError(401, 'Email or password is incorrect.');
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  const refreshToken = createRefreshToken(user);
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();
  setRefreshCookie(res, refreshToken);
  res.json({ success: true, data: { user: publicUser(user), accessToken: createAccessToken(user) } });
}

export async function refresh(req, res) {
  const token = req.cookies.refreshToken;
  if (!token) throw new AppError(401, 'Refresh session is missing. Sign in again.');
  let user;
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET, { issuer: 'ai-lead-starter' });
    user = await User.findById(payload.sub).select('+refreshTokenHash +tokenVersion');
  } catch {
    clearRefreshCookie(res);
    throw new AppError(401, 'Refresh session has expired. Sign in again.');
  }

  if (!user?.refreshTokenHash || user.refreshTokenHash !== hashToken(token)) {
    if (user) {
      user.refreshTokenHash = null;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();
    }
    clearRefreshCookie(res);
    throw new AppError(401, 'Refresh session is no longer valid. Sign in again.');
  }

  // NOTE: Token rotation removed so the original 2-minute refresh expiry remains fixed.
  // Sirf naya access token bhej rahe hain:
  res.json({ success: true, data: { user: publicUser(user), accessToken: createAccessToken(user) } });
}

export async function logout(req, res) {
  const token = req.cookies.refreshToken;
  if (token) {
    const digest = hashToken(token);
    const user = await User.findOne({ refreshTokenHash: digest }).select('+refreshTokenHash +tokenVersion');
    if (user) {
      user.refreshTokenHash = null;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();
    }
  }
  clearRefreshCookie(res);
  res.json({ success: true, data: { message: 'Signed out.' } });
}

export async function forgotPassword(req, res) {
  const user = await User.findOne({ email: req.validatedBody.email });
  if (user) {
    const token = randomBytes(32).toString('hex');
    user.resetTokenHash = createHash('sha256').update(token).digest('hex');
    user.resetTokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
    sendPasswordReset(user, token).catch((error) => {
      console.error('[SMTP Error]: Password reset dispatch failed.', {
        code: error?.code,
        response: error?.response,
        message: error?.message
      }, error);
    });
  }
  res.json({ success: true, data: { message: 'If an account exists for that email, reset instructions have been sent.' } });
}

export async function resetPassword(req, res) {
  const tokenHash = createHash('sha256').update(req.validatedBody.token).digest('hex');
  const user = await User.findOne({ resetTokenHash: tokenHash, resetTokenExpiresAt: { $gt: new Date() } }).select('+resetTokenHash +refreshTokenHash +tokenVersion');
  if (!user) throw new AppError(400, 'Reset link is invalid or expired.');
  user.passwordHash = await bcrypt.hash(req.validatedBody.password, 12);
  user.resetTokenHash = null;
  user.resetTokenExpiresAt = null;
  user.refreshTokenHash = null;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  clearRefreshCookie(res);
  res.json({ success: true, data: { message: 'Password updated. Sign in with your new password.' } });
}

export async function me(req, res) {
  res.json({ success: true, data: { user: publicUser(req.user) } });
}