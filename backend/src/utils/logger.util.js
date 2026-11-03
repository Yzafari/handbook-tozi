import winston from 'winston';

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

if (process.env.NODE_ENV === 'production') {
  logger.remove(logger.transports.Console);
  logger.add(
    new winston.transports.File({
      filename: 'error.log',
      level: 'error',
      format: winston.format.json(),
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'combined.log',
      format: winston.format.json(),
    })
  );
}

export default logger;
