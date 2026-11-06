import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import logger from '../utils/logger.util.js';

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

export async function sendMail({ to, subject, html }) {
  try {
    const mailOptions = {
      from: env.MAIL_FROM,
      to,
      subject,
      html,
    };

    if (env.NODE_ENV === 'test') {
      logger.debug(`[TEST EMAIL] To: ${to} | Subject: ${subject}`);
      return { messageId: 'test-message-id' };
    }

    const info = await getTransporter().sendMail(mailOptions);
    logger.info(`Email sent successfully to ${to}`, { messageId: info.messageId });
    return info;
  } catch (error) {
    logger.error(`Failed to send email to ${to}: ${error.message}`, { error });
    return null;
  }
}

function baseTemplate({ title, content }) {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: Tahoma, 'Segoe UI', Arial, sans-serif;
      direction: rtl;
      text-align: right;
      background-color: #f7f9fa;
      margin: 0;
      padding: 24px;
      color: #1e293b;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
      overflow: hidden;
    }
    .header {
      background-color: #2563eb;
      color: #ffffff;
      padding: 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }
    .body {
      padding: 24px;
      line-height: 1.7;
      font-size: 15px;
    }
    .footer {
      background-color: #f8fafc;
      padding: 16px 24px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
    .button {
      display: inline-block;
      margin-top: 16px;
      padding: 10px 24px;
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title}</h1>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      این ایمیل به صورت خودکار ارسال شده است، لطفاً به آن پاسخ ندهید.
    </div>
  </div>
</body>
</html>
  `.trim();
}

export async function sendExpiryReminderEmail(user, subscription) {
  const title = 'یادآوری پایان دوره اشتراک';
  const planName = subscription.plan?.name || 'پلن انتخابی';
  const endsAtFormatted = new Date(subscription.endsAt).toLocaleDateString('fa-IR');

  const content = `
    <p>سلام ${user.fullName || 'کاربر گرامی'}،</p>
    <p>به اطلاع می‌رساند که اشتراک شما برای <strong>«${planName}»</strong> در تاریخ <strong>${endsAtFormatted}</strong> به پایان خواهد رسید.</p>
    <p>جهت جلوگیری از قطع دسترسی و استفاده مداوم از خدمات، می‌توانید اشتراک خود را تمدید فرمایید.</p>
    <div style="text-align: center;">
      <a href="${env.FRONTEND_URL}/dashboard" class="button">تمدید اشتراک</a>
    </div>
  `;

  return sendMail({
    to: user.email,
    subject: title,
    html: baseTemplate({ title, content }),
  });
}

export async function sendExpiredEmail(user) {
  const title = 'انقضای اشتراک';
  const content = `
    <p>سلام ${user.fullName || 'کاربر گرامی'}،</p>
    <p>اشتراک شما به پایان رسیده است و در حال حاضر دسترسی فعال به امکانات ویژه ندارید.</p>
    <p>برای فعال‌سازی مجدد، کافیست از طریق داشبورد خود یکی از پلن‌های فعال را انتخاب کنید.</p>
    <div style="text-align: center;">
      <a href="${env.FRONTEND_URL}/plans" class="button">مشاهده پلن‌ها</a>
    </div>
  `;

  return sendMail({
    to: user.email,
    subject: title,
    html: baseTemplate({ title, content }),
  });
}

export async function sendPaymentSuccessEmail(user, payment) {
  const title = 'رسید پرداخت موفق';
  const amountFormatted = Number(payment.amountToman || 0).toLocaleString('fa-IR');
  const refId = payment.refId || 'ثبت نشده';

  const content = `
    <p>سلام ${user.fullName || 'کاربر گرامی'}،</p>
    <p>پرداخت شما با موفقیت به ثبت رسید و اشتراک شما فعال گردید.</p>
    <ul>
      <li>مبلغ پرداختی: <strong>${amountFormatted} تومان</strong></li>
      <li>شماره پیگیری: <strong>${refId}</strong></li>
      <li>تاریخ پرداخت: <strong>${new Date().toLocaleDateString('fa-IR')}</strong></li>
    </ul>
    <div style="text-align: center;">
      <a href="${env.FRONTEND_URL}/dashboard" class="button">ورود به حساب کاربری</a>
    </div>
  `;

  return sendMail({
    to: user.email,
    subject: title,
    html: baseTemplate({ title, content }),
  });
}