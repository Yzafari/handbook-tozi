import { AppError } from '../utils/response.util.js';
import { ZodError } from 'zod';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import jwt from 'jsonwebtoken';

export function notFoundHandler(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', 'Resource not found'));
}

function sendError(res, req, status, code, message, details) {
  const error = { code, message };
  if (details !== undefined) error.details = details;
  if (req.requestId) error.requestId = req.requestId;
  return res.status(status).json({
    success: false,
    // Top-level aliases remain during the web-client migration.
    code,
    message,
    ...(details !== undefined ? { meta: details } : {}),
    error,
  });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    if (!res.destroyed) res.destroy(err);
    return;
  }

  if (err instanceof AppError) {
    return sendError(res, req, err.status, err.code, err.message, err.details);
  }

  if (err instanceof ZodError) {
    return sendError(res, req, 400, 'VALIDATION_ERROR', 'Validation error', err.issues);
  }

  if (err?.type === 'entity.too.large') return sendError(res, req, 413, 'PAYLOAD_TOO_LARGE', 'Request payload is too large');
  if (err?.type === 'entity.parse.failed') return sendError(res, req, 400, 'INVALID_JSON', 'Request body contains invalid JSON');
  if (err?.code === 'LIMIT_FILE_SIZE') return sendError(res, req, 413, 'FILE_TOO_LARGE', 'Uploaded file exceeds the allowed size');

  if (err instanceof PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return sendError(res, req, 409, 'CONFLICT', 'Duplicate entry');
    if (err.code === 'P2025') return sendError(res, req, 404, 'NOT_FOUND', 'Record not found');
  }

  if (err instanceof jwt.TokenExpiredError) return sendError(res, req, 401, 'TOKEN_EXPIRED', 'Token expired');
  if (err instanceof jwt.JsonWebTokenError) return sendError(res, req, 401, 'UNAUTHORIZED', 'Invalid token');

  // Do not expose stack traces, SQL, request bodies or provider credentials.
  console.error('Unhandled request error:', { requestId: req.requestId, message: err?.message });
  return sendError(res, req, 500, 'INTERNAL_ERROR', 'Internal server error');
}
