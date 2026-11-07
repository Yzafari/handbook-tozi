import app from './app.js';
import { startCronJobs } from './services/cron.service.js';
import logger from './utils/logger.util.js';

const port = process.env.PORT || 3000;

app.listen(port, () => {
  logger.info(`Server listening on port ${port}`);
  startCronJobs();
});
