import prisma from '../config/database.js';

const USER_SELECT = { select: { name: true, email: true } };

/**
 * Persists a single calculation history record for the given user.
 *
 * `clientId` is the client-generated id of the record. It makes the write
 * idempotent: re-sending the same offline record (for example after a flaky
 * network) returns the existing row instead of duplicating it.
 *
 * @param {string} userId - Owner of the record (from the authenticated request).
 * @param {object} data - Validated payload.
 * @param {string} data.toolId
 * @param {string} data.toolVersion
 * @param {object} data.inputData
 * @param {object} data.outputData
 * @param {object|null} [data.sources]
 * @param {string|null} [data.clientId]
 * @returns {Promise<object>} The created (or previously stored) record.
 */
export async function createHistory(userId, data) {
  const { toolId, toolVersion, inputData, outputData, sources, clientId } = data;

  const payload = {
    userId,
    toolId,
    toolVersion,
    inputData,
    outputData,
    sources: sources === undefined || sources === null ? null : sources,
    clientId: clientId || null,
  };

  if (payload.clientId) {
    const existing = await prisma.calculationHistory.findUnique({
      where: { userId_clientId: { userId, clientId: payload.clientId } },
    });
    if (existing) return existing;
  }

  return prisma.calculationHistory.create({ data: payload });
}

/**
 * Bulk-inserts calculation history records for the sync endpoint.
 *
 * `createdAt` is preserved when the client supplies a valid timestamp so that
 * offline records keep their original calculation time. When it is omitted,
 * the database default (`now()`) applies.
 *
 * `skipDuplicates` is only meaningful together with the `(userId, clientId)`
 * unique constraint: records already synced in an earlier batch are skipped.
 * Rows without a `clientId` are always inserted (Postgres allows several
 * NULLs in a unique index).
 *
 * @param {string} userId - Owner of every record in the batch.
 * @param {object[]} items - Validated payloads.
 * @returns {Promise<{ count: number }>} Number of inserted rows.
 */
export async function createHistoryItems(userId, items) {
  const data = items.map((item) => ({
    userId,
    toolId: item.toolId,
    toolVersion: item.toolVersion,
    inputData: item.inputData,
    outputData: item.outputData,
    sources: item.sources === undefined || item.sources === null ? null : item.sources,
    clientId: item.clientId || null,
    ...(item.createdAt ? { createdAt: new Date(item.createdAt) } : {}),
  }));

  return prisma.calculationHistory.createMany({
    data,
    skipDuplicates: true,
  });
}

/**
 * Returns calculation history records, newest first.
 *
 * @param {string} userId - The authenticated user's id.
 * @param {object} [options]
 * @param {boolean} [options.isAdmin=false] - When true, returns records for all users.
 * @param {number} [options.limit=50] - Page size (already clamped by the controller).
 * @param {string|null} [options.cursor=null] - Id of the last record of the previous page.
 * @returns {Promise<object[]>} One page of records, plus one extra row used to
 *   compute `hasMore`.
 */
export async function getUserHistory(userId, { isAdmin = false, limit = 50, cursor = null } = {}) {
  const where = isAdmin ? {} : { userId };
  if (cursor) where.id = { lt: cursor };

  return prisma.calculationHistory.findMany({
    where,
    include: { user: USER_SELECT },
    orderBy: { createdAt: 'desc' },
    // One extra row tells the caller whether another page exists without a
    // second COUNT query.
    take: limit + 1,
  });
}
