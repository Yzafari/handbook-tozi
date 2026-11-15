import prisma from '../../config/database.js';
import asyncHandler from '../../utils/asyncHandler.util.js';
import { env } from '../../config/env.js';

async function checkDatabase() {
  await prisma.$queryRaw`SELECT 1`;
  return true;
}

async function checkHttp(url, headers = {}) {
  if (!url) return false;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(1800) });
  return response.ok;
}

async function checkStorage() {
  const base = env.DATACENTER_URL.replace(/\/$/, '');
  return checkHttp(base ? `${base}/health` : null);
}

async function checkSearch() {
  const base = env.OPENSEARCH_URL.replace(/\/$/, '');
  const headers = {};
  if (process.env.OPENSEARCH_USERNAME && process.env.OPENSEARCH_PASSWORD) {
    headers.authorization = `Basic ${Buffer.from(`${process.env.OPENSEARCH_USERNAME}:${process.env.OPENSEARCH_PASSWORD}`).toString('base64')}`;
  }
  return checkHttp(base ? `${base}/_cluster/health` : null, headers);
}

export const live = asyncHandler(async (_req, res) => {
  return res.status(200).json({ success: true, data: { status: 'live' } });
});

export const ready = asyncHandler(async (_req, res) => {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkStorage(),
    checkSearch(),
  ]);
  const [database, storage, search] = checks.map(result => result.status === 'fulfilled' && result.value === true);
  // Optional module dependencies must not take unrelated API modules out of service.
  const isReady = database;
  return res.status(isReady ? 200 : 503).json({
    success: isReady,
    data: { status: isReady ? 'ready' : 'not_ready', ...(env.NODE_ENV === 'production' ? {} : { checks: { database: database ? 'up' : 'down', storage: storage ? 'up' : 'down', search: search ? 'up' : 'down' } }) },
  });
});
