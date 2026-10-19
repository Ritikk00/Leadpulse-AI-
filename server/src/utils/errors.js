export class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function notFound(_req, _res, next) {
  next(new AppError(404, 'The requested resource was not found.'));
}

export function errorHandler(error, _req, res, _next) {
  const isMongooseError = ['ValidationError', 'CastError'].includes(error.name);
  const status = error.status || (isMongooseError || error.name === 'ZodError' ? 400 : 500);
  if (status >= 500) {
    const message = process.env.NODE_ENV === 'production'
      ? 'Unexpected server error'
      : error instanceof Error ? error.message : String(error);
    console.error(`[api:error] ${message}`);
  }
  const message = status >= 500
    ? 'An unexpected server error occurred.'
    : process.env.NODE_ENV === 'production' && isMongooseError
      ? 'Please check the submitted information.'
      : error.message || 'The request could not be completed.';
  res.status(status).json({ success: false, message });
}