import cron from 'node-cron';
import { env } from '../config/env.js';
import logger from '../utils/logger.util.js';
import { expireDueSubscriptions, sendExpiryReminders } from './subscription.service.js';

let isHourlyRunning = false;
let isPaymentsRunning = false;

export function startCronJobs() {
  if (env.NODE_ENV === 'test') {
    return;
  }

  // Hourly: run subscription expiry checks and send expiring reminders
  cron.schedule('0 * * * *', async () => {
    if (isHourlyRunning) {
      logger.warn('Previous hourly subscription cron run still in progress, skipping');
      return;
    }
    isHourlyRunning = true;
    try {
      logger.info('Starting subscription expiry check job...');
      const expiredCount = await expireDueSubscriptions();
      logger.info(`Expired ${expiredCount} subscriptions`);

      logger.info('Starting subscription expiry reminder job...');
      const remindedCount = await sendExpiryReminders();
      logger.info(`Sent reminders for ${remindedCount} subscriptions`);
    } catch (err) {
      logger.error('Error in subscription hourly cron jobs', { error: err.message });
    } finally {
      isHourlyRunning = false;
    }
  });

  // Every 5 minutes: check pending payments if payment.service export exists
  cron.schedule('*/5 * * * *', async () => {
    if (isPaymentsRunning) {
      logger.warn('Previous payment check cron run still in progress, skipping');
      return;
    }
    isPaymentsRunning = true;
    try {
      const paymentService = await import('./payment.service.js').catch(() => null);
      if (paymentService && typeof paymentService.expirePendingPayments === 'function') {
        const expiredPaymentsCount = await paymentService.expirePendingPayments();
        logger.info(`Expired ${expiredPaymentsCount} pending payments`);
      }
    } catch (err) {
      logger.error('Error in payment expiry cron job', { error: err.message });
    } finally {
      isPaymentsRunning = false;
    }
  });

  logger.info('Cron jobs initialized successfully');
}