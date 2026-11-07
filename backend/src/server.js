import app from './app.js';
import { env } from './config/env.js';
import prisma from './config/database.js';
import logger from './utils/logger.util.js';
import { startCronJobs } from './services/cron.service.js';

let server;
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, shutting down gracefully`);

  const force = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
  force.unref();

  if (!server) {
    process.exit(0);
  }

  server.close(async (err) => {
    try {
      await prisma.$disconnect();
    } catch (e) {
      logger.error('Error disconnecting database', { error: e.message });
    }
    process.exit(err ? 1 : 0);
  });
  server.closeIdleConnections?.();
}

async function main() {
  try {
    await prisma.$connect();
    logger.info('Database connected');
  } catch (err) {
    logger.error('Database connection failed', { error: err.message });
    process.exit(1);
  }

  server = app.listen(env.PORT, () => {
    logger.info(`API listening on port ${env.PORT} (${env.NODE_ENV})`);
    startCronJobs();
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: reason?.message || String(reason) });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  shutdown('uncaughtException');
});

main();