import prisma from '../config/database.js';
import logger from '../utils/logger.util.js';

// Returns the created notification, or null on failure (logged, never thrown).
// Optional second argument lets callers pass a Prisma transaction client.
export async function createNotification({ userId, type = 'INFO', title, body }, db = prisma) {
  try {
    return await db.notification.create({
      data: { userId, type, title, body },
    });
  } catch (err) {
    logger.error('Create notification failed', { userId, type, error: err.message });
    return null;
  }
}