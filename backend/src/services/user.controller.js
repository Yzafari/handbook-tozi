import * as userService from '../services/user.service.js';
import { ok } from '../utils/response.util.js';
import asyncHandler from '../utils/asyncHandler.util.js';

export const getMe = asyncHandler(async (req, res) => {
  const user = await userService.getMe(req.user.id);
  return ok(res, { user });
});

export const updateMe = asyncHandler(async (req, res) => {
  const user = await userService.updateMe(req.user.id, req.body);
  return ok(res, { user }, 'اطلاعات پروفایل با موفقیت به‌روزرسانی شد');
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  const result = await userService.saveAvatar(req.user.id, req.file);
  return ok(res, result, 'عکس پروفایل با موفقیت تغییر کرد');
});

export const getDashboard = asyncHandler(async (req, res) => {
  const dashboardData = await userService.getDashboard(req.user.id);
  return ok(res, dashboardData);
});

export const getPayments = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const result = await userService.listPayments(req.user.id, page, limit);
  return ok(res, result.data, null, result.meta);
});

export const getNotifications = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const result = await userService.listNotifications(req.user.id, page, limit);
  return ok(res, result.data, null, result.meta);
});

export const readNotification = asyncHandler(async (req, res) => {
  const notification = await userService.markNotificationRead(req.user.id, req.params.id);
  return ok(res, { notification }, 'اعلان خوانده شد');
});