import { z } from 'zod';

const requiredString = (message) =>
  z.string({ error: message }).trim().min(1, message);

const emailSchema = z
  .string({ error: 'ایمیل الزامی است.' })
  .trim()
  .min(1, 'ایمیل الزامی است.')
  .email('فرمت ایمیل معتبر نیست.')
  .max(254, 'ایمیل بیش از حد طولانی است.')
  .transform((value) => value.toLowerCase());

const passwordSchema = z
  .string({ error: 'رمز عبور الزامی است.' })
  .min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد.')
  .regex(/[a-z]/, 'رمز عبور باید حداقل یک حرف کوچک انگلیسی داشته باشد.')
  .regex(/[A-Z]/, 'رمز عبور باید حداقل یک حرف بزرگ انگلیسی داشته باشد.')
  .regex(/[0-9]/, 'رمز عبور باید حداقل یک رقم داشته باشد.');

const phoneSchema = z
  .string()
  .trim()
  .max(20, 'شماره تلفن بیش از حد طولانی است.')
  .regex(/^[+\d۰-۹٠-٩\s()-]*$/, 'شماره تلفن معتبر نیست.')
  .optional()
  .or(z.literal(''));

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: 'رمز عبور الزامی است.' })
    .min(1, 'رمز عبور الزامی است.')
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: requiredString('نام و نام خانوادگی الزامی است.')
    .min(2, 'نام باید حداقل ۲ کاراکتر باشد.')
    .max(100, 'نام بیش از حد طولانی است.'),
  phone: phoneSchema
});

export const profileSchema = z.object({
  fullName: requiredString('نام و نام خانوادگی الزامی است.')
    .min(2, 'نام باید حداقل ۲ کاراکتر باشد.')
    .max(100, 'نام بیش از حد طولانی است.'),
  phone: phoneSchema
});

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: 'رمز عبور فعلی الزامی است.' })
      .min(1, 'رمز عبور فعلی الزامی است.'),
    newPassword: passwordSchema,
    confirmPassword: z
      .string({ error: 'تکرار رمز عبور الزامی است.' })
      .min(1, 'تکرار رمز عبور الزامی است.')
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'رمز عبور جدید باید با رمز عبور فعلی متفاوت باشد.',
    path: ['newPassword']
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'تکرار رمز عبور با رمز عبور جدید مطابقت ندارد.',
    path: ['confirmPassword']
  });