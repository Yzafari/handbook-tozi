import cron from 'node-cron';
import { expireDueSubscriptions, sendExpiryReminders } from './subscription.service.js';
import { expirePendingPayments } from './payment.service.js';
import { env } from '../config/env.js';
import logger from '../utils/logger.util.js';

let isSubscriptionJobRunning = false;
let isPaymentJobRunning = false;

export function startCronJobs() {
  // در محیط تست، کرون‌جاب‌ها اجرا نشوند
  if (env.NODE_ENV === 'test') {
    return;
  }

  logger.info('Cron jobs initialized.');

  // ۱. هر ساعت: بررسی اشتراک‌های منقضی شده و ارسال یادآوری
  cron.schedule('0 * * * *', async () => {
    if (isSubscriptionJobRunning) return;
    isSubscriptionJobRunning = true;
    try {
      logger.info('Running hourly subscription checks...');
      await expireDueSubscriptions();
      await sendExpiryReminders();
    } catch (error) {
      logger.error('Error in hourly subscription cron:', error);
    } finally {
      isSubscriptionJobRunning = false;
    }
  });

  // ۲. هر ۵ دقیقه: منقضی کردن پرداخت‌های معلق
  cron.schedule('*/5 * * * *', async () => {
    if (isPaymentJobRunning) return;
    isPaymentJobRunning = true;
    try {
      logger.info('Running 5-minute payment expiry checks...');
      await expirePendingPayments();
    } catch (error) {
      logger.error('Error in payment expiry cron:', error);
    } finally {
      isPaymentJobRunning = false;
    }
  });
}