import { z } from 'zod';

export const createPlanSchema = z.object({
  slug: z
    .string({ required_error: 'شناسه متنی پلن (slug) الزامی است' })
    .trim()
    .min(2, 'شناسه پلن حداقل باید ۲ کاراکتر باشد')
    .max(50, 'شناسه پلن حداکثر می‌تواند ۵۰ کاراکتر باشد')
    .regex(/^[a-z0-9-]+$/, 'شناسه پلن فقط شامل حروف کوچک انگلیسی، اعداد و خط تیره می‌باشد'),
  name: z
    .string({ required_error: 'نام پلن الزامی است' })
    .trim()
    .min(2, 'نام پلن حداقل باید ۲ کاراکتر باشد')
    .max(100, 'نام پلن حداکثر می‌تواند ۱۰۰ کاراکتر باشد'),
  description: z
    .string({ invalid_type_error: 'توضیحات باید رشته باشد' })
    .trim()
    .max(500, 'توضیحات حداکثر می‌تواند ۵۰۰ کاراکتر باشد')
    .optional()
    .nullable(),
  priceToman: z.coerce
    .number({ required_error: 'مبلغ پلن الزامی است' })
    .int('مبلغ باید عدد صحیح باشد')
    .min(0, 'مبلغ پلن نمی‌تواند منفی باشد'),
  durationDays: z.coerce
    .number({ required_error: 'مدت زمان پلن الزامی است' })
    .int('مدت زمان باید عدد صحیح باشد')
    .min(1, 'مدت زمان پلن باید حداقل ۱ روز باشد'),
  features: z
    .array(z.string().trim().min(1, 'عنوان ویژگی نمی‌تواند خالی باشد'))
    .default([]),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

export const updatePlanSchema = createPlanSchema.partial();

export const idParamSchema = z.object({
  id: z.string({ required_error: 'شناسه الزامی است' }).uuid('شناسه باید از نوع UUID معتبر باشد'),
});