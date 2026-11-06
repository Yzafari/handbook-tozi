import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-email-password',
  },
});

export async function sendMail(to, subject, text) {
  const mailOptions = {
    from: 'your-email@gmail.com',
    to,
    subject,
    text,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

export async function sendExpiryReminderEmail(user) {
  const subject = 'Plan Expiry Reminder';
  const text = `Hello ${user.fullName}, your plan is expiring soon. Please renew it before it expires.`;
  return sendMail(user.email, subject, text);
}

export async function sendExpiredEmail(user) {
  const subject = 'Plan Expired';
  const text = `Hello ${user.fullName}, your plan has expired. Please renew it to continue using our services.`;
  return sendMail(user.email, subject, text);
}

export async function sendPaymentSuccessEmail(user, plan) {
  const subject = 'Payment Successful';
  const text = `Hello ${user.fullName}, your payment for ${plan.name} has been successful.`;
  return sendMail(user.email, subject, text);
}
