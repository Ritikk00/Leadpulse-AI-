import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export function requireWebhookSecret(req, _res, next) {
  const provided = req.get('x-webhook-secret') || '';
  const expected = env.WEBHOOK_SECRET;
  if (!expected && env.NODE_ENV !== 'production') return next();
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (!expected || providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    return next(new AppError(401, 'A valid webhook secret is required.'));
  }
  next();
}