export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
};

export const COOKIE = {
  NAME: 'auth_token',
  EXPIRES_IN: '1d',
};

export const CSRF_HEADER = 'X-CSRF-Token';

export const AUTH = {
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'dev_access_secret',
  JWT_REFRESH_SECRET: process.env.ENCRYPTION_KEY || 'dev_refresh_secret',
};

export const PAYMENT = {
  STRIPE_SECRET_KEY: 'your_stripe_secret_key',
  STRIPE_PUBLISHABLE_KEY: 'your_stripe_publishable_key',
  REMINDER_DAYS_BEFORE: 3,
};

export const AUDIT_ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
};
