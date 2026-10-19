import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export async function requireAuth(req, _res, next) {
  try {
    const authorization = req.get('authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token) throw new AppError(401, 'Sign in to continue.');
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'ai-lead-starter' });
    if (payload.type === 'refresh') throw new AppError(401, 'Use an access token for this request.');
    const user = await User.findById(payload.sub).select('name email role +tokenVersion');
    if (!user || (payload.tokenVersion || 0) !== (user.tokenVersion || 0)) throw new AppError(401, 'This session is no longer valid.');
    req.user = user;
    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError(401, 'Your session has expired.'));
  }
}

export function requireRole(...roles) {
  return (req, _res, next) => roles.includes(req.user?.role)
    ? next()
    : next(new AppError(403, 'You do not have permission to perform this action.'));
}

export const requireAdmin = requireRole('admin');