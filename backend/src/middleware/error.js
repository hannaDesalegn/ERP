// The error contract from docs/api-contract.md §1. Every failure leaves this API
// as { error: { code, message } }, with fields only on VALIDATION_FAILED.

const STATUS_BY_CODE = {
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  SERVER_ERROR: 500,
};

export class ApiError extends Error {
  constructor(code, message, fields) {
    super(message);
    this.name = 'ApiError';
    // An unknown code is a bug on our side, not a client error.
    this.code = STATUS_BY_CODE[code] ? code : 'SERVER_ERROR';
    this.status = STATUS_BY_CODE[this.code];
    this.fields = fields;
  }

  static validation(fields, message = 'The submitted data is invalid.') {
    return new ApiError('VALIDATION_FAILED', message, fields);
  }

  static unauthenticated(message = 'Authentication is required.') {
    return new ApiError('UNAUTHENTICATED', message);
  }

  static forbidden(message = 'You do not have permission to do that.') {
    return new ApiError('FORBIDDEN', message);
  }

  static notFound(message = 'Not found.') {
    return new ApiError('NOT_FOUND', message);
  }

  static conflict(message = 'That conflicts with the current state.') {
    return new ApiError('CONFLICT', message);
  }

  static rateLimited(message = 'Too many requests. Try again shortly.') {
    return new ApiError('RATE_LIMITED', message);
  }
}

// Anything no route matched. Without this Express replies with an HTML page,
// which breaks the envelope the frontend parses.
export function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`No route for ${req.method} ${req.originalUrl}.`));
}

// The one error handler. Stays last in app.js. Express needs all four params
// to recognise it as error middleware, so `next` is declared but unused.
export function errorHandler(err, req, res, next) {
  const known = err instanceof ApiError;

  // Unexpected: log the real thing for us, tell the client nothing useful.
  // No stack traces, no library names, no Mongo messages.
  if (!known) console.error(err);

  const body = {
    error: {
      code: known ? err.code : 'SERVER_ERROR',
      message: known ? err.message : 'Something went wrong.',
    },
  };

  if (known && err.code === 'VALIDATION_FAILED' && err.fields) {
    body.error.fields = err.fields;
  }

  res.status(known ? err.status : 500).json(body);
}
