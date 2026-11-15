import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { applySecurity } from './middlewares/security.middleware.js';
import { globalLimiter } from './middlewares/rateLimit.middleware.js';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler.middleware.js';
import routes from './routes/index.js';
import { UPLOADS_DIR } from './config/paths.js';
import v1Routes from './routes/v1/index.js';

const app = express();

app.use((req, res, next) => {
  const supplied = req.headers['x-request-id'];
  req.requestId = typeof supplied === 'string' && supplied.length <= 128 ? supplied : randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// Trust the first proxy hop so req.ip and the rate limiter see the real client
// IP when the app runs behind nginx or a load balancer.
app.set('trust proxy', 1);

// Helmet, CORS, HPP, and cookie parsing. Must run before any route that reads
// req.cookies (e.g. the CSRF and refresh-token middleware).
applySecurity(app);

// Body parsers. File uploads go through multer in user.routes.js, so the JSON
// limit only needs to cover normal API payloads.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Serve uploaded avatars. Registered before the rate limiter so that loading
// images does not consume the API request budget.
app.use('/uploads', express.static(UPLOADS_DIR));

// Global rate limit for the API surface.
app.use(globalLimiter);

// All application routes live under /api (see routes/index.js).
app.use('/api', routes);
// Versioned mobile API; legacy web API remains available during migration.
app.use('/api/v1', v1Routes);

// 404 + centralized error handling. These must be registered last.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
