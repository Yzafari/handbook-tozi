import { PrismaClient } from '@prisma/client';

// If the project already exposes a shared Prisma client, import that instead
// of instantiating a new one here (multiple clients exhaust the connection pool).
const prisma = new PrismaClient();

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
 * Returns every calculation history record owned by the given user,
 * newest first.
 *
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
export async function getUserHistory(userId) {
  return prisma.calculationHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}
