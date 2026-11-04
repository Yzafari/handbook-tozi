import jwt from 'jsonwebtoken';
import { AppError } from '../utils/response.util';
import { verifyAccessToken } from '../utils/jwt.util';

export function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next(new AppError(401, 'UNAUTHORIZED', 'No token provided'));
  }

  try {
    const decoded = verifyAccessToken(token);
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (error) {
    next(new AppError(401, 'UNAUTHORIZED', 'Invalid token'));
  }
}
