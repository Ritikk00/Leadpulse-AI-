import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function createAccessToken(user) {
  return jwt.sign({ role: user.role, tokenVersion: user.tokenVersion || 0 }, env.JWT_ACCESS_SECRET, {
    subject: user.id,
    issuer: 'ai-lead-starter',
    expiresIn: env.ACCESS_TOKEN_TTL
  });
}

export function createRefreshToken(user) {
  return jwt.sign({ role: user.role, type: 'refresh', nonce: randomUUID() }, env.JWT_REFRESH_SECRET, {
    subject: user.id,
    issuer: 'ai-lead-starter',
    expiresIn: env.REFRESH_TOKEN_TTL // Yahan direct REFRESH_TOKEN_TTL ('15d') aayega
  });
}

export const refreshCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/auth',
  maxAge: 15 * 24 * 60 * 60 * 1000 // Direct 15 din milliseconds me
};