import { z } from 'zod';

export const updateProfileSchema = z.object({
  fullName: z
    .string({ invalid_type_error: 'نام و نام خانوادگی باید رشته باشد' })
    .trim()
    .min(2, 'نام و نام خانوادگی حداقل باید ۲ کاراکتر باشد')
    .max(80, 'نام و نام خانوادگی حداکثر می‌تواند ۸۰ کاراکتر باشد')
    .optional(),
  phone: z
    .string({ invalid_type_error: 'شماره موبایل نامعتبر است' })
    .trim()
    .regex(/^09\d{9}$/, 'شماره موبایل وارد شده باید با ۰۹ شروع شده و ۱۱ رقم باشد')
    .optional()
    .nullable(),
});

export const paginationQuerySchema = z.object({
  page: z.coerce
    .number({ invalid_type_error: 'شماره صفحه باید عدد باشد' })
    .int('شماره صفحه باید عدد صحیح باشد')
    .min(1, 'شماره صفحه باید حداقل ۱ باشد')
    .default(1),
  limit: z.coerce
    .number({ invalid_type_error: 'تعداد آیتم باید عدد باشد' })
    .int('تعداد آیتم باید عدد صحیح باشد')
    .min(1, 'تعداد در هر صفحه باید حداقل ۱ باشد')
    .max(50, 'حداکثر ۵۰ آیتم در هر صفحه مجاز است')
    .default(10),
});