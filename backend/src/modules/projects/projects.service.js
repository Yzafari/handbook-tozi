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

function normalizeLimit(value, fallback = 20, max = 100) {
  const num = Number(value);

  if (!Number.isFinite(num) || num <= 0) return fallback;

  return Math.min(Math.floor(num), max);
}

export async function createProject({ data, userId }) {
  if (!userId) {
    throw new AppError(
      401,
      'UNAUTHORIZED',
      'برای ایجاد پروژه باید وارد حساب کاربری شوید'
    );
  }

  if (!data || typeof data.name !== 'string' || !data.name.trim()) {
    throw new AppError(
      400,
      'INVALID_PROJECT_NAME',
      'نام پروژه الزامی است و نمی‌تواند خالی باشد'
    );
  }

  if (typeof data.type !== 'string' || !data.type.trim()) {
    throw new AppError(
      400,
      'INVALID_PROJECT_TYPE',
      'نوع پروژه الزامی است و نمی‌تواند خالی باشد'
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
      select: PROJECT_SELECT,
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

    await tx.conversationMember.create({
      data: {
        conversationId: conversation.id,
        userId,
        status: 'ACTIVE',
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

export async function listProjects({ userId, cursor, limit }) {
  const take = normalizeLimit(limit);

  const projects = await prisma.project.findMany({
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
    take: take + 1,
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

  const hasMore = projects.length > take;
  const items = hasMore ? projects.slice(0, take) : projects;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return { items, nextCursor, hasMore };
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
                equals: String(email).trim(),
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

      const conversation = await tx.conversation.findUnique({
        where: {
          projectId,
        },
        select: {
          id: true,
        },
      });

      if (!conversation) {
        throw new AppError(
          409,
          'PROJECT_CONVERSATION_NOT_FOUND',
          'اتاق گفت‌وگوی این پروژه پیدا نشد. افزودن همکار انجام نشد؛ لطفاً موضوع را به مدیر سامانه گزارش دهید.'
        );
      }

      await tx.conversationMember.create({
        data: {
          conversationId: conversation.id,
          userId: targetUser.id,
          status: 'ACTIVE',
        },
      });

      return membership;
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error?.code === 'P2002') {
      // P2002 ممکن است برای ProjectMember یا ConversationMember رخ دهد.
      throw new AppError(
        409,
        'PROJECT_MEMBER_CONFLICT',
        'افزودن همکار با تداخل داده مواجه شد. لطفاً فهرست اعضای پروژه و گفت‌وگو را بررسی و دوباره تلاش کنید.'
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

export async function leaveProjectConversation({ projectId, userId }) {
  if (!projectId || !userId) {
    throw new AppError(
      400,
      'INVALID_CONVERSATION_REQUEST',
      'اطلاعات پروژه یا کاربر ناقص است. صفحه را به‌روزرسانی و دوباره تلاش کنید.'
    );
  }

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
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
        conversation: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!project) {
      throw new AppError(
        404,
        'PROJECT_NOT_FOUND',
        'پروژه پیدا نشد یا عضویت فعال شما در آن وجود ندارد. وضعیت عضویت خود را بررسی کنید.'
      );
    }

    if (!project.conversation) {
      throw new AppError(
        409,
        'PROJECT_CONVERSATION_NOT_FOUND',
        'اتاق گفت‌وگوی این پروژه در دسترس نیست. لطفاً موضوع را به مدیر سامانه گزارش دهید.'
      );
    }

    const membership = await tx.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: project.conversation.id,
          userId,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError(
        409,
        'CONVERSATION_MEMBERSHIP_NOT_ACTIVE',
        'شما در حال حاضر عضو فعال گفت‌وگوی این پروژه نیستید. نیازی به خروج مجدد وجود ندارد.'
      );
    }

    await tx.conversationMember.update({
      where: {
        id: membership.id,
      },
      data: {
        status: 'LEFT',
        leftAt: new Date(),
      },
    });

    return {
      projectId,
      conversationId: project.conversation.id,
      status: 'LEFT',
      projectMembershipPreserved: true,
    };
  });
}

export async function rejoinProjectConversation({ projectId, userId }) {
  if (!projectId || !userId) {
    throw new AppError(
      400,
      'INVALID_CONVERSATION_REQUEST',
      'اطلاعات پروژه یا کاربر ناقص است. صفحه را به‌روزرسانی و دوباره تلاش کنید.'
    );
  }

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
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
        conversation: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!project) {
      throw new AppError(
        404,
        'PROJECT_NOT_FOUND',
        'پروژه پیدا نشد یا عضویت فعال شما در آن وجود ندارد. ابتدا وضعیت عضویت خود را بررسی کنید.'
      );
    }

    if (!project.conversation) {
      throw new AppError(
        409,
        'PROJECT_CONVERSATION_NOT_FOUND',
        'اتاق گفت‌وگوی این پروژه در دسترس نیست. لطفاً موضوع را به مدیر سامانه گزارش دهید.'
      );
    }

    const conversationId = project.conversation.id;

    const existingMembership = await tx.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      select: {
        id: true,
        status: true,
        joinedAt: true,
      },
    });

    if (existingMembership?.status === 'ACTIVE') {
      return {
        projectId,
        conversationId,
        status: 'ACTIVE',
        joinedAt: existingMembership.joinedAt,
        alreadyActive: true,
        projectMembershipPreserved: true,
      };
    }

    const now = new Date();

    const membership = await tx.conversationMember.upsert({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      create: {
        conversationId,
        userId,
        status: 'ACTIVE',
        joinedAt: now,
        leftAt: null,
      },
      update: {
        status: 'ACTIVE',
        joinedAt: now,
        leftAt: null,
      },
      select: {
        id: true,
        conversationId: true,
        userId: true,
        status: true,
        joinedAt: true,
        leftAt: true,
      },
    });

    return {
      projectId,
      conversationId: membership.conversationId,
      status: membership.status,
      joinedAt: membership.joinedAt,
      leftAt: membership.leftAt,
      alreadyActive: false,
      projectMembershipPreserved: true,
    };
  });
}

export async function getProjectConversationMembership({ projectId, userId }) {
  if (!projectId || !userId) {
    throw new AppError(
      400,
      'INVALID_CONVERSATION_REQUEST',
      'اطلاعات پروژه یا کاربر ناقص است. صفحه را به‌روزرسانی و دوباره تلاش کنید.'
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
      conversation: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!project) {
    throw new AppError(
      404,
      'PROJECT_NOT_FOUND',
      'پروژه پیدا نشد یا عضویت فعال شما در آن وجود ندارد. ابتدا وضعیت عضویت خود را بررسی کنید.'
    );
  }

  if (!project.conversation) {
    throw new AppError(
      409,
      'PROJECT_CONVERSATION_NOT_FOUND',
      'اتاق گفت‌وگوی این پروژه در دسترس نیست. لطفاً موضوع را به مدیر سامانه گزارش دهید.'
    );
  }

  const membership = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId: project.conversation.id,
        userId,
      },
    },
    select: {
      status: true,
      joinedAt: true,
      leftAt: true,
    },
  });

  const status = membership?.status ?? 'LEFT';

  return {
    projectId: project.id,
    conversationId: project.conversation.id,
    status,
    isMember: status === 'ACTIVE',
    joinedAt: membership?.joinedAt ?? null,
    leftAt: membership?.leftAt ?? null,
    projectMembershipPreserved: true,
  };
}

async function getActiveConversationAccess({ db, projectId, userId }) {
  const project = await db.project.findFirst({
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
      conversation: {
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
      'پروژه پیدا نشد یا عضویت فعال شما در آن وجود ندارد. وضعیت عضویت خود را بررسی کنید.'
    );
  }

  if (!project.conversation) {
    throw new AppError(
      409,
      'PROJECT_CONVERSATION_NOT_FOUND',
      'اتاق گفت‌وگوی این پروژه در دسترس نیست. لطفاً موضوع را به مدیر سامانه گزارش دهید.'
    );
  }

  if (project.conversation.members.length === 0) {
    // اصلاح پیام راهنما طبق مورد ۴ تصاویر
    throw new AppError(
      403,
      'CONVERSATION_MEMBERSHIP_REQUIRED',
      'شما عضو فعال گفت‌وگوی این پروژه نیستید یا قبلاً از آن خارج شده‌اید. لطفاً از گزینه «بازگشت به گفت‌وگو» استفاده کنید.'
    );
  }

  return project.conversation.id;
}

export async function sendConversationMessage({
  projectId,
  userId,
  content,
}) {
  const normalizedContent = String(content ?? '').trim();

  if (!normalizedContent || normalizedContent.length > 10000) {
    throw new AppError(
      400,
      'INVALID_MESSAGE_CONTENT',
      'متن پیام خالی یا بیش از حد طولانی است. پیام را اصلاح و دوباره ارسال کنید.'
    );
  }

  return prisma.$transaction(async (tx) => {
    const conversationId = await getActiveConversationAccess({
      db: tx,
      projectId,
      userId,
    });

    const message = await tx.conversationMessage.create({
      data: {
        conversationId,
        senderId: userId,
        content: normalizedContent,
      },
      select: {
        id: true,
        conversationId: true,
        content: true,
        createdAt: true,
        editedAt: true,
        deletedAt: true,
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            jobRole: true,
          },
        },
      },
    });

    return message;
  });
}

export async function listConversationMessages({
  projectId,
  userId,
  cursor,
  limit,
}) {
  const take = normalizeLimit(limit);

  const conversationId = await getActiveConversationAccess({
    db: prisma,
    projectId,
    userId,
  });

  let cursorMessage = null;

  if (cursor) {
    cursorMessage = await prisma.conversationMessage.findFirst({
      where: {
        id: cursor,
        conversationId,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    if (!cursorMessage) {
      throw new AppError(
        400,
        'INVALID_MESSAGE_CURSOR',
        'نقطه ادامه تاریخچه پیام معتبر نیست. صفحه گفت‌وگو را تازه‌سازی و دوباره تلاش کنید.'
      );
    }
  }

  const where = {
    conversationId,
    ...(cursorMessage
      ? {
          OR: [
            { createdAt: { lt: cursorMessage.createdAt } },
            {
              createdAt: cursorMessage.createdAt,
              id: { lt: cursorMessage.id },
            },
          ],
        }
      : {}),
  };

  const messages = await prisma.conversationMessage.findMany({
    where,
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' },
    ],
    take: take + 1,
    select: {
      id: true,
      conversationId: true,
      content: true,
      createdAt: true,
      editedAt: true,
      deletedAt: true,
      sender: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          jobRole: true,
        },
      },
    },
  });

  const hasMore = messages.length > take;
  const page = hasMore ? messages.slice(0, take) : messages;

  // شناسه قدیمی‌ترین پیام همین صفحه، پیش از معکوس‌سازی محاسبه می‌شود.
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  const items = page
    .slice()
    .reverse()
    .map((message) => ({
      ...message,
      content: message.deletedAt ? null : message.content,
      isDeleted: Boolean(message.deletedAt),
    }));

  return { items, nextCursor, hasMore };
} // <--- آکولاد بسته‌شده اضافه شد

export async function editConversationMessage({
  projectId,
  userId,
  messageId,
  content,
}) {
  const normalizedContent = String(content ?? '').trim();

  if (!messageId) {
    throw new AppError(
      400,
      'INVALID_MESSAGE_ID',
      'شناسه پیام معتبر نیست. صفحه گفت‌وگو را تازه‌سازی و دوباره تلاش کنید.'
    );
  }

  if (!normalizedContent || normalizedContent.length > 10000) {
    throw new AppError(
      400,
      'INVALID_MESSAGE_CONTENT',
      'متن پیام خالی یا بیش از حد طولانی است. متن پیام را اصلاح و دوباره تلاش کنید.'
    );
  }

  return prisma.$transaction(async (tx) => {
    const conversationId = await getActiveConversationAccess({
      db: tx,
      projectId,
      userId,
    });

    const message = await tx.conversationMessage.findFirst({
      where: {
        id: messageId,
        conversationId,
      },
      select: {
        id: true,
        senderId: true,
        deletedAt: true,
      },
    });

    if (!message) {
      throw new AppError(
        404,
        'MESSAGE_NOT_FOUND',
        'پیام موردنظر در گفت‌وگوی این پروژه پیدا نشد.'
      );
    }

    // کنترل دسترسی: فقط نویسنده پیام مجاز به ویرایش است
    if (message.senderId !== userId) {
      throw new AppError(
        403,
        'MESSAGE_EDIT_FORBIDDEN',
        'فقط نویسنده پیام می‌تواند آن را ویرایش کند.'
      );
    }

    if (message.deletedAt) {
      throw new AppError(
        409,
        'MESSAGE_ALREADY_DELETED',
        'این پیام قبلاً حذف شده و امکان ویرایش آن وجود ندارد.'
      );
    }

    // مدیریت هم‌زمانی با updateMany و چک کردن deletedAt: null
    const updateResult = await tx.conversationMessage.updateMany({
      where: {
        id: messageId,
        conversationId,
        senderId: userId,
        deletedAt: null,
      },
      data: {
        content: normalizedContent,
        editedAt: new Date(),
      },
    });

    if (updateResult.count !== 1) {
      throw new AppError(
        409,
        'MESSAGE_EDIT_CONFLICT',
        'پیام هم‌زمان تغییر کرده یا دیگر قابل ویرایش نیست. تاریخچه گفت‌وگو را تازه‌سازی و دوباره تلاش کنید.'
      );
    }

    const updatedMessage = await tx.conversationMessage.findFirst({
      where: {
        id: messageId,
        conversationId,
      },
      select: {
        id: true,
        conversationId: true,
        content: true,
        createdAt: true,
        editedAt: true,
        deletedAt: true,
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            jobRole: true,
          },
        },
      },
    });

    return updatedMessage;
  });
}

export async function deleteConversationMessage({
  projectId,
  userId,
  messageId,
}) {
  if (!messageId) {
    throw new AppError(
      400,
      'INVALID_MESSAGE_ID',
      'شناسه پیام معتبر نیست. صفحه گفت‌وگو را تازه‌سازی و دوباره تلاش کنید.'
    );
  }

  return prisma.$transaction(async (tx) => {
    const conversationId = await getActiveConversationAccess({
      db: tx,
      projectId,
      userId,
    });

    const message = await tx.conversationMessage.findFirst({
      where: {
        id: messageId,
        conversationId,
      },
      select: {
        id: true,
        senderId: true,
        deletedAt: true,
      },
    });

    if (!message) {
      throw new AppError(
        404,
        'MESSAGE_NOT_FOUND',
        'پیام موردنظر در گفت‌وگوی این پروژه پیدا نشد.'
      );
    }

    // کنترل دسترسی: فقط نویسنده پیام مجاز به حذف است
    if (message.senderId !== userId) {
      throw new AppError(
        403,
        'MESSAGE_DELETE_FORBIDDEN',
        'فقط نویسنده پیام می‌تواند آن را حذف کند.'
      );
    }

    if (message.deletedAt) {
      throw new AppError(
        409,
        'MESSAGE_ALREADY_DELETED',
        'این پیام قبلاً حذف شده است و نیازی به حذف دوباره آن نیست.'
      );
    }

    const deletedAt = new Date();

    // مدیریت هم‌زمانی با updateMany و چک کردن deletedAt: null
    const updateResult = await tx.conversationMessage.updateMany({
      where: {
        id: messageId,
        conversationId,
        senderId: userId,
        deletedAt: null,
      },
      data: {
        deletedAt,
      },
    });

    if (updateResult.count !== 1) {
      throw new AppError(
        409,
        'MESSAGE_DELETE_CONFLICT',
        'وضعیت پیام هم‌زمان تغییر کرده است. تاریخچه گفت‌وگو را تازه‌سازی و دوباره تلاش کنید.'
      );
    }

    const deletedMessage = await tx.conversationMessage.findFirst({
      where: {
        id: messageId,
        conversationId,
      },
      select: {
        id: true,
        conversationId: true,
        content: true,
        createdAt: true,
        editedAt: true,
        deletedAt: true,
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            jobRole: true,
          },
        },
      },
    });

    return {
      ...deletedMessage,
      content: null,
      isDeleted: true,
    };
  });
}
// <--- آکولاد اضافی انتهای فایل حذف شد
