import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email('ایمیل معتبر نیست'),
  password: z.string().min(8, 'رمز عبور باید حداقل 8 کاراکتر باشد'),
  confirmPassword: z.string().min(8, 'تکرار رمز عبور باید حداقل 8 کاراکتر باشد'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'رمز عبور و تکرار رمز عبور باید همانند باشند',
});

const loginSchema = z.object({
  email: z.string().email('ایمیل معتبر نیست'),
  password: z.string().min(8, 'رمز عبور باید حداقل 8 کاراکتر باشد'),
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(8, 'رمز عبور فعلی باید حداقل 8 کاراکتر باشد'),
  newPassword: z.string().min(8, 'رمز عبور جدید باید حداقل 8 کاراکتر باشد'),
  confirmPassword: z.string().min(8, 'تکرار رمز عبور جدید باید حداقل 8 کاراکتر باشد'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'رمز عبور جدید و تکرار رمز عبور جدید باید همانند باشند',
});

export { registerSchema, loginSchema, changePasswordSchema };
