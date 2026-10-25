import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import leadRoutes from './routes/leadRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { errorHandler, notFound } from './utils/errors.js';

const app = express();
app.disable('x-powered-by');
app.locals.databaseInitialized = true;
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    const localOrigin = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin || '');
    const allowedOrigins = [...new Set([...env.CORS_ORIGINS.split(','), env.CLIENT_URL]
      .map((allowedOrigin) => allowedOrigin.trim().replace(/\/$/, ''))
      .filter(Boolean))];
    callback(null, !origin || localOrigin || allowedOrigins.includes(origin.replace(/\/$/, '')));
  },
  credentials: true
}));
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());
app.use((req, res, next) => {
  if (app.locals.databaseInitialized || req.path === '/api/health' || req.path === '/api/auth/setup-status') return next();
  res.status(503).json({ success: false, message: 'Database connecting...' });
});
app.get('/api/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/users', userRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;