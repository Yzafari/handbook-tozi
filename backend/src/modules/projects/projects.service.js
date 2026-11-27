import { randomUUID } from 'node:crypto';
import prisma from '../../config/database.js';
import { AppError } from '../../utils/response.util.js';

const PROJECT_SELECT = {
  id: true,
  code: true,
  name: true,
  description: true,
  type: true,
  status: true,
  startDate: true,
  expectedEndDate: true,
  organizationName: true,
  employerName: true,
  contractorName: true,
  createdById: true,
  projectManagerUserId: true,
  employerUserId: true,
  supervisorUserId: true,
  contractorUserId: true,
  technicalLeadUserId: true,
  province: true,
  county: true,
  address: true,
  latitude: true,
  longitude: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
};

const DEFAULT_PROJECT_ROLES = [
  {
    key: 'OWNER',
    name: 'مالک پروژه',
    permissions: [
      'project:read',
      'project:update',
      'project:archive',
      'project:manage_members',
      'project:manage_roles',
      'workspace:read',
      'conversation:read',
    ],
  },
  {
    key: 'MANAGER',
    name: 'مدیر پروژه',
    permissions: [
      'project:read',
      'project:update',
      'project:manage_members',
      'workspace:read',
      'conversation:read',
    ],
  },
  {
    key: 'MEMBER',
    name: 'عضو پروژه',
    permissions: [
      'project:read',
      'workspace:read',
      'conversation:read',
    ],
  },
  {
    key: 'VIEWER',
    name: 'مشاهده‌گر پروژه',
    permissions: [
      'project:read',
      'workspace:read',
      'conversation:read',
    ],
  },
];

function createProjectCode() {
  return `PRJ-${randomUUID().replaceAll('-', '').toUpperCase()}`;
}

function normalizeOptionalText(value) {
  if (value === undefined || value === null) return null;

  const normalized = String(value).trim();

  return normalized.length ? normalized : null;
}

export async function createProject({ data, userId }) {
  if (!userId) {
    throw new AppError(
      401,
      'UNAUTHORIZED',
      'برای ایجاد پروژه باید وارد حساب کاربری شوید'
    );
  }

  const creator = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isActive: true,
    },
  });

  if (!creator || creator.isActive === false) {
    throw new AppError(
      401,
      'INVALID_USER',
      'حساب کاربری معتبر نیست یا غیرفعال شده است'
    );
  }

  const projectCode = createProjectCode();

  return prisma.$transaction(async (tx) => {
      // Validate all optional project user assignments before creating records.
    const assignedUserIds = [
      data.projectManagerUserId,
      data.employerUserId,
      data.supervisorUserId,
      data.contractorUserId,
      data.technicalLeadUserId,
    ].filter(Boolean);

    const uniqueAssignedUserIds = [...new Set(assignedUserIds)];

    if (uniqueAssignedUserIds.length > 0) {
      const validUsers = await tx.user.findMany({
        where: {
          id: { in: uniqueAssignedUserIds },
          isActive: true,
        },
        select: {
          id: true,
        },
      });

      const validUserIds = new Set(validUsers.map((user) => user.id));

      const invalidUserIds = uniqueAssignedUserIds.filter(
        (id) => !validUserIds.has(id)
      );

      if (invalidUserIds.length > 0) {
        throw new AppError(
          400,
          'INVALID_PROJECT_USER',
          'یکی از کاربران انتخاب‌شده وجود ندارد یا حساب او غیرفعال است'
        );
      }
    }
    const project = await tx.project.create({
      data: {
        code: projectCode,
        name: data.name.trim(),
        description: normalizeOptionalText(data.description),
        type: data.type.trim(),

        startDate: data.startDate ?? null,
        expectedEndDate: data.expectedEndDate ?? null,

        organizationName: normalizeOptionalText(data.organizationName),
        employerName: normalizeOptionalText(data.employerName),
        contractorName: normalizeOptionalText(data.contractorName),

        createdById: userId,

        projectManagerUserId: data.projectManagerUserId ?? null,
        employerUserId: data.employerUserId ?? null,
        supervisorUserId: data.supervisorUserId ?? null,
        contractorUserId: data.contractorUserId ?? null,
        technicalLeadUserId: data.technicalLeadUserId ?? null,

        province: normalizeOptionalText(data.province),
        county: normalizeOptionalText(data.county),
        address: normalizeOptionalText(data.address),

        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      },
      select: {
        id: true,
        ...PROJECT_SELECT,
      },
    });

    const createdRoles = {};

    for (const roleDefinition of DEFAULT_PROJECT_ROLES) {
      const role = await tx.projectRole.create({
        data: {
          projectId: project.id,
          key: roleDefinition.key,
          name: roleDefinition.name,
          isSystem: true,
        },
        select: {
          id: true,
          key: true,
        },
      });

      createdRoles[role.key] = role.id;

      await tx.projectRolePermission.createMany({
        data: roleDefinition.permissions.map((permission) => ({
          projectRoleId: role.id,
          permission,
        })),
      });
    }

    await tx.projectMember.create({
      data: {
        projectId: project.id,
        userId,
        roleId: createdRoles.OWNER,
        status: 'ACTIVE',
      },
    });

    const workspace = await tx.projectWorkspace.create({
      data: {
        projectId: project.id,
      },
      select: {
        id: true,
        projectId: true,
        createdAt: true,
      },
    });

    const conversation = await tx.conversation.create({
      data: {
        projectId: project.id,
        title: `گفت‌وگوی پروژه ${project.name}`,
      },
      select: {
        id: true,
        projectId: true,
        title: true,
        createdAt: true,
      },
    });

    return {
      ...project,
      creatorRole: 'OWNER',
      workspace,
      conversation,
    };
  });
}

export async function listProjects({ userId, cursor, limit = 20 }) {
  const items = await prisma.project.findMany({
    where: {
      archivedAt: null,
      members: {
        some: {
          userId,
          status: 'ACTIVE',
        },
      },
    },
    orderBy: [
      { updatedAt: 'desc' },
      { id: 'desc' },
    ],
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
    take: limit + 1,
    select: {
      ...PROJECT_SELECT,
      workspace: {
        select: {
          id: true,
        },
      },
      conversation: {
        select: {
          id: true,
          title: true,
        },
      },
      _count: {
        select: {
          members: {
            where: {
              status: 'ACTIVE',
            },
          },
        },
      },
    },
  });

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;

  return {
    items: page.map((project) => ({
      ...project,
      activeMemberCount: project._count.members,
      _count: undefined,
    })),
    nextCursor: hasMore ? page.at(-1).id : null,
    hasMore,
  };
}

export async function getProjectDetail({ projectId, userId }) {
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
      ...PROJECT_SELECT,

      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },

      members: {
        where: {
          status: 'ACTIVE',
        },
        orderBy: {
          joinedAt: 'asc',
        },
        select: {
          id: true,
          userId: true,
          status: true,
          joinedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              jobRole: true,
            },
          },
          projectRole: {
            select: {
              id: true,
              key: true,
              name: true,
            },
          },
        },
      },

      workspace: {
        select: {
          id: true,
          createdAt: true,
        },
      },

      conversation: {
        select: {
          id: true,
          title: true,
          createdAt: true,
        },
      },

      roles: {
        select: {
          id: true,
          key: true,
          name: true,
          isSystem: true,
          permissions: {
            select: {
              permission: true,
            },
          },
        },
      },
    },
  });

  if (!project) {
    throw new AppError(
      404,
      'PROJECT_NOT_FOUND',
      'پروژه یافت نشد یا شما عضو فعال آن نیستید'
    );
  }

  return {
    ...project,
    roles: project.roles.map((role) => ({
      ...role,
      permissions: role.permissions.map((item) => item.permission),
    })),
  };
}

export async function addProjectMember({
  projectId,
  userId,
  email,
  roleKey,
  actor,
}) {
  if (!actor?.userId || !actor?.permissions?.includes('project:manage_members')) {
    throw new AppError(
      403,
      'PROJECT_PERMISSION_DENIED',
      'شما مجوز افزودن همکار به این پروژه را ندارید. برای دریافت دسترسی با مالک پروژه تماس بگیرید.'
    );
  }

  if ((!userId && !email) || (userId && email)) {
    throw new AppError(
      400,
      'INVALID_MEMBER_IDENTIFIER',
      'برای افزودن همکار باید فقط شناسه کاربری یا ایمیل او را وارد کنید.'
    );
  }

  if (!['MANAGER', 'MEMBER', 'VIEWER'].includes(roleKey)) {
    throw new AppError(
      400,
      'INVALID_PROJECT_ROLE',
      'نقش انتخاب‌شده معتبر نیست. یکی از نقش‌های مجاز پروژه را انتخاب کنید.'
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const project = await tx.project.findFirst({
        where: {
          id: projectId,
          archivedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (!project) {
        throw new AppError(
          404,
          'PROJECT_NOT_FOUND',
          'پروژه موردنظر یافت نشد یا بایگانی شده است. شناسه پروژه را بررسی کنید.'
        );
      }

      const targetUser = userId
        ? await tx.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              jobRole: true,
              isActive: true,
            },
          })
        : await tx.user.findFirst({
            where: {
              email: {
                equals: email.trim(),
                mode: 'insensitive',
              },
            },
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              jobRole: true,
              isActive: true,
            },
          });

      if (!targetUser) {
        throw new AppError(
          404,
          'MEMBER_USER_NOT_FOUND',
          'حساب کاربری این همکار پیدا نشد. شناسه یا ایمیل را بررسی کنید.'
        );
      }

      if (!targetUser.isActive) {
        throw new AppError(
          400,
          'MEMBER_USER_INACTIVE',
          'حساب کاربری این همکار غیرفعال است و امکان افزودن او به پروژه وجود ندارد.'
        );
      }

      if (targetUser.id === actor.userId) {
        throw new AppError(
          400,
          'CANNOT_ADD_SELF',
          'شما از قبل عضو این پروژه هستید و نمی‌توانید خودتان را دوباره اضافه کنید.'
        );
      }

      const existingMember = await tx.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: targetUser.id,
          },
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (existingMember?.status === 'ACTIVE') {
        throw new AppError(
          409,
          'PROJECT_MEMBER_ALREADY_EXISTS',
          'این همکار در حال حاضر عضو فعال پروژه است. نیازی به افزودن مجدد او نیست.'
        );
      }

      if (existingMember) {
        throw new AppError(
          409,
          'PROJECT_MEMBER_INACTIVE',
          'برای این همکار سابقه عضویت غیرفعال وجود دارد. برای فعال‌سازی مجدد، با مالک پروژه تماس بگیرید.'
        );
      }

      const targetRole = await tx.projectRole.findUnique({
        where: {
          projectId_key: {
            projectId,
            key: roleKey,
          },
        },
        include: {
          permissions: {
            select: {
              permission: true,
            },
          },
        },
      });

      if (!targetRole) {
        throw new AppError(
          400,
          'PROJECT_ROLE_NOT_FOUND',
          'نقش انتخاب‌شده در این پروژه وجود ندارد. صفحه پروژه را به‌روزرسانی و دوباره تلاش کنید.'
        );
      }

      const actorPermissions = new Set(actor.permissions);

      const hasExcessPermission = targetRole.permissions.some(
        (item) => !actorPermissions.has(item.permission)
      );

      if (hasExcessPermission) {
        throw new AppError(
          403,
          'PROJECT_ROLE_ESCALATION_DENIED',
          'نقش انتخاب‌شده دسترسی‌هایی بیشتر از سطح دسترسی شما دارد. لطفاً نقش پایین‌تری انتخاب کنید.'
        );
      }

      const membership = await tx.projectMember.create({
        data: {
          projectId,
          userId: targetUser.id,
          roleId: targetRole.id,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          projectId: true,
          userId: true,
          status: true,
          joinedAt: true,
          projectRole: {
            select: {
              id: true,
              key: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              jobRole: true,
            },
          },
        },
      });

      return membership;
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error?.code === 'P2002') {
      throw new AppError(
        409,
        'PROJECT_MEMBER_ALREADY_EXISTS',
        'این همکار قبلاً به پروژه اضافه شده است. فهرست اعضای پروژه را بررسی کنید.'
      );
    }

    throw error;
  }
}

export async function listProjectMembers({ projectId }) {
  const members = await prisma.projectMember.findMany({
    where: {
      projectId,
      status: 'ACTIVE',
    },
    orderBy: {
      joinedAt: 'asc',
    },
    select: {
      id: true,
      userId: true,
      status: true,
      joinedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          jobRole: true,
        },
      },
      projectRole: {
        select: {
          id: true,
          key: true,
          name: true,
        },
      },
    },
  });

  return members;
}

