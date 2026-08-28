import { ApiError } from '../middleware/error.js';

// validateBody(schema) — parses req.body and replaces it with the result.
// Parsing rather than only checking is the point: Zod strips unknown keys, so a
// client can't smuggle roleId or a server-managed field through a create/patch.
export function validateBody(schema) {
  return function validate(req, res, next) {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return next(ApiError.validation(toFields(result.error)));
    }

    req.body = result.data;
    next();
  };
}

// Zod issues -> { "email": "Must be a valid email address." }, which React Hook
// Form's setError() consumes directly. Nested paths become "lines.0.quantity".
// First issue per field wins — the form shows one message per input.
function toFields(error) {
  const fields = {};

  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!(key in fields)) fields[key] = issue.message;
  }

  return fields;
}
