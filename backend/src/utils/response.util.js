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

function responseMeta(res, meta) {
  const requestId = res.getHeader?.('X-Request-ID');
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    return requestId ? { ...meta, requestId } : meta;
  }
  if (requestId) return { ...(meta !== undefined ? { value: meta } : {}), requestId };
  return meta;
}

function envelope(res, data, message, meta) {
  const body = { success: true, data: data === undefined ? null : data };
  if (message !== undefined) body.message = message;
  const finalMeta = responseMeta(res, meta);
  if (finalMeta !== undefined) body.meta = finalMeta;
  return body;
}

export function ok(res, data, message, meta) {
  return res.status(200).json(envelope(res, data, message, meta));
}

export function created(res, data, message) {
  return res.status(201).json(envelope(res, data, message));
}
