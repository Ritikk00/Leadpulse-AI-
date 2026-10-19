import 'dotenv/config';
import { createHash } from 'node:crypto';
import { z } from 'zod';

const jwtSecretBase = process.env.JWT_SECRET || '';
const deriveJwtSecret = (purpose) => jwtSecretBase
  ? createHash('sha256').update(`${jwtSecretBase}:leadpulse:${purpose}`).digest('hex')
  : '';

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
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  SMTP_FROM: z.string().optional().default(''),
  ADMIN_NOTIFICATION_EMAIL: z.string().email().optional().or(z.literal('')),
  LEAD_ACKNOWLEDGEMENT_ENABLED: z.string().default('false'),
  WEBHOOK_SECRET: z.string().optional().default('')
});

export const env = envSchema.parse(process.env);