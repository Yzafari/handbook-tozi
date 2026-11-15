import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkPages } from '../src/services/search/search-chunks.js';
import { normalizeSearchText } from '../src/services/search/search-normalization.js';

test('search normalization unifies Persian/Arabic letters, diacritics, half-spaces and digits', () => {
  assert.equal(normalizeSearchText('ي ك ۱۲۳ ﻫ'), 'ی ک 123 ه');
  assert.equal(normalizeSearchText('می‌باشد'), 'می باشد');
});

test('PDF pages are chunked with bounded overlap and original page numbers', () => {
  const text = 'الف'.repeat(2800);
  const chunks = chunkPages([{ pageNumber: 2, text }]);
  assert.equal(chunks.length, 3);
  assert.ok(chunks.every(chunk => chunk.content.length <= 4000 && chunk.pageNumber === 2));
  assert.equal(chunks[0].content.slice(-300), chunks[1].content.slice(0, 300));
  assert.equal(chunks[0].chunkIndex, 0);
  assert.equal(chunks[2].chunkIndex, 2);
});

test('empty pages are skipped and chunk count is capped', () => {
  assert.deepEqual(chunkPages([{ pageNumber: 1, text: '   ' }]), []);
  const chunks = chunkPages([{ pageNumber: 1, text: 'x'.repeat(20000) }], { chunkSize: 1000, overlap: 100, maxChunks: 3 });
  assert.equal(chunks.length, 3);
});
