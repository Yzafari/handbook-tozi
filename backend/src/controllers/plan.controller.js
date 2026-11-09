import asyncHandler from '../utils/asyncHandler.util.js';
import { ok } from '../utils/response.util.js';
import * as planService from '../services/plan.service.js';

export const listPlans = asyncHandler(async (req, res) => {
  const plans = await planService.listActivePlans();
  return ok(res, plans);
});
