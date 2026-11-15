/**
 * Shared Redis counters with a bounded-by-window in-process fallback.
 * The fallback keeps the API available when Redis is down; when Redis is
 * healthy all API replicas share the same counters.
 */
export class HybridRateLimitStore {
  constructor(namespace, shared = {}) {
    this.prefix = `handbook:ratelimit:${namespace}:`;
    this.shared = shared;
    this.local = new Map();
    this.windowMs = 60_000;
    this.localKeys = false;
    this.cleanupTimer = null;
  }

  init(options) {
    this.windowMs = Number(options.windowMs) || this.windowMs;
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = setInterval(() => this.cleanupExpired(), Math.max(1000, Math.min(this.windowMs, 60_000)));
    this.cleanupTimer.unref?.();
  }

  cleanupExpired(now = Date.now()) {
    for (const [localKey, entry] of this.local) {
      if (entry.resetTime.getTime() <= now) this.local.delete(localKey);
    }
  }

  async increment(key) {
    const redisKey = `${this.prefix}${key}`;
    if (this.shared.increment) {
      const result = await this.shared.increment(redisKey, this.windowMs).catch(() => null);
      if (result) return result;
    }
    const now = Date.now();
    let entry = this.local.get(key);
    if (!entry || entry.resetTime.getTime() <= now) {
      entry = { totalHits: 0, resetTime: new Date(now + this.windowMs) };
    }
    entry.totalHits += 1;
    this.local.set(key, entry);
    return { totalHits: entry.totalHits, resetTime: entry.resetTime };
  }

  async decrement(key) {
    const redisKey = `${this.prefix}${key}`;
    if (this.shared.decrement && await this.shared.decrement(redisKey)) return;
    const entry = this.local.get(key);
    if (!entry) return;
    entry.totalHits -= 1;
    if (entry.totalHits <= 0) this.local.delete(key);
  }

  async resetKey(key) {
    const redisKey = `${this.prefix}${key}`;
    this.local.delete(key);
    await this.shared.reset?.(redisKey);
  }

  async shutdown() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = null;
    this.local.clear();
  }
}
