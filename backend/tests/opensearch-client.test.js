import test from 'node:test';
import assert from 'node:assert/strict';

process.env.OPENSEARCH_URL = 'http://opensearch.test:9200';
process.env.REDIS_URL = '';

const client = await import('../src/services/search/opensearch.client.js');

function response(body = {}, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('document indexing sends bounded page chunks and removes stale chunks only after bulk success', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (options.method === 'HEAD') return new Response(null, { status: 200 });
    if (String(url).includes('/_bulk')) return response({ errors: false, items: [] });
    if (String(url).includes('/_delete_by_query')) return response({ deleted: 0 });
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    await client.indexDocument({ id: 'doc-1', title: 'راهنمای فنی', description: '', ownerId: 'u1', visibility: 'PUBLIC', accessJobRoles: [], mimeType: 'application/pdf', updatedAt: new Date(), createdAt: new Date(), language: 'fa' }, [
      { pageNumber: 1, text: 'افت ولتاژ '.repeat(600) },
      { pageNumber: 2, text: 'ترانسفورماتور '.repeat(500) },
    ]);
    const bulk = calls.find(call => call.url.includes('/_bulk'));
    const cleanup = calls.find(call => call.url.includes('/_delete_by_query'));
    assert.ok(bulk);
    assert.ok(cleanup);
    const lines = bulk.options.body.trim().split('\n').map(line => JSON.parse(line));
    const sourceLines = lines.filter((_, index) => index % 2 === 1);
    assert.ok(sourceLines.length >= 2);
    assert.ok(sourceLines.some(source => source.pageNumber === 1));
    assert.ok(sourceLines.some(source => source.pageNumber === 2));
    assert.ok(sourceLines.every(source => source.content.length <= 4000));
    const cleanupQuery = JSON.parse(cleanup.options.body);
    assert.ok(cleanupQuery.query.bool.must_not[0].ids.values.length >= sourceLines.length);
  } finally { globalThis.fetch = originalFetch; }
});

test('search deduplicates chunks per document, keeps the best source page and creates a raw-sort cursor', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  const hits = [
    { _id: 'doc-1:2:0', _score: 9, _source: { documentId: 'doc-1', pageNumber: 2, chunkIndex: 0 }, highlight: { content: ['<em>افت ولتاژ</em> در صفحه دوم'] }, sort: [9, '2026-11-15T10:00:00.000Z', 'doc-1', 2, 0] },
    { _id: 'doc-1:3:1', _score: 8, _source: { documentId: 'doc-1', pageNumber: 3, chunkIndex: 1 }, highlight: { content: ['ادامه سند'] }, sort: [8, '2026-11-15T10:00:00.000Z', 'doc-1', 3, 1] },
    { _id: 'doc-2:1:0', _score: 7, _source: { documentId: 'doc-2', pageNumber: 1, chunkIndex: 0 }, highlight: { content: ['نتیجه دوم'] }, sort: [7, '2026-11-15T09:00:00.000Z', 'doc-2', 1, 0] },
  ];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (options.method === 'HEAD') return new Response(null, { status: 200 });
    if (String(url).includes('/_search')) return response({ hits: { hits } });
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    const result = await client.searchIndexedDocuments({ query: 'افت ولتاژ', limit: 1, user: { id: 'u1', role: 'USER', jobRole: 'NETWORK_TECHNICIAN' } });
    assert.equal(result.hits.length, 1);
    assert.equal(result.hits[0]._source.documentId, 'doc-1');
    assert.equal(result.hits[0]._source.pageNumber, 2);
    assert.deepEqual(result.nextCursor, hits[1].sort);
    const requestBody = JSON.parse(calls.find(call => call.url.includes('/_search')).options.body);
    const accessFilter = requestBody.query.bool.filter[0];
    assert.equal(accessFilter.bool.minimum_should_match, 1);
    assert.ok(JSON.stringify(accessFilter).includes('NETWORK_TECHNICIAN'));
  } finally { globalThis.fetch = originalFetch; }
});

test('failed bulk indexing does not run stale-chunk cleanup', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/_bulk')) return response({ errors: true, items: [{ index: { error: { reason: 'mapping error' } } }] });
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    await assert.rejects(client.indexDocument({ id: 'doc-failed', title: 'سند', ownerId: 'u1', visibility: 'PUBLIC', accessJobRoles: [], mimeType: 'application/pdf', updatedAt: new Date(), createdAt: new Date(), language: 'fa' }, [{ pageNumber: 1, text: 'متن فنی معتبر' }]), /mapping error/);
    assert.equal(calls.some(call => call.url.includes('/_delete_by_query')), false);
  } finally { globalThis.fetch = originalFetch; }
});
