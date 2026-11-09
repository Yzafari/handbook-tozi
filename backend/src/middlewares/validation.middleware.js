import { AppError } from '../utils/response.util.js';
import { ZodError } from 'zod';

// Express 5 exposes req.query as a getter-only property, so a plain assignment
// throws. Fall back to defineProperty when the property is not writable.
function assign(target, key, value) {
  try {
    target[key] = value;
  } catch {
    Object.defineProperty(target, key, {
      value,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }
}

export function validate(schemas) {
  return (req, res, next) => {
    const { body, query, params } = req;

    try {
      if (body && schemas.body) {
        assign(req, 'body', schemas.body.parse(body));
      }

      if (query && schemas.query) {
        assign(req, 'query', schemas.query.parse(query));
      }

      if (params && schemas.params) {
        assign(req, 'params', schemas.params.parse(params));
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Keep the issues array structured: pass it as `details` so the error
        // handler can return it under `meta` instead of stringifying it.
        return next(new AppError(400, 'VALIDATION_ERROR', 'Validation error', error.issues));
      }
      next(error);
    }
  };
}
