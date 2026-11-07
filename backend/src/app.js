import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { applySecurity } from './middlewares/security.middleware.js';
import {
  notFoundHandler,
  errorHandler,
} from './middlewares/errorHandler.middleware.js';
import apiRoutes from './routes/index.js';

const app = express();
const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

applySecurity(app);

// The webhook must receive the untouched request stream.
// Skip JSON parsing only for this exact endpoint; payment.routes.js installs
// express.raw() there. All other API endpoints use the regular JSON parser.
app.use((req, res, next) => {
  const pathname = (req.originalUrl || req.url).split('?')[0];

  if (pathname === '/api/payment/webhook') {
    return next();
  }

  return express.json({ limit: '1mb' })(req, res, next);
});

app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.use(
  '/uploads',
  express.static(path.resolve(currentDir, '../uploads'), {
    dotfiles: 'deny',
    index: false,
    fallthrough: false,
    maxAge: '1h',
  }),
);

app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;

if (process.env.NODE_ENV !== 'test') {
  const port = env.PORT ?? 4000;

  app.listen(port, () => {
    // Never print credentials or merchant identifiers here.
    console.info(`GridHand API listening on port ${port}`);
  });
}