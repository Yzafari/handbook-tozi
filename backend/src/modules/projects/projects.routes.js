import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import * as controller from './projects.controller.js';
import { requireProjectPermission } from './access.js';

const router = Router();

const createProjectSchema = z.object({
  name: z.string().trim().min(2, 'نام پروژه باید حداقل ۲ کاراکتر باشد').max(180),
  description: z.string().trim().max(5000).optional().nullable(),
  type: z.string().trim().min(2, 'نوع پروژه معتبر نیست').max(80),

  startDate: z.coerce.date().optional().nullable(),
  expectedEndDate: z.coerce.date().optional().nullable(),

  organizationName: z.string().trim().max(180).optional().nullable(),
  employerName: z.string().trim().max(180).optional().nullable(),
  contractorName: z.string().trim().max(180).optional().nullable(),

  projectManagerUserId: z.string().trim().min(1).optional().nullable(),
  employerUserId: z.string().trim().min(1).optional().nullable(),
  supervisorUserId: z.string().trim().min(1).optional().nullable(),
  contractorUserId: z.string().trim().min(1).optional().nullable(),
  technicalLeadUserId: z.string().trim().min(1).optional().nullable(),

  province: z.string().trim().max(100).optional().nullable(),
  county: z.string().trim().max(100).optional().nullable(),
  address: z.string().trim().max(1000).optional().nullable(),

  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
}).superRefine((data, ctx) => {
  if (
    data.startDate &&
    data.expectedEndDate &&
    data.expectedEndDate < data.startDate
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['expectedEndDate'],
      message: 'تاریخ پایان مورد انتظار نمی‌تواند قبل از تاریخ شروع باشد',
    });
  }

  if (
    (data.latitude == null) !==
    (data.longitude == null)
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['latitude'],
      message: 'برای ثبت موقعیت، طول و عرض جغرافیایی باید هم‌زمان ارسال شوند',
    });
  }
});

const listQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(128).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const idParamsSchema = z.object({
  id: z.string().trim().min(1).max(128),
});

const sendConversationMessageSchema = z.object({
  content: z.string()
    .trim()
    .min(1, 'متن پیام نمی‌تواند خالی باشد')
    .max(10000, 'متن پیام نمی‌تواند بیشتر از ۱۰۰۰۰ کاراکتر باشد'),
});

const conversationMessagesQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(128).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const addMemberSchema = z.object({
  userId: z.string().trim().min(1).optional(),
  email: z.string().trim().email('آدرس ایمیل معتبر نیست').optional(),
  roleKey: z.enum(['MANAGER', 'MEMBER', 'VIEWER']),
}).superRefine((data, ctx) => {
  const hasUserId = Boolean(data.userId);
  const hasEmail = Boolean(data.email);

  if (hasUserId === hasEmail) {
    ctx.addIssue({
      code: 'custom',
      path: ['userId'],
      message: 'برای افزودن همکار باید فقط شناسه کاربری یا ایمیل را وارد کنید',
    });
  }
});

router.use(authenticate);

router.post(
  '/',
  validate({ body: createProjectSchema }),
  controller.create
);

router.get(
  '/',
  validate({ query: listQuerySchema }),
  controller.list
);

router.get(
  '/:id',
  validate({ params: idParamsSchema }),
  requireProjectPermission('project:read'),
  controller.detail
);

router.post(
  '/:id/members',
  validate({
    params: idParamsSchema,
    body: addMemberSchema,
  }),
  requireProjectPermission('project:manage_members'),
  controller.addMember
);

router.get(
  '/:id/members',
  validate({ params: idParamsSchema }),
  requireProjectPermission('project:manage_members'),
  controller.listMembers
);

router.post(
  '/:id/conversation/leave',
  validate({ params: idParamsSchema }),
  requireProjectPermission('project:read'),
  controller.leaveConversation
);

router.post(
  '/:id/conversation/rejoin',
  validate({ params: idParamsSchema }),
  requireProjectPermission('conversation:read'),
  controller.rejoinConversation
);

router.post(
  '/:id/conversation/messages',
  validate({
    params: idParamsSchema,
    body: sendConversationMessageSchema,
  }),
  requireProjectPermission('conversation:read'),
  controller.sendConversationMessage
);

router.get(
  '/:id/conversation/messages',
  validate({
    params: idParamsSchema,
    query: conversationMessagesQuerySchema,
  }),
  requireProjectPermission('conversation:read'),
  controller.listConversationMessages
);

export default router;
