import prisma from '../config/database.js';
import logger from '../utils/logger.util.js';

export async function logEvent({ userId, action, entity, entityId, req, metadata } = {}) {
  try {
    // ساخت آبجکت details به صورت JSON String که با دیتابیس هماهنگ باشد
    const detailsData = {
      entity: entity ?? null,
      entityId: entityId !== null ? String(entityId) : null,
      ip: req?.ip ?? null,
      userAgent: req?.get?.('user-agent')?.slice(0, 255) ?? null,
      metadata: metadata ?? undefined,
    };

    await prisma.adminLog.create({
      data: {
        adminId: userId ?? req?.user?.id ?? null,
        action: action || 'UNKNOWN_ACTION',
        details: JSON.stringify(detailsData),
      },
    });
  } catch (err) {
    logger.error('Audit log failed', { action, error: err.message });
  }
}