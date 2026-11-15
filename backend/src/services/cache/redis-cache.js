import { createClient } from 'redis';

let clientPromise = null;
let disabledUntil = 0;

async function getClient() {
  const url = process.env.REDIS_URL;
  if (!url || Date.now() < disabledUntil) return null;
  if (!clientPromise) {
    const client = createClient({ url, socket: { connectTimeout: 1200, reconnectStrategy: retries => retries > 1 ? false : 100 } });
    client.on('error', error => process.stderr.write(`[redis-cache] ${error?.message || error}\n`));
    clientPromise = client.connect().then(() => client).catch(error => {
      process.stderr.write(`[redis-cache] connection unavailable: ${error?.message || error}\n`);
      clientPromise = null;
      disabledUntil = Date.now() + 5000;
      return null;
    });
  }
  return clientPromise;
}

export async function getCachedJson(key) {
  const client = await getClient();
  if (!client) return null;
  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    disabledUntil = Date.now() + 5000;
    process.stderr.write(`[redis-cache] read failed: ${error?.message || error}\n`);
    return null;
  }
}

export async function setCachedJson(key, value, ttlSeconds = 30) {
  const client = await getClient();
  if (!client) return false;
  try {
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    return true;
  } catch (error) {
    disabledUntil = Date.now() + 5000;
    process.stderr.write(`[redis-cache] write failed: ${error?.message || error}\n`);
    return false;
  }
}

export async function closeRedisCache() {
  if (!clientPromise) return;
  const client = await clientPromise;
  clientPromise = null;
  disabledUntil = 0;
  if (client?.isOpen) await client.quit().catch(() => {});
}

export async function deleteCachedJson(key) {
  const client = await getClient();
  if (!client) return false;
  try { await client.del(key); return true; }
  catch (error) { disabledUntil = Date.now() + 5000; process.stderr.write(`[redis-cache] delete failed: ${error?.message || error}\n`); return false; }
}

export async function incrementRateLimitCounter(key, windowMs) {
  const client = await getClient();
  if (!client) return null;
  try {
    const result = await client.eval(
      "local hits = redis.call('INCR', KEYS[1]); if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); end; local ttl = redis.call('PTTL', KEYS[1]); if ttl < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); ttl = tonumber(ARGV[1]); end; return {hits, ttl};",
      { keys: [key], arguments: [String(windowMs)] },
    );
    if (!Array.isArray(result) || result.length < 2) return null;
    const ttl = Number(result[1]);
    return { totalHits: Number(result[0]), resetTime: new Date(Date.now() + Math.max(0, ttl)) };
  } catch (error) {
    disabledUntil = Date.now() + 5000;
    process.stderr.write(`[redis-cache] rate limit increment failed: ${error?.message || error}\n`);
    return null;
  }
}

export async function decrementRateLimitCounter(key) {
  const client = await getClient();
  if (!client) return false;
  try {
    await client.eval(
      "local hits = redis.call('DECR', KEYS[1]); if hits <= 0 then redis.call('DEL', KEYS[1]); end; return hits;",
      { keys: [key], arguments: [] },
    );
    return true;
  } catch (error) {
    disabledUntil = Date.now() + 5000;
    process.stderr.write(`[redis-cache] rate limit decrement failed: ${error?.message || error}\n`);
    return false;
  }
}

export async function resetRateLimitCounter(key) {
  const client = await getClient();
  if (!client) return false;
  try { await client.del(key); return true; }
  catch (error) {
    disabledUntil = Date.now() + 5000;
    process.stderr.write(`[redis-cache] rate limit reset failed: ${error?.message || error}\n`);
    return false;
  }
}
