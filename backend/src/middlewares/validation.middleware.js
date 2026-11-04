import { AppError } from '../utils/response.util';
import { z } from 'zod';

export function validate(schemas) {
  return (req, res, next) => {
    const { body, query, params } = req;

    try {
      if (body && schemas.body) {
        schemas.body.parse(body);
      }

      if (query && schemas.query) {
        schemas.query.parse(query);
      }

      if (params && schemas.params) {
        schemas.params.parse(params);
      }

      next();
    } catch (error) {
      next(new AppError(400, 'VALIDATION_ERROR', error.issues));
    }
  };
}
