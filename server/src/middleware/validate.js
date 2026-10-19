import { AppError } from '../utils/errors.js';

export function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new AppError(400, 'Please check the submitted fields.', result.error.issues.map(({ path, message }) => ({ field: path.join('.'), message }))));
    }
    req.validatedBody = result.data;
    next();
  };
}

export function validateQuery(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(new AppError(400, 'Please check the submitted query.', result.error.issues.map(({ path, message }) => ({ field: path.join('.'), message }))));
    }
    req.validatedQuery = result.data;
    next();
  };
}