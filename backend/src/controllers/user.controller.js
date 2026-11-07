import asyncHandler from '../utils/asyncHandler.util.js';
import { ok } from '../utils/response.util.js';
import * as userService from '../services/user.service.js';

function parsePagination(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  return { page, limit };
}

export const getMe = asyncHandler(async (req, res) => {
  const user = await userService.getMe(req.user.id);
  return ok(res, user);
});

export const updateMe = asyncHandler(async (req, res) => {
  const user = await userService.updateMe(req.user.id, req.body);
  return ok(res, user, 'پروفایل با موفقیت به‌روزرسانی شد');
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  const result = await userService.saveAvatar(req.user.id, req.file);
  return ok(res, result, 'آواتار با موفقیت به‌روزرسانی شد');
});

export const getDashboard = asyncHandler(async (req, res) => {
  const dashboard = await userService.getDashboard(req.user.id);
  return ok(res, dashboard);
});

export const getPayments = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const { data, meta } = await userService.listPayments(req.user.id, page, limit);
  return ok(res, data, undefined, meta);
});

export const getNotifications = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const { data, meta } = await userService.listNotifications(req.user.id, page, limit);
  return ok(res, data, undefined, meta);
});

export const readNotification = asyncHandler(async (req, res) => {
  const notificationId = req.params.id || req.params.notificationId;
  const notification = await userService.markNotificationRead(req.user.id, notificationId);
  return ok(res, notification, 'اعلان خوانده شد');
});
