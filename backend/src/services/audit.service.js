import prisma from '../config/database.js';
import logger from '../utils/logger.util.js';

// Never throws: auditing must not break the request flow.
export async function logEvent({ userId, action, entity, entityId, req, metadata } = {}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? req?.user?.id ?? null,
        action,
        entity: entity ?? null,
        entityId: entityId != null ? String(entityId) : null,
        ip: req?.ip ?? null,
        userAgent: req?.get?.('user-agent')?.slice(0, 255) ?? null,
        metadata: metadata ?? undefined,
      },
    });
  } catch (err) {
    logger.error('Audit log failed', { action, error: err.message });
  }
}