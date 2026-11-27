
import prisma from '../../config/database.js';
import { AppError } from '../../utils/response.util.js';

/**
 * Checks whether the authenticated user has a specific permission
 * inside the requested project.
 *
 * Global ADMIN and SUPER_ADMIN roles do not automatically bypass
 * project membership and project-level permissions.
 */
export function requireProjectPermission(permission) {
  if (typeof permission !== 'string' || !permission.trim()) {
    throw new TypeError('A valid project permission is required');
  }

  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const projectId = req.params?.id;

      if (!userId) {
        throw new AppError(
          401,
          'UNAUTHORIZED',
          'برای دسترسی به پروژه باید وارد حساب کاربری شوید'
        );
      }

      if (!projectId) {
        throw new AppError(
          400,
          'PROJECT_ID_REQUIRED',
          'شناسه پروژه ارسال نشده است'
        );
      }

      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          archivedAt: null,
          members: {
            some: {
              userId,
              status: 'ACTIVE',
            },
          },
        },
        select: {
          id: true,
          members: {
            where: {
              userId,
              status: 'ACTIVE',
            },
            take: 1,
            select: {
              id: true,
              roleId: true,
              projectRole: {
                select: {
                  id: true,
                  key: true,
                  permissions: {
                    select: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Do not disclose whether a project exists to non-members.
      if (!project || project.members.length === 0) {
        throw new AppError(
          404,
          'PROJECT_NOT_FOUND',
          'پروژه یافت نشد یا شما عضو فعال آن نیستید'
        );
      }

      const membership = project.members[0];

      const permissions = membership.projectRole.permissions.map(
        (item) => item.permission
      );

      if (!permissions.includes(permission)) {
        throw new AppError(
          403,
          'PROJECT_PERMISSION_DENIED',
          'شما مجوز انجام این عملیات در پروژه را ندارید'
        );
      }

      req.projectAccess = {
        projectId: project.id,
        membershipId: membership.id,
        roleId: membership.roleId,
        roleKey: membership.projectRole.key,
        permissions,
      };

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
