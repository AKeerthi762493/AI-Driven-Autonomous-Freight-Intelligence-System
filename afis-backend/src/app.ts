import 'dotenv/config';
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import connectDB from './config/database';
import logger from './utils/logger';
import { errorHandler, notFound } from './middleware/errorHandler';
import { checkAndGenerateAlerts } from './controllers/alertController';

import authRoutes       from './routes/authRoutes';
import freightRoutes    from './routes/freightRoutes';
import wagonRoutes      from './routes/wagonRoutes';
import rakeRoutes       from './routes/rakeRoutes';
import routeRoutes      from './routes/routeRoutes';
import simulationRoutes from './routes/simulationRoutes';
import demandRoutes     from './routes/demandRoutes';
import analyticsRoutes  from './routes/analyticsRoutes';
import alertRoutes      from './routes/alertRoutes';
import aiRoutes         from './routes/aiRoutes';

const app: Application = express();
const PORT = process.env.PORT || 5000;

// ─── CORS ─────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const allowed = [
        'http://localhost:8080',
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:4173',
        process.env.FRONTEND_URL,
      ].filter(Boolean) as string[];

      if (allowed.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked request from: ${origin}`);
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── SECURITY ─────────────────────────────────────────────────
app.use(helmet());

// ─── RATE LIMITING (FIXED ✅) ─────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ✅ ONLY APPLY IN PRODUCTION
if (process.env.NODE_ENV === 'production') {
  app.use('/api/', limiter);
}

// ─── GENERAL MIDDLEWARE ───────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── HEALTH CHECK ─────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'AFIS Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── API ROUTES ───────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/freight',    freightRoutes);
app.use('/api/wagons',     wagonRoutes);
app.use('/api/rakes',      rakeRoutes);
app.use('/api/routes',     routeRoutes);
app.use('/api/simulation', simulationRoutes);
app.use('/api/demand',     demandRoutes);
app.use('/api/analytics',  analyticsRoutes);
app.use('/api/alerts',     alertRoutes);
app.use('/api/ai',         aiRoutes);

// ─── ERROR HANDLING ───────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── BOOT ─────────────────────────────────────────────────────
const startServer = async (): Promise<void> => {
  await connectDB();

  app.listen(PORT, () => {
    logger.info(`AFIS Backend running on http://localhost:${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`CORS allowed origin: ${process.env.FRONTEND_URL || 'http://localhost:8080'}`);
  });

  setInterval(checkAndGenerateAlerts, 10 * 60 * 1000);
};

startServer().catch((err) => {
  logger.error('Server failed to start:', err);
  process.exit(1);
});

export default app;