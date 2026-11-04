import { AppError } from '../utils/response.util';

export function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return next(new AppError(401, 'UNAUTHORIZED', 'No user or role found'));
    }

    if (roles.includes(req.user.role)) {
      next();
    } else {
      next(new AppError(403, 'FORBIDDEN', 'Access denied'));
    }
  };
}
