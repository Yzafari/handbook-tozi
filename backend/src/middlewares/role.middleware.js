import { AppError } from '../utils/response.util.js';

export function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return next(new AppError(401, 'UNAUTHORIZED', 'No user or role found'));
    }

    if (roles.includes(String(req.user.role).toUpperCase())) {
      next();
    } else {
      next(new AppError(403, 'FORBIDDEN', 'Access denied'));
    }
  };
}
