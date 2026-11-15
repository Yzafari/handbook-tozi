import { createHash } from 'node:crypto';
import { AppError } from '../../utils/response.util.js';
import { buildSearchAccessFilter } from './search-access.js';
import { chunkPages } from './search-chunks.js';
import { normalizeSearchText } from './search-normalization.js';

const INDEX = process.env.OPENSEARCH_DOCUMENT_INDEX || 'handbook-documents-v1';
const endpoint = () => (process.env.OPENSEARCH_URL || 'http://127.0.0.1:9200').replace(/\/$/, '');
let indexReadyPromise = null;

async function getCachedSearchResult(key) {
  try { const cache = await import('../cache/redis-cache.js'); return await cache.getCachedJson(key); }
  catch { return null; }
}

async function cacheSearchResult(key, value, ttlSeconds) {
  try { const cache = await import('../cache/redis-cache.js'); return await cache.setCachedJson(key, value, ttlSeconds); }
  catch { return false; }
}

function headers() {
  const result = { 'content-type': 'application/json' };
  const username = process.env.OPENSEARCH_USERNAME;
  const password = process.env.OPENSEARCH_PASSWORD;
  if (username && password) result.authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  return result;
}

async function request(path, options = {}) {
  if (!endpoint()) throw new AppError(503, 'SEARCH_UNAVAILABLE', 'موتور جستجو تنظیم نشده است');
  const { timeoutMs = Number(process.env.OPENSEARCH_TIMEOUT_MS) || 4_000, ...fetchOptions } = options;
  let response;
  try {
    response = await fetch(`${endpoint()}${path}`, {
      ...fetchOptions,
      headers: { ...headers(), ...(options.headers || {}) },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new AppError(503, 'SEARCH_UNAVAILABLE', 'ارتباط با موتور جستجو برقرار نشد');
  }
  if (!response.ok && response.status !== 404) {
    const body = await response.text().catch(() => '');
    throw new AppError(503, 'SEARCH_ENGINE_ERROR', `موتور جستجو پاسخ معتبر نداد (${response.status})`);
  }
  return response;
}

export async function ensureDocumentIndex() {
  if (indexReadyPromise) return indexReadyPromise;
  indexReadyPromise = (async () => {
  const exists = await request(`/${INDEX}`, { method: 'HEAD' });
  if (exists.status !== 404) return;
  const mapping = {
    settings: {
      analysis: {
        char_filter: {
          fa_normalize: { type: 'mapping', mappings: ['ي => ی', 'ك => ک', 'ۀ => ه', 'ة => ه', '‌ =>  '] },
        },
        analyzer: {
          fa_text: { type: 'custom', char_filter: ['fa_normalize'], tokenizer: 'standard', filter: ['lowercase'] },
        },
      },
    },
    mappings: {
      properties: {
        title: { type: 'text', analyzer: 'fa_text', fields: { keyword: { type: 'keyword', ignore_above: 256 } } },
        description: { type: 'text', analyzer: 'fa_text' },
        content: { type: 'text', analyzer: 'fa_text' },
        documentId: { type: 'keyword' },
        ownerId: { type: 'keyword' },
        visibility: { type: 'keyword' },
        accessJobRoles: { type: 'keyword' },
        mimeType: { type: 'keyword' },
        updatedAt: { type: 'date' },
        createdAt: { type: 'date' },
        language: { type: 'keyword' },
        pageNumber: { type: 'integer' },
        chunkIndex: { type: 'integer' },
      },
    },
  };
  const created = await request(`/${INDEX}`, { method: 'PUT', body: JSON.stringify(mapping) });
  if (!created.ok) {
    const check = await request(`/${INDEX}`, { method: 'HEAD' });
    if (check.status === 404) throw new AppError(503, 'SEARCH_INDEX_CREATE_FAILED', 'ساخت ایندکس اسناد ناموفق بود');
  }
  })().catch(error => { indexReadyPromise = null; throw error; });
  return indexReadyPromise;
}

export async function indexDocument(document, pages) {
  await ensureDocumentIndex();
  const pageList = Array.isArray(pages) ? pages : [{ pageNumber: null, text: String(pages || '') }];
  const chunks = chunkPages(pageList);
  if (!chunks.length) throw new AppError(422, 'EMPTY_DOCUMENT_TEXT', 'متن قابل ایندکس در سند وجود ندارد');
  const lines = [];
  for (const chunk of chunks) {
    const pageKey = chunk.pageNumber ?? 0;
    lines.push(JSON.stringify({ index: { _index: INDEX, _id: `${document.id}:${pageKey}:${chunk.chunkIndex}` } }));
    lines.push(JSON.stringify({
      title: normalizeSearchText(document.title),
      description: normalizeSearchText(document.description || ''),
      content: chunk.content,
      documentId: document.id,
      ownerId: document.ownerId,
      visibility: document.visibility,
      accessJobRoles: document.accessJobRoles || [],
      mimeType: document.mimeType,
      updatedAt: document.updatedAt,
      createdAt: document.createdAt,
      language: document.language,
      pageNumber: chunk.pageNumber,
      chunkIndex: chunk.chunkIndex,
    }));
  }
  const response = await request('/_bulk?refresh=wait_for', {
    method: 'POST',
    headers: { 'content-type': 'application/x-ndjson' },
    timeoutMs: Number(process.env.OPENSEARCH_INDEX_TIMEOUT_MS) || 120_000,
    body: `${lines.join('\n')}\n`,
  });
  const result = await response.json();
  if (!response.ok || result.errors) {
    const firstError = result.items?.find(item => item.index?.error)?.index?.error?.reason;
    throw new AppError(503, 'SEARCH_INDEX_FAILED', firstError || 'ثبت قطعات سند در ایندکس ناموفق بود');
  }
  const currentIds = chunks.map(chunk => `${document.id}:${chunk.pageNumber ?? 0}:${chunk.chunkIndex}`);
  await request(`/${INDEX}/_delete_by_query?conflicts=proceed&refresh=true`, {
    method: 'POST', timeoutMs: 30_000,
    body: JSON.stringify({ query: { bool: { filter: [{ term: { documentId: document.id } }], must_not: [{ ids: { values: currentIds } }] } } }),
  });
}

export async function removeIndexedDocument(id) {
  await ensureDocumentIndex();
  const response = await request(`/${INDEX}/_delete_by_query?conflicts=proceed&refresh=true`, {
    method: 'POST', timeoutMs: 30_000, body: JSON.stringify({ query: { term: { documentId: id } } }),
  });
  if (!response.ok) throw new AppError(503, 'SEARCH_DELETE_FAILED', 'حذف سند از ایندکس ناموفق بود');
}

export async function searchIndexedDocuments({ query, cursor, limit = 20, filters = {}, user = null }) {
  await ensureDocumentIndex();
  const cacheDigest = createHash('sha256').update(JSON.stringify({ query, cursor: cursor ?? null, limit, filters, access: user ? { id: user.id, role: user.role, jobRole: user.jobRole } : 'guest' })).digest('hex');
  const cacheKey = `handbook:search:v1:${cacheDigest}`;
  const cached = await getCachedSearchResult(cacheKey);
  if (cached) return cached;
  const accessFilter = buildSearchAccessFilter(user);
  const body = {
    size: Math.min(100, Math.max(20, limit * 2)),
    _source: ['documentId', 'pageNumber', 'chunkIndex'],
    track_total_hits: false,
    query: {
      bool: {
        should: [
          { match_phrase: { title: { query, boost: 6 } } },
          { match_phrase: { content: { query, boost: 2.5 } } },
          { match: { title: { query, boost: 3, fuzziness: 'AUTO' } } },
          { match: { description: { query, boost: 1.5 } } },
          { match: { content: { query, boost: 1 } } },
        ],
        minimum_should_match: 1,
        filter: [
          ...accessFilter,
          ...(filters.mimeTypes?.length ? [{ terms: { mimeType: filters.mimeTypes } }] : []),
          ...(filters.language ? [{ term: { language: filters.language } }] : []),
          ...(filters.from || filters.to ? [{ range: { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } }] : []),
        ],
      },
    },
    highlight: { fields: { title: {}, content: { fragment_size: 180, number_of_fragments: 2 } } },
    sort: [
      { _score: 'desc' }, { updatedAt: 'desc' }, { documentId: 'asc' },
      { pageNumber: { order: 'asc', missing: 0 } }, { chunkIndex: 'asc' },
    ],
  };
  const unique = [];
  const seen = new Set();
  let after = cursor;
  let nextCursor = null;
  let exhausted = false;
  let reachedBatchLimit = false;
  for (let batch = 0; batch < 3 && unique.length <= limit; batch += 1) {
    if (after) body.search_after = after;
    else delete body.search_after;
    const response = await request(`/${INDEX}/_search`, { method: 'POST', body: JSON.stringify(body) });
    const data = await response.json();
    const hits = data.hits?.hits || [];
    if (!hits.length) { exhausted = true; break; }
    let previousSort = after;
    for (const hit of hits) {
      const documentId = hit._source?.documentId;
      if (documentId && !seen.has(documentId)) {
        if (unique.length === limit) { nextCursor = previousSort; break; }
        seen.add(documentId);
        unique.push(hit);
      }
      previousSort = hit.sort;
      after = hit.sort;
    }
    if (nextCursor) break;
    if (hits.length < body.size) { exhausted = true; break; }
    if (batch === 2) reachedBatchLimit = true;
  }
  if (!nextCursor && !exhausted && reachedBatchLimit && after) nextCursor = after;
  const result = { hits: unique.slice(0, limit), nextCursor };
  await cacheSearchResult(cacheKey, result, 30);
  return result;
}
