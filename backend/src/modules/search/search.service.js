import { AppError } from '../../utils/response.util.js';
import { encodeCursor, decodeCursor } from './search-cursor.js';
import { getSearchDocumentsByIds } from '../documents/public-api.js';
import { normalizePersian } from '../../utils/persian-text.js';
import { searchIndexedDocuments } from './public-api.js';

export async function searchDocuments({ q, cursor, limit = 20, user, type, language, from, to }) {
  const query = normalizePersian(q);
  if (query.length < 2 || query.length > 200) throw new AppError(400, 'INVALID_SEARCH_QUERY', 'عبارت جستجو باید بین ۲ تا ۲۰۰ نویسه باشد');
  const mimeTypes = type === 'pdf' ? ['application/pdf'] : type === 'image' ? ['image/jpeg', 'image/png', 'image/webp'] : type === 'text' ? ['text/plain', 'text/markdown'] : undefined;
  const result = await searchIndexedDocuments({ query, cursor: decodeCursor(cursor), limit, filters: { mimeTypes, language, from, to }, user });
  const ids = result.hits.map(hit => hit._source?.documentId).filter(Boolean);
  const documents = await getSearchDocumentsByIds(ids, user);
  const documentById = new Map(documents.map(doc => [doc.id, doc]));
  const items = result.hits.flatMap(hit => {
    const document = documentById.get(hit._source?.documentId);
    if (!document) return [];
    const highlights = hit.highlight || {};
    const snippets = [...(highlights.title || []), ...(highlights.content || [])];
    return [{ ...document, score: hit._score, pageNumber: hit._source?.pageNumber ?? null, snippets: snippets.slice(0, 3).map(value => value.replace(/<em>/g, '').replace(/<\/em>/g, '')) }];
  });
  return { items, nextCursor: result.nextCursor ? encodeCursor(result.nextCursor) : null, hasMore: Boolean(result.nextCursor) };
}
