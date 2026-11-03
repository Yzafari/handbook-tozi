export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

function envelope(data, message, meta) {
  const body = { success: true, data: data === undefined ? null : data };
  if (message !== undefined) body.message = message;
  if (meta !== undefined) body.meta = meta;
  return body;
}

export function ok(res, data, message, meta) {
  return res.status(200).json(envelope(data, message, meta));
}

export function created(res, data, message) {
  return res.status(201).json(envelope(data, message));
}
