import express from 'express';
import path from 'path';
import { applySecurity } from './middlewares/security.middleware.js';
import { globalLimiter } from './middlewares/rateLimit.middleware.js';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler.middleware.js';
import routes from './routes/index.js';

const app = express();

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
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Global rate limit for the API surface.
app.use(globalLimiter);

// All application routes live under /api (see routes/index.js).
app.use('/api', routes);

// 404 + centralized error handling. These must be registered last.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
