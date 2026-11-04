import { ZodError } from 'zod';
import { AppError } from '../utils/response.util.js';
import { env } from '../config/env.js';
import logger from '../utils/logger.util.js';

export function notFoundHandler(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl.split('?')[0]} not found`));
}

// Returns an AppError for known error types, or null for unknown ones.
function normalize(err) {
  if (err instanceof AppError) return err;

  if (err instanceof ZodError || err?.name === 'ZodError') {
    const issues = err.issues ?? err.errors ?? [];
    return new AppError(
      400,
      'VALIDATION_ERROR',
      'Validation failed',
      issues.map((i) => ({ path: (i.path || []).join('.'), message: i.message }))
    );
  }

  if (err?.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') {
      return new AppError(409, 'CONFLICT', 'Resource already exists', { fields: err.meta?.target });
    }
    if (err.code === 'P2025') {
      return new AppError(404, 'NOT_FOUND', 'Resource not found');
    }
    return null;
  }

  if (err?.name === 'TokenExpiredError') {
    return new AppError(401, 'TOKEN_EXPIRED', 'Token expired');
  }
  if (err?.name === 'JsonWebTokenError' || err?.name === 'NotBeforeError') {
    return new AppError(401, 'UNAUTHORIZED', 'Invalid token');
  }

  if (err?.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File too large' : err.message;
    return new AppError(400, 'VALIDATION_ERROR', message, { code: err.code, field: err.field });
  }

  if (err?.type === 'entity.parse.failed') {
    return new AppError(400, 'VALIDATION_ERROR', 'Malformed JSON body');
  }
  if (err?.type === 'entity.too.large') {
    return new AppError(413, 'VALIDATION_ERROR', 'Request body too large');
  }

  return null;
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const mapped = normalize(err);

  if (mapped) {
    if (mapped.status >= 500) {
      logger.error('Request failed', { code: mapped.code, path: req.originalUrl, message: mapped.message });
    } else {
      logger.debug('Request rejected', { code: mapped.code, path: req.originalUrl });
    }
    const error = { code: mapped.code, message: mapped.message };
    if (mapped.details !== undefined) error.details = mapped.details;
    return res.status(mapped.status).json({ success: false, error });
  }

  logger.error('Unhandled error', {
    method: req.method,
    path: req.originalUrl,
    message: err?.message,
    stack: err?.stack,
  });

  const isProd = env.NODE_ENV === 'production';
  const error = {
    code: 'INTERNAL_ERROR',
    message: isProd ? 'Internal server error' : err?.message || 'Internal server error',
  };
  if (!isProd) error.details = { stack: err?.stack };

  return res.status(500).json({ success: false, error });
}