import { createHash } from 'node:crypto';
import prisma from '../../config/database.js';
import { AppError } from '../../utils/response.util.js';
import { getSyncEntity } from '../../core/sync-entity-registry.js';

function validateOperation(operation) {
  if (!operation || typeof operation !== 'object') throw new AppError(400, 'INVALID_SYNC_OPERATION', 'عملیات همگام‌سازی معتبر نیست');
  const syncEntity = getSyncEntity(operation.moduleName, operation.entityType);
  if (!syncEntity) throw new AppError(400, 'UNSUPPORTED_SYNC_MODULE', 'این ماژول هنوز از همگام‌سازی پشتیبانی نمی‌کند');
  if (!['CREATE', 'UPDATE', 'DELETE'].includes(operation.operation)) throw new AppError(400, 'INVALID_SYNC_OPERATION', 'نوع عملیات معتبر نیست');
  if (typeof operation.operationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(operation.operationId)) throw new AppError(400, 'INVALID_OPERATION_ID', 'شناسه عملیات معتبر نیست');
  if (typeof operation.entityId !== 'string' || !operation.entityId.trim() || operation.entityId.length > 128) throw new AppError(400, 'INVALID_ENTITY_ID', 'شناسه رکورد معتبر نیست');
  if (operation.operation !== 'CREATE' && (!Number.isInteger(operation.baseVersion) || operation.baseVersion < 1)) throw new AppError(400, 'BASE_VERSION_REQUIRED', 'نسخه مبنای رکورد الزامی است');
  if (operation.operation !== 'DELETE' && (!operation.payload || typeof operation.payload !== 'object' || Array.isArray(operation.payload) || !syncEntity.validatePayload(operation.payload))) throw new AppError(400, 'INVALID_SYNC_PAYLOAD', 'محتوای عملیات با قرارداد ماژول مطابقت ندارد');
}

function requestHash(operation) {
  const canonical = JSON.stringify({
    moduleName: operation.moduleName, entityType: operation.entityType, entityId: operation.entityId,
    operation: operation.operation, baseVersion: operation.baseVersion ?? null, payload: operation.payload ?? null,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

async function applyOne(userId, operation) {
  validateOperation(operation);
  const hash = requestHash(operation);
  const previous = await prisma.syncOperation.findUnique({ where: { operationId: operation.operationId } });
  if (previous) {
    if (previous.userId !== userId || previous.requestHash !== hash) throw new AppError(409, 'IDEMPOTENCY_KEY_REUSED', 'شناسه عملیات قبلاً برای درخواست دیگری استفاده شده است');
    return { operationId: operation.operationId, status: previous.resultStatus, version: previous.resultVersion, reason: previous.conflictReason };
  }

  const unique = { userId, moduleName: operation.moduleName, entityType: operation.entityType, entityId: operation.entityId };
  try {
    return await prisma.$transaction(async tx => {
    const existing = await tx.syncRecord.findUnique({ where: { userId_moduleName_entityType_entityId: unique } });
    let resultStatus = 'ACCEPTED';
    let resultVersion = null;
    let conflictReason = null;

    if (operation.operation === 'CREATE') {
      if (existing?.isDeleted) {
        const restored = await tx.syncRecord.updateMany({
          where: { id: existing.id, version: existing.version, isDeleted: true },
          data: { payload: operation.payload, isDeleted: false, version: { increment: 1 }, updatedAt: new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1)) },
        });
        if (restored.count === 1) resultVersion = existing.version + 1;
        else { resultStatus = 'CONFLICT'; conflictReason = 'VERSION_CONFLICT'; resultVersion = existing.version; }
      } else if (existing) {
        resultStatus = 'CONFLICT';
        conflictReason = 'RECORD_ALREADY_EXISTS';
        resultVersion = existing.version;
      } else {
        const record = await tx.syncRecord.create({ data: { ...unique, payload: operation.payload, version: 1 } });
        resultVersion = record.version;
      }
    } else if (!existing || existing.isDeleted) {
      resultStatus = 'CONFLICT';
      conflictReason = 'RECORD_NOT_FOUND';
      resultVersion = existing?.version ?? null;
    } else if (existing.version !== operation.baseVersion) {
      resultStatus = 'CONFLICT';
      conflictReason = 'VERSION_CONFLICT';
      resultVersion = existing.version;
    } else {
      const changed = await tx.syncRecord.updateMany({
        where: { id: existing.id, version: operation.baseVersion, isDeleted: false },
        data: operation.operation === 'DELETE'
          ? { isDeleted: true, version: { increment: 1 }, updatedAt: new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1)) }
          : { payload: operation.payload, version: { increment: 1 }, updatedAt: new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1)) },
      });
      if (changed.count !== 1) {
        resultStatus = 'CONFLICT';
        conflictReason = 'VERSION_CONFLICT';
        const latest = await tx.syncRecord.findUnique({ where: { id: existing.id } });
        resultVersion = latest?.version ?? null;
      } else resultVersion = operation.baseVersion + 1;
    }

    await tx.syncOperation.create({ data: {
      operationId: operation.operationId,
      userId,
      moduleName: operation.moduleName,
      entityType: operation.entityType,
      entityId: operation.entityId,
      operation: operation.operation,
      requestHash: hash,
      resultStatus,
      resultVersion,
      conflictReason,
    } });
    return { operationId: operation.operationId, status: resultStatus, version: resultVersion, reason: conflictReason };
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      const previousOperation = await prisma.syncOperation.findUnique({ where: { operationId: operation.operationId } });
      if (previousOperation?.userId === userId) {
        if (previousOperation.requestHash !== hash) throw new AppError(409, 'IDEMPOTENCY_KEY_REUSED', 'شناسه عملیات قبلاً برای درخواست دیگری استفاده شده است');
        return { operationId: operation.operationId, status: previousOperation.resultStatus, version: previousOperation.resultVersion, reason: previousOperation.conflictReason };
      }
      const concurrentRecord = await prisma.syncRecord.findUnique({ where: { userId_moduleName_entityType_entityId: unique } });
      if (concurrentRecord) {
        const conflictReason = 'RECORD_ALREADY_EXISTS';
        const conflict = await prisma.syncOperation.create({ data: {
          operationId: operation.operationId, userId, moduleName: operation.moduleName,
          entityType: operation.entityType, entityId: operation.entityId, operation: operation.operation, requestHash: hash,
          resultStatus: 'CONFLICT', resultVersion: concurrentRecord.version, conflictReason,
        } });
        return { operationId: operation.operationId, status: conflict.resultStatus, version: conflict.resultVersion, reason: conflict.conflictReason };
      }
    }
    throw error;
  }
}

export async function pushOperations(userId, operations) {
  if (!Array.isArray(operations) || operations.length < 1 || operations.length > 50) throw new AppError(400, 'INVALID_SYNC_BATCH', 'هر بسته همگام‌سازی باید بین ۱ تا ۵۰ عملیات داشته باشد');
  const seen = new Set();
  const results = [];
  for (const operation of operations) {
    if (seen.has(operation?.operationId)) throw new AppError(400, 'DUPLICATE_OPERATION_ID', 'شناسه عملیات در یک بسته تکراری است');
    seen.add(operation?.operationId);
    try {
      results.push(await applyOne(userId, operation));
    } catch (error) {
      // Concurrent retries with the same idempotency key can race on the unique index.
      if (error?.code === 'P2002' && operation?.operationId) {
        const previous = await prisma.syncOperation.findUnique({ where: { operationId: operation.operationId } });
        if (previous?.userId === userId) {
          if (previous.requestHash !== requestHash(operation)) throw new AppError(409, 'IDEMPOTENCY_KEY_REUSED', 'شناسه عملیات قبلاً برای درخواست دیگری استفاده شده است');
          results.push({ operationId: operation.operationId, status: previous.resultStatus, version: previous.resultVersion, reason: previous.conflictReason });
          continue;
        }
      }
      throw error;
    }
  }
  return {
    acceptedOperationIds: results.filter(item => item.status === 'ACCEPTED').map(item => item.operationId),
    acceptedVersions: results.filter(item => item.status === 'ACCEPTED').map(item => ({ operationId: item.operationId, version: item.version })),
    conflicts: results.filter(item => item.status === 'CONFLICT').map(item => ({ operationId: item.operationId, reason: item.reason, currentVersion: item.version })),
  };
}

function encodeCursor(value) { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!value || typeof value.updatedAt !== 'string' || typeof value.id !== 'string') throw new Error('invalid');
    const date = new Date(value.updatedAt);
    if (Number.isNaN(date.getTime())) throw new Error('invalid');
    return { updatedAt: date, id: value.id };
  } catch { throw new AppError(400, 'INVALID_SYNC_CURSOR', 'نشانگر همگام‌سازی معتبر نیست'); }
}

export async function pullChanges(userId, cursor, limit = 100) {
  const decoded = decodeCursor(cursor);
  const where = {
    userId,
    ...(decoded ? { OR: [
      { updatedAt: { gt: decoded.updatedAt } },
      { updatedAt: decoded.updatedAt, id: { gt: decoded.id } },
    ] } : {}),
  };
  const rows = await prisma.syncRecord.findMany({ where, orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }], take: limit + 1 });
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return {
    items: items.map(row => ({ moduleName: row.moduleName, entityType: row.entityType, entityId: row.entityId, version: row.version, deleted: row.isDeleted, payload: row.isDeleted ? null : row.payload, updatedAt: row.updatedAt })),
    nextCursor: last ? encodeCursor({ updatedAt: last.updatedAt.toISOString(), id: last.id }) : cursor ?? null,
    hasMore,
  };
}

export async function getSyncStatus(userId) {
  const [pending, conflicts, lastChange] = await Promise.all([
    prisma.syncOperation.count({ where: { userId, resultStatus: 'ACCEPTED', createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    prisma.syncOperation.count({ where: { userId, resultStatus: 'CONFLICT', createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
    prisma.syncRecord.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
  ]);
  return { acceptedLast24Hours: pending, conflictsLast30Days: conflicts, lastChangeAt: lastChange?.updatedAt ?? null };
}


export async function getSyncRecord(userId, moduleName, entityType, entityId) {
  if (!getSyncEntity(moduleName, entityType)) throw new AppError(404, 'NOT_FOUND', 'رکورد همگام‌سازی یافت نشد');
  const record = await prisma.syncRecord.findUnique({
    where: { userId_moduleName_entityType_entityId: { userId, moduleName, entityType, entityId } },
  });
  if (!record) throw new AppError(404, 'NOT_FOUND', 'رکورد همگام‌سازی یافت نشد');
  return { moduleName: record.moduleName, entityType: record.entityType, entityId: record.entityId, version: record.version, deleted: record.isDeleted, payload: record.isDeleted ? null : record.payload, updatedAt: record.updatedAt };
}
