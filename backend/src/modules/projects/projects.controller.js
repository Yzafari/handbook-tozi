import asyncHandler from '../../utils/asyncHandler.util.js';
import { ok, created } from '../../utils/response.util.js';
import * as service from './projects.service.js';

export const create = asyncHandler(async (req, res) => {
  const project = await service.createProject({
    data: req.body,
    userId: req.user.id,
  });

  return created(
    res,
    project,
    'پروژه با موفقیت ایجاد شد'
  );
});

export const list = asyncHandler(async (req, res) => {
  const result = await service.listProjects({
    userId: req.user.id,
    cursor: req.query.cursor,
    limit: Number(req.query.limit || 20),
  });

  return ok(
    res,
    result.items,
    undefined,
    {
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    }
  );
});

export const detail = asyncHandler(async (req, res) => {
  const project = await service.getProjectDetail({
    projectId: req.params.id,
    userId: req.user.id,
  });

  return ok(res, project);
});
