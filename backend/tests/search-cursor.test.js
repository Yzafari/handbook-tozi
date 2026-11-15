import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeCursor } from '../src/modules/search/search-cursor.js';

const cursor = value => Buffer.from(JSON.stringify(value)).toString('base64url');

test('search cursor accepts valid OpenSearch sort tuples', () => {
  assert.deepEqual(decodeCursor(cursor([1.25, '2026-11-15T10:00:00.000Z', 'doc-1', 2, 0])), [1.25, '2026-11-15T10:00:00.000Z', 'doc-1', 2, 0]);
  assert.deepEqual(decodeCursor(cursor([1.25, 1794736800000, 'doc-1', 2, 1])), [1.25, 1794736800000, 'doc-1', 2, 1]);
});

test('search cursor rejects malformed or oversized sort tuples', () => {
  for (const value of [[], [1, 'not-a-date', 'doc', 1, 0], ['score', '2026-11-15', 'doc', 1, 0], [1, '2026-11-15', 'x'.repeat(129), 1, 0], [1, '2026-11-15', 'doc', 'one', 0]]) {
    assert.throws(() => decodeCursor(cursor(value)), /نشانگر صفحه‌بندی/);
  }
});
