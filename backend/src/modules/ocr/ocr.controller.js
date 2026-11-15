import { promises as fs } from 'node:fs';
import asyncHandler from '../../utils/asyncHandler.util.js';
import { ok, created } from '../../utils/response.util.js';
import * as service from './ocr.service.js';

export const create = asyncHandler(async (req, res) => {
  try {
    const job = await service.createOcrJob(req.file, req.user);
    return created(res, job, 'درخواست تشخیص متن ثبت شد');
  } finally {
    if (req.file?.path) await fs.rm(req.file.path, { force: true }).catch(() => {});
  }
});
export const get = asyncHandler(async (req, res) => ok(res, await service.getOcrJob(req.params.id, req.user.id)));
export const cancel = asyncHandler(async (req, res) => ok(res, await service.deleteOcrJob(req.params.id, req.user.id)));
export const retry = asyncHandler(async (req, res) => ok(res, await service.retryOcrJob(req.params.id, req.user.id), 'درخواست OCR دوباره در صف قرار گرفت'));
