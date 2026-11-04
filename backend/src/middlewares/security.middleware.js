import helmet from 'helmet';
import cors from 'cors';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';

export function applySecurity(app) {
  app.use(helmet());
  app.use(cors());
  app.use(hpp());
  app.use(cookieParser());
}

export function issueCsrfToken(req, res, next) {
  const csrfToken = req.csrfToken();
  res.cookie('XSRF-TOKEN', csrfToken, { httpOnly: true, secure: true });
  next();
}

export function csrfProtect(req, res, next) {
  const csrfToken = req.cookies['XSRF-TOKEN'];
  const token = req.headers['x-csrf-token'] || req.body['x-csrf-token'] || req.query['x-csrf-token'];

  if (csrfToken !== token) {
    return res.status(403).json({ success: false, message: 'Invalid CSRF token' });
  }

  next();
}
