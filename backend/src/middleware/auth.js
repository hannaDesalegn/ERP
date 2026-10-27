import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { ApiError } from './error.js';

// Verifies the Bearer access token and puts the live user on req.user.
// Every failure is the same 401 — which step failed is not the client's business.
export async function requireAuth(req, res, next) {
  try {
    const [scheme, token] = (req.get('authorization') || '').split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw ApiError.unauthenticated('Missing or malformed Authorization header.');
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      throw ApiError.unauthenticated('Token is invalid or has expired.');
    }

    // Loaded fresh every request, so a suspended account or a changed role takes
    // effect now rather than up to 24 hours later when the token expires.
    // Role is populated here so permissions.js can use it.
    const user = await User.findById(payload.sub).populate('roleId');

    if (!user || user.status !== 'active') {
      throw ApiError.unauthenticated('Account is not active.');
    }

    // A token issued before the last password change is no longer valid.
    // Tokens minted before this field existed carry no `ver`; they count as 0,
    // which matches every account that has not changed its password since.
    if ((payload.ver ?? 0) !== (user.tokenVersion ?? 0)) {
      throw ApiError.unauthenticated('Token is invalid or has expired.');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
