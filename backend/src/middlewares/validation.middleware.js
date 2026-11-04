import { AppError } from '../utils/response.util.js';

export function validate(schemas = {}) {
  return (req, res, next) => {
    const details = [];
    const parsed = {};

    for (const part of ['params', 'query', 'body']) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part]);
      if (result.success) {
        parsed[part] = result.data;
      } else {
        details.push(
          ...result.error.issues.map((i) => ({
            location: part,
            path: i.path.join('.'),
            message: i.message,
          }))
        );
      }
    }

    if (details.length) {
      return next(new AppError(400, 'VALIDATION_ERROR', 'Validation failed', details));
    }

    for (const [part, value] of Object.entries(parsed)) {
      req[part] = value;
    }
    return next();
  };
}