import { randomBytes } from 'node:crypto';

process.env.NODE_ENV ||= 'test';
process.env.JWT_ACCESS_SECRET ||= randomBytes(32).toString('hex');
process.env.JWT_REFRESH_SECRET ||= randomBytes(32).toString('hex');
process.env.OPENAI_API_KEY = '';
process.env.GROQ_API_KEY = '';