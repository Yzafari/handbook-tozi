import 'dotenv/config';
import nodemailer from 'nodemailer';

let transporter;
function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' } : undefined,
  });
  return transporter;
}

export async function sendMail(to, subject, text) {
  const transport = getTransporter();
  if (!transport || !to) return false;
  try {
    await transport.sendMail({ from: process.env.MAIL_FROM || 'هندبوک توزیع <no-reply@example.invalid>', to, subject, text });
    return true;
  } catch (error) {
    // Never log credentials or message content.
    console.error('Email delivery failed:', error?.message);
    return false;
  }
}

export async function sendExpiryReminderEmail(user) {
  return sendMail(user.email, 'یادآوری پایان اشتراک', `سلام ${user.name ?? 'کاربر'}، اعتبار اشتراک شما به‌زودی پایان می‌یابد.`);
}
export async function sendExpiredEmail(user) {
  return sendMail(user.email, 'پایان اشتراک', `سلام ${user.name ?? 'کاربر'}، اعتبار اشتراک شما پایان یافته است.`);
}
export async function sendPaymentSuccessEmail(user, plan) {
  return sendMail(user.email, 'پرداخت موفق', `سلام ${user.name ?? 'کاربر'}، پرداخت پلن ${plan.name} با موفقیت انجام شد.`);
}
