import winston from 'winston';
import { env } from '../config/env.js';

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const isProd = env.NODE_ENV === 'production';

const devFormat = combine(
  errors({ stack: true }),
  timestamp({ format: 'HH:mm:ss' }),
  colorize(),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} ${level}: ${stack || message}${rest}`;
  })
);

const prodFormat = combine(errors({ stack: true }), timestamp(), json());

const logger = winston.createLogger({
  level: isProd ? 'info' : 'debug',
  format: isProd ? prodFormat : devFormat,
  transports: [new winston.transports.Console()],
  silent: env.NODE_ENV === 'test',
});

export default logger;