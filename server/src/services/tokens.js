import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function createAccessToken(user) {
  return jwt.sign({ id: user.id, role: user.role, email: user.email, tokenVersion: user.tokenVersion || 0 }, env.JWT_ACCESS_SECRET, {
    subject: user.id,
    issuer: 'ai-lead-starter',
    expiresIn: env.ACCESS_TOKEN_TTL
  });
}

export function createRefreshToken(user) {
  return jwt.sign({ id: user.id, role: user.role, email: user.email, type: 'refresh', nonce: randomUUID() }, env.JWT_REFRESH_SECRET, {
    subject: user.id,
    issuer: 'ai-lead-starter',
    expiresIn: env.REFRESH_TOKEN_TTL
  });
}

export const refreshCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production' || env.REFRESH_COOKIE_SAME_SITE === 'none',
  sameSite: env.REFRESH_COOKIE_SAME_SITE,
  path: '/api/auth',
  maxAge: 15 * 24 * 60 * 60 * 1000
};