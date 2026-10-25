import 'dotenv/config';
import { createHash } from 'node:crypto';
import { z } from 'zod';

const jwtSecretBase = process.env.JWT_SECRET || '';
const deriveJwtSecret = (purpose) => jwtSecretBase
  ? createHash('sha256').update(`${jwtSecretBase}:leadpulse:${purpose}`).digest('hex')
  : '';
const emailPort = Number(process.env.EMAIL_PORT || process.env.SMTP_PORT || 465);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGO_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/ai-lead-management'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().optional().default(''),
  JWT_SECRET: z.string().min(32).optional(),
  JWT_ACCESS_SECRET: z.string().min(32).default(deriveJwtSecret('access')),
  JWT_REFRESH_SECRET: z.string().min(32).default(deriveJwtSecret('refresh')),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
 REFRESH_TOKEN_TTL: z.string().default('15d'),
  GROQ_API_KEY: z.string().optional().default(process.env.OPENAI_API_KEY || ''),
  GROQ_BASE_URL: z.string().url().default('https://api.groq.com/openai/v1'),
  EMAIL_HOST: z.string().optional().default(process.env.SMTP_HOST || 'smtp.gmail.com'),
  EMAIL_PORT: z.coerce.number().int().positive().default(emailPort),
  EMAIL_SECURE: z.enum(['true', 'false']).optional().default(process.env.EMAIL_SECURE || String(emailPort === 465)).transform((value) => value === 'true'),
  EMAIL_USER: z.string().optional().default(process.env.SMTP_USER || ''),
  EMAIL_PASS: z.string().optional().default(process.env.SMTP_PASSWORD || ''),
  EMAIL_FROM: z.string().optional().default(process.env.SMTP_FROM || ''),
  EMAIL_TLS_REJECT_UNAUTHORIZED: z.enum(['true', 'false']).optional().default('true').transform((value) => value === 'true'),
  REFRESH_COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).optional().default(process.env.NODE_ENV === 'production' ? 'none' : 'lax'),
  ADMIN_NOTIFICATION_EMAIL: z.string().email().optional().or(z.literal('')),
  LEAD_ACKNOWLEDGEMENT_ENABLED: z.string().default('false'),
  WEBHOOK_SECRET: z.string().optional().default('')
});

export const env = envSchema.parse(process.env);