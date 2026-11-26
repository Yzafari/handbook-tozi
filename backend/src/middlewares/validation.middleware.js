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
  // Backward-compatible shorthand: validate(zodSchema) validates req.body.
  // Explicit form validate({ body, query, params }) supports multi-part validation.
  const normalizedSchemas = schemas && typeof schemas.parse === 'function'
    ? { body: schemas }
    : (schemas ?? {});

  return (req, res, next) => {
    const { body, query, params } = req;

    try {
      if (body && normalizedSchemas.body) {
        assign(req, 'body', normalizedSchemas.body.parse(body));
      }

      if (query && normalizedSchemas.query) {
        assign(req, 'query', normalizedSchemas.query.parse(query));
      }

      if (params && normalizedSchemas.params) {
        assign(req, 'params', normalizedSchemas.params.parse(params));
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Keep the issues array structured: pass it as `details` so the error
        // handler can return it under `meta` instead of stringifying it. The
        // message itself is the first human-readable issue (the schemas carry
        // Persian messages), so clients can show it without parsing details.
        const message = error.issues[0]?.message || 'Validation error';
        return next(new AppError(400, 'VALIDATION_ERROR', message, error.issues));
      }
      next(error);
    }
  };
}
