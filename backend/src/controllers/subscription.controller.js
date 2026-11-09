import asyncHandler from '../utils/asyncHandler.util.js';
import { ok } from '../utils/response.util.js';
import * as subscriptionService from '../services/subscription.service.js';

export const mySubscription = asyncHandler(async (req, res) => {
  const subscription = await subscriptionService.getActiveSubscription(req.user.id);
  return ok(res, { subscription });
});

export const cancel = asyncHandler(async (req, res) => {
  const subscription = await subscriptionService.cancelSubscription(req.user.id, req);
  return ok(res, { subscription });
});