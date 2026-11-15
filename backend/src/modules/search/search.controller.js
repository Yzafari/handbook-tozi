import asyncHandler from '../../utils/asyncHandler.util.js';
import { ok } from '../../utils/response.util.js';
import { searchDocuments } from './search.service.js';

export const search = asyncHandler(async (req, res) => {
  const result = await searchDocuments({ q: req.query.q, cursor: req.query.cursor, limit: Number(req.query.limit || 20), user: req.user, type: req.query.type, language: req.query.language, from: req.query.from, to: req.query.to });
  return ok(res, result.items, undefined, { nextCursor: result.nextCursor, hasMore: result.hasMore });
});
