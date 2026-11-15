import asyncHandler from '../../utils/asyncHandler.util.js';
import { ok } from '../../utils/response.util.js';
import * as service from './sync.service.js';

export const push = asyncHandler(async (req, res) => ok(res, await service.pushOperations(req.user.id, req.body.operations), 'عملیات همگام‌سازی دریافت شد'));
export const pull = asyncHandler(async (req, res) => {
  const result = await service.pullChanges(req.user.id, req.query.cursor, Number(req.query.limit || 100));
  return ok(res, result.items, undefined, { nextCursor: result.nextCursor, hasMore: result.hasMore });
});
export const status = asyncHandler(async (req, res) => ok(res, await service.getSyncStatus(req.user.id)));

export const record = asyncHandler(async (req, res) => ok(res, await service.getSyncRecord(req.user.id, req.params.moduleName, req.params.entityType, req.params.entityId)));
