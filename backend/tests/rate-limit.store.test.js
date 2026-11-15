import test from 'node:test';
import assert from 'node:assert/strict';
import { HybridRateLimitStore } from '../src/middlewares/rate-limit.store.js';

test('rate limit store uses a shared counter when Redis is available', async () => {
  const calls = [];
  const store = new HybridRateLimitStore('test', {
    increment: async (key, windowMs) => { calls.push([key, windowMs]); return { totalHits: 4, resetTime: new Date(Date.now() + windowMs) }; },
  });
  store.init({ windowMs: 30_000 });
  const result = await store.increment('client-a');
  assert.equal(result.totalHits, 4);
  assert.equal(calls[0][0], 'handbook:ratelimit:test:client-a');
  assert.equal(calls[0][1], 30_000);
});

test('rate limit store falls back locally and expires its counter window', async () => {
  const store = new HybridRateLimitStore('test', { increment: async () => null });
  store.init({ windowMs: 10 });
  assert.equal((await store.increment('client-a')).totalHits, 1);
  assert.equal((await store.increment('client-a')).totalHits, 2);
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal((await store.increment('client-a')).totalHits, 1);
  await store.resetKey('client-a');
  assert.equal((await store.increment('client-a')).totalHits, 1);
});
