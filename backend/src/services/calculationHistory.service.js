import { PrismaClient } from '@prisma/client';

// If the project already exposes a shared Prisma client, import that instead
// of instantiating a new one here (multiple clients exhaust the connection pool).
const prisma = new PrismaClient();

const USER_SELECT = { select: { name: true, email: true } };

/**
 * Persists a single calculation history record for the given user.
 *
 * @param {string} userId - Owner of the record (from the authenticated request).
 * @param {object} data - Validated payload.
 * @param {string} data.toolId
 * @param {string} data.toolVersion
 * @param {object} data.inputData
 * @param {object} data.outputData
 * @param {object|null} [data.sources]
 * @returns {Promise<object>} The created record.
 */
export async function createHistory(userId, data) {
  const { toolId, toolVersion, inputData, outputData, sources } = data;

  return prisma.calculationHistory.create({
    data: {
      userId,
      toolId,
      toolVersion,
      inputData,
      outputData,
      sources: sources === undefined || sources === null ? null : sources,
    },
  });
}

/**
 * Bulk-inserts calculation history records for the sync endpoint.
 *
 * `createdAt` is preserved when the client supplies a valid timestamp so that
 * offline records keep their original calculation time. When it is omitted,
 * the database default (`now()`) applies.
 *
 * `skipDuplicates` only has an effect if a unique constraint exists on the
 * model; CalculationHistory currently has none, so it is a no-op today.
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
 * @param {boolean} [isAdmin=false] - When true, returns records for all users.
 * @returns {Promise<object[]>}
 */
export async function getUserHistory(userId, isAdmin = false) {
  if (isAdmin) {
    return prisma.calculationHistory.findMany({
      include: { user: USER_SELECT },
      orderBy: { createdAt: 'desc' },
    });
  }

  return prisma.calculationHistory.findMany({
    where: { userId },
    include: { user: USER_SELECT },
    orderBy: { createdAt: 'desc' },
  });
}
