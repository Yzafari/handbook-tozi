import { z } from 'zod';
import { JOB_ROLE_VALUES } from '../config/job-roles.js';
import { PROVINCE_VALUES } from '../config/provinces.js';

const email = z
  .string({ required_error: 'ایمیل الزامی است', invalid_type_error: 'ایمیل نامعتبر است' })
  .trim()
  .toLowerCase()
  .min(1, 'ایمیل الزامی است')
  .max(254, 'ایمیل بیش از حد طولانی است')
  .email('فرمت ایمیل معتبر نیست');

const strongPassword = z
  .string({ required_error: 'رمز عبور الزامی است', invalid_type_error: 'رمز عبور نامعتبر است' })
  .min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد')
  .max(72, 'رمز عبور نباید بیشتر از ۷۲ کاراکتر باشد')
  .regex(/[a-z]/, 'رمز عبور باید شامل حداقل یک حرف کوچک انگلیسی باشد')
  .regex(/[A-Z]/, 'رمز عبور باید شامل حداقل یک حرف بزرگ انگلیسی باشد')
  .regex(/\d/, 'رمز عبور باید شامل حداقل یک عدد باشد');

const fullName = z
  .string({ required_error: 'نام و نام خانوادگی الزامی است', invalid_type_error: 'نام نامعتبر است' })
  .trim()
  .min(2, 'نام و نام خانوادگی باید حداقل ۲ کاراکتر باشد')
  .max(100, 'نام و نام خانوادگی نباید بیشتر از ۱۰۰ کاراکتر باشد');

const phone = z
  .string({ invalid_type_error: 'شماره تلفن نامعتبر است' })
  .trim()
  .regex(/^(\+98|0098|0)?9\d{9}$/, 'شماره موبایل معتبر نیست')
  .optional()
  .or(z.literal('').transform(() => undefined));

export const registerSchema = {
  body: z.object({
    email,
    password: strongPassword,
    fullName,
    phone,
    jobRole: z.enum(JOB_ROLE_VALUES).optional(),
    province: z.enum(PROVINCE_VALUES).optional(),
  }),
};

export const loginSchema = {
  body: z.object({
    email,
    password: z
      .string({ required_error: 'رمز عبور الزامی است', invalid_type_error: 'رمز عبور نامعتبر است' })
      .min(1, 'رمز عبور الزامی است')
      .max(72, 'رمز عبور نباید بیشتر از ۷۲ کاراکتر باشد'),
  }),
};

export const changePasswordSchema = {
  body: z.object({
    currentPassword: z
      .string({ required_error: 'رمز عبور فعلی الزامی است', invalid_type_error: 'رمز عبور فعلی نامعتبر است' })
      .min(1, 'رمز عبور فعلی الزامی است')
      .max(72, 'رمز عبور نباید بیشتر از ۷۲ کاراکتر باشد'),
    newPassword: strongPassword,
  }),
};
export const refreshTokenSchema = z.object({ refreshToken: z.string().regex(/^[a-f0-9]{64}$/i) });
