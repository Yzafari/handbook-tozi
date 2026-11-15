import { api } from '../network/api';
import { getDatabase } from '../database';
import { cacheDocument } from '../offline/repository';

export type SearchDocument = {
  id: string;
  title: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  description?: string | null;
  pageCount?: number | null;
  indexStatus: string;
  snippets?: string[];
  score?: number;
  pageNumber?: number | null;
  updatedAt?: string;
};

export type SearchPage = { items: SearchDocument[]; nextCursor: string | null; hasMore: boolean };
export type SearchFilters = { type?: 'pdf' | 'image' | 'text'; language?: 'fa' | 'en' | 'ku' };

function normalizeQuery(value: string): string {
  return value.normalize('NFKC').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/\u200c/g, ' ').replace(/\s+/g, ' ').trim();
}

function cacheKey(userId: string, query: string, cursor: string | null, filters: SearchFilters): string {
  return `${userId}::${normalizeQuery(query).toLowerCase()}::${cursor ?? 'first'}::${filters.type ?? 'all'}::${filters.language ?? 'all'}`;
}

export async function getCachedSearchPage(userId: string, query: string, cursor: string | null = null, filters: SearchFilters = {}): Promise<{ page: SearchPage; stale: boolean } | null> {
  const db = await getDatabase();
  const key = cacheKey(userId, query, cursor, filters);
  const row = await db.getFirstAsync<{ results_json: string; next_cursor: string | null; has_more: number; expires_at: string }>(
    'SELECT results_json,next_cursor,has_more,expires_at FROM search_cache WHERE cache_key=? AND owner_user_id=?', [key, userId]);
  if (!row) return null;
  try {
    return { page: { items: JSON.parse(row.results_json), nextCursor: row.next_cursor, hasMore: Boolean(row.has_more) }, stale: row.expires_at <= new Date().toISOString() };
  } catch {
    await db.runAsync('DELETE FROM search_cache WHERE cache_key=?', [key]);
    return null;
  }
}

export async function cacheSearchPage(userId: string, query: string, cursor: string | null, page: SearchPage, filters: SearchFilters = {}): Promise<void> {
  const db = await getDatabase();
  const now = new Date();
  await db.runAsync('DELETE FROM search_cache WHERE expires_at < ?', [now.toISOString()]);
  await db.runAsync(
    `INSERT INTO search_cache(cache_key,owner_user_id,results_json,next_cursor,has_more,cached_at,expires_at) VALUES(?,?,?,?,?,?,?)
     ON CONFLICT(cache_key) DO UPDATE SET owner_user_id=excluded.owner_user_id,results_json=excluded.results_json,next_cursor=excluded.next_cursor,
     has_more=excluded.has_more,cached_at=excluded.cached_at,expires_at=excluded.expires_at`,
    [cacheKey(userId, query, cursor, filters), userId, JSON.stringify(page.items), page.nextCursor, page.hasMore ? 1 : 0, now.toISOString(), new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()],
  );
  await db.runAsync(
    `DELETE FROM search_cache WHERE owner_user_id=? AND cache_key NOT IN
     (SELECT cache_key FROM search_cache WHERE owner_user_id=? ORDER BY cached_at DESC LIMIT 100)`,
    [userId, userId],
  );
}

export async function searchDocuments(userId: string, query: string, cursor: string | null = null, filters: SearchFilters = {}, signal?: AbortSignal): Promise<SearchPage> {
  const normalized = normalizeQuery(query);
  if (normalized.length < 2) return { items: [], nextCursor: null, hasMore: false };
  const response = await api.get('/search', { params: { q: normalized, cursor: cursor ?? undefined, limit: 20, ...filters }, signal });
  const page: SearchPage = {
    items: response.data?.data ?? [],
    nextCursor: response.data?.meta?.nextCursor ?? null,
    hasMore: Boolean(response.data?.meta?.hasMore),
  };
  await cacheSearchPage(userId, normalized, cursor, page, filters).catch(() => {});
  await Promise.all(page.items.map(item => cacheDocument({ userId, documentId: item.id, metadata: item, version: item.updatedAt }).catch(() => {})));
  return page;
}
