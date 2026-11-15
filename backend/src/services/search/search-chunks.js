import { normalizeSearchText } from './search-normalization.js';

export function chunkPages(pages, { chunkSize = 4000, overlap = 300, maxChunks = 2000 } = {}) {
  if (!Array.isArray(pages)) throw new TypeError('pages must be an array');
  if (!Number.isInteger(chunkSize) || chunkSize < 100 || !Number.isInteger(overlap) || overlap < 0 || overlap >= chunkSize) throw new TypeError('Invalid chunk sizing');
  const chunks = [];
  let globalIndex = 0;
  for (const page of pages) {
    const text = normalizeSearchText(page?.text || '');
    if (!text) continue;
    let offset = 0;
    while (offset < text.length && chunks.length < maxChunks) {
      const end = Math.min(text.length, offset + chunkSize);
      const content = text.slice(offset, end);
      if (content.trim()) chunks.push({ pageNumber: Number.isInteger(page.pageNumber) && page.pageNumber > 0 ? page.pageNumber : null, chunkIndex: globalIndex++, content });
      if (end >= text.length) break;
      offset = Math.max(offset + 1, end - overlap);
    }
    if (chunks.length >= maxChunks) break;
  }
  return chunks;
}
