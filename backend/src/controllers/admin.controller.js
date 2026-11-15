import asyncHandler from '../utils/asyncHandler.util.js';
import { ok, created } from '../utils/response.util.js';
import * as adminService from '../services/admin.service.js';

export const getStats = asyncHandler(async (req, res) => {
  return ok(res, await adminService.getStats());
});

export const getRevenueSeries = asyncHandler(async (req, res) => {
  return ok(res, await adminService.getRevenueSeries(req.query));
});

export const listUsers = asyncHandler(async (req, res) => {
  const result = await adminService.listUsers(req.query);
  return ok(res, result.items, undefined, result.meta);
});

export const getUserDetail = asyncHandler(async (req, res) => {
  return ok(res, await adminService.getUserDetail(req.params.id));
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await adminService.updateUser({
    id: req.params.id,
    actor: req.user,
    body: req.body,
    req,
  });

  return ok(res, { user });
});

export const listPayments = asyncHandler(async (req, res) => {
  const result = await adminService.listPayments(req.query);
  return ok(res, result.items, undefined, result.meta);
});

export const getPaymentDetail = asyncHandler(async (req, res) => {
  return ok(res, await adminService.getPaymentDetail(req.params.id));
});

export const listAuditLogs = asyncHandler(async (req, res) => {
  const result = await adminService.listAuditLogs(req.query);
  return ok(res, result.items, undefined, result.meta);
});

export const listAllPlans = asyncHandler(async (req, res) => {
  return ok(res, await adminService.listAllPlans());
});

export const createPlan = asyncHandler(async (req, res) => {
  const plan = await adminService.createPlan({
    body: req.body,
    actor: req.user,
    req,
  });

  return created(res, { plan });
});

export const updatePlan = asyncHandler(async (req, res) => {
  const plan = await adminService.updatePlan({
    id: req.params.id,
    body: req.body,
    actor: req.user,
    req,
  });

  return ok(res, { plan });
});

export const deletePlan = asyncHandler(async (req, res) => {
  await adminService.deletePlan({
    id: req.params.id,
    actor: req.user,
    req,
  });

  return ok(res, null);
});