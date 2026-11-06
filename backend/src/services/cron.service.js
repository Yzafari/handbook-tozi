import cron from 'node-cron';

export function startCronJobs() {
  // Schedule hourly subscription checks
  cron.schedule('0 * * * *', async () => {
    console.log('Running hourly subscription checks...');
    // Add your subscription check logic here
  });

  // Schedule 5-minute payment expiry checks
  cron.schedule('*/5 * * * *', async () => {
    console.log('Running 5-minute payment expiry checks...');
    // Add your payment expiry check logic here
  });
}
