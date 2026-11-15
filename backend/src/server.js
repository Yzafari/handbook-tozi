import app from './app.js';
import prisma from './config/database.js';
import { startCronJobs } from './services/cron.service.js';
import logger from './utils/logger.util.js';
import { env } from './config/env.js';
import { closeRedisCache } from './services/cache/redis-cache.js';

const port = env.PORT;
const SHUTDOWN_TIMEOUT_MS = 10_000;

const server = app.listen(port, () => {
  logger.info(`Server listening on port ${port}`);
  startCronJobs();
});

// Bind failures (e.g. EADDRINUSE) are emitted on the server, not thrown, so
// without this handler the process would crash with an unhandled 'error' event.
server.on('error', (error) => {
  logger.error('HTTP server error:', { message: error?.message, code: error?.code });
  shutdown('serverError');
});

let isShuttingDown = false;

async function shutdown(signal) {
  // Multiple signals (or a signal plus an uncaught exception) can arrive in
  // quick succession; only the first one should drive the shutdown.
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // If a connection refuses to close, force the process down rather than
  // hanging forever. The timer is intentionally not unref'd: it must keep the
  // event loop alive long enough to fire if close() never completes.
  const forceExitTimer = setTimeout(() => {
    logger.error(`Graceful shutdown timed out after ${SHUTDOWN_TIMEOUT_MS}ms. Forcing exit.`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
      // Node 18.2+: proactively close idle keep-alive connections so close()
      // can complete instead of waiting for them to time out.
      server.closeIdleConnections?.();
    });
    logger.info('HTTP server closed.');

    await prisma.$disconnect();
    await closeRedisCache();
    logger.info('Database and cache connections closed.');

    clearTimeout(forceExitTimer);
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', {
      message: error?.message,
      stack: error?.stack,
    });
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', {
    message: reason?.message ?? String(reason),
    stack: reason?.stack,
  });
  shutdown('unhandledRejection');
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', {
    message: error?.message,
    stack: error?.stack,
  });
  shutdown('uncaughtException');
});
