import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import User, { BCRYPT_ROUNDS } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import { validateBody } from '../utils/validate.js';

const router = Router();

// backend-plan.md §4: one 24h access token, no refresh rotation yet.
const TOKEN_TTL = '24h';

/**
 * Nothing matches this hash. When the email is unknown we compare against it
 * anyway, so a wrong email costs the same as a wrong password — otherwise the
 * response time alone tells an attacker which accounts exist
 * (security-notes.md §4). It has to use the same cost factor as a real user's
 * hash or the gap reopens.
 */
const NO_SUCH_USER_HASH = await bcrypt.hash('no-such-user', BCRYPT_ROUNDS);

// Deliberately only "not empty". Validating the email's shape here would answer
// a malformed address with a 422 and a real one with a 401 — a different reply
// for a different reason, which is the thing this endpoint is avoiding.
//
// The `error` option covers a missing or non-string field; .min(1) covers an
// empty one. Without the first, an absent field reports Zod's own wording,
// which the login form would put straight in front of a user.
const loginSchema = z.object({
  email: z
    .string({ error: 'Enter your email address.' })
    .trim()
    .min(1, 'Enter your email address.'),
  password: z
    .string({ error: 'Enter your password.' })
    .min(1, 'Enter your password.'),
});

router.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    // The schema lowercases nothing and neither does a query — only saved
    // documents get the model's lowercase:true.
    const email = req.body.email.toLowerCase();
    const { password } = req.body;

    // +password: the hash is select:false. The role is deliberately NOT
    // populated yet — that is a second round-trip, and one that only happens
    // when the email exists. Measured, it made a real account fail ~180ms
    // slower than an unknown one, which is the timing oracle the matching 401s
    // are there to prevent. It is populated after the decision instead.
    const user = await User.findOne({ email }).select('+password');

    const passwordOk = user
      ? await user.checkPassword(password)
      : await bcrypt.compare(password, NO_SUCH_USER_HASH);

    // One reply for all three failures — no such account, wrong password,
    // account not active. Which one it was is not the caller's business.
    if (!user || !passwordOk || user.status !== 'active') {
      throw ApiError.unauthenticated('Invalid email or password.');
    }

    // Past this point the caller has proved who they are, so the extra work
    // below reveals nothing. toJSON reads the role to fill in roleName and
    // permissions, and returns empty ones without it.
    await user.populate('roleId');

    user.lastLoginAt = new Date();
    await user.save(); // password is unmodified, so the hook won't re-hash it

    // Claims stay out of the token: requireAuth reloads the user every request,
    // so a copy of the role here would only be a copy that can go stale.
    const accessToken = jwt.sign({}, process.env.JWT_SECRET, {
      subject: user.id,
      expiresIn: TOKEN_TTL,
    });

    res.json({ data: { user, accessToken } });
  } catch (err) {
    next(err);
  }
});

// requireAuth has already loaded and populated the user, so there is nothing
// left to do but envelope it.
router.get('/me', requireAuth, (req, res) => {
  res.json({ data: req.user });
});

export default router;
