import { AppError } from '../utils/response.util.js';
import { verifyAccessToken } from '../utils/jwt.util.js';

export function authenticate(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const payload = verifyAccessToken(token);
  req.user = { id: payload.sub, role: payload.role };
  next();
}