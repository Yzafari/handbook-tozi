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

 export const leaveConversation = asyncHandler(async (req, res) => {
  const result = await service.leaveProjectConversation({
    projectId: req.params.id,
    userId: req.user.id,
  });

  return ok(
    res,
    result,
    'با موفقیت از گفت‌وگوی پروژه خارج شدید. عضویت و دسترسی‌های شما در خود پروژه همچنان برقرار است.'
  );
});
  
export const addMember = asyncHandler(async (req, res) => {
  const member = await service.addProjectMember({
    projectId: req.params.id,
    userId: req.body.userId,
    email: req.body.email,
    roleKey: req.body.roleKey,
    actor: {
      userId: req.user.id,
      roleKey: req.projectAccess.roleKey,
      permissions: req.projectAccess.permissions,
    },
  });

  return created(
    res,
    member,
    'همکار با موفقیت به پروژه اضافه شد و عضویت او فعال است'
  );
});

export const listMembers = asyncHandler(async (req, res) => {
  const members = await service.listProjectMembers({
    projectId: req.params.id,
  });

  return ok(
    res,
    members,
    'فهرست اعضای فعال پروژه با موفقیت دریافت شد'
  );
});

  return ok(res, project);
});
