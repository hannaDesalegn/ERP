import { ApiError } from './error.js';

// requirePermission('customers.view') — mount after requireAuth.
// Deny by default: missing user, missing role, missing array all end in 403.
//
// This is route-level only. Object-level checks ("may this user see *this*
// customer?") belong in the handler, and per api-contract.md §1 they answer 404
// rather than 403 wherever the record's existence is itself sensitive.
export function requirePermission(permission) {
  return function checkPermission(req, res, next) {
    if (!req.user) {
      return next(ApiError.unauthenticated('Authentication is required.'));
    }

    // requireAuth populates roleId, so this is the Role document.
    const granted = req.user.roleId?.permissions ?? [];

    if (!granted.includes(permission)) {
      return next(ApiError.forbidden(`Requires the "${permission}" permission.`));
    }

    next();
  };
}
