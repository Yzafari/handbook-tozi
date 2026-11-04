import { AppError } from '../utils/response.util';
import { ZodError } from 'zod';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import jwt from 'jsonwebtoken';

export function notFoundHandler(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', 'Resource not found'));
}

export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, message: err.message, meta: err.meta });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({ success: false, message: 'Validation error', meta: err.issues });
  }

  if (err instanceof PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Duplicate entry' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
  }

  if (err instanceof jwt.TokenExpiredError) {
    return res.status(401).json({ success: false, message: 'Token expired' });
  }

  if (err instanceof jwt.JsonWebTokenError) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }

  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
}
