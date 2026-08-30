import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';

import Role from '../models/Role.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import { requirePermission } from '../middleware/permissions.js';
import { paginate } from '../utils/paginate.js';
import { passwordSchema } from '../utils/password.js';
import { validateBody } from '../utils/validate.js';

const router = Router();

// Every route here needs a signed-in user; the per-verb permission is declared
// on each one below.
router.use(requireAuth);

// ── Validation ───────────────────────────────────────────────────────────────
// Mirrors userCreateSchema in frontend/src/pages/UsersPage.jsx, message for
// message, so a field the form rejects and a field the server rejects read the
// same. Server-managed fields are absent on purpose — id, roleName, permissions,
// lastLoginAt, createdAt, updatedAt. validateBody parses rather than checks, so
// anything not listed here is stripped before a handler ever sees it; that is
// what makes the mock's READ_ONLY_FIELDS delete-list unnecessary rather than
// merely omitted.
//
// permissions especially: it follows the role. A client that could send its own
// array could grant itself anything (docs/security-notes.md §2).

const userCreateSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter an email address.')
    .email('Must be a valid email address.'),
  // Hashed by User's pre-save hook, so the plaintext never reaches the model
  // layer as anything but an assignment. Create-only — see userUpdateSchema.
  password: passwordSchema,
  firstName: z.string().trim().min(1, 'Enter a first name.').max(100, 'First name is too long.'),
  lastName: z.string().trim().min(1, 'Enter a last name.').max(100, 'Last name is too long.'),
  // Only "present" here. Whether it names a real role is a database question,
  // answered in resolveRole below with the same 'Choose a role.' message.
  roleId: z.string().min(1, 'Choose a role.'),
  status: z.enum(['active', 'invited', 'suspended'], 'Choose a status.'),
});

/**
 * PATCH: same rules, every field optional. Never restate the rules.
 *
 * password is omitted rather than made optional. Leaving it in would let an
 * admin set any user's password without knowing the current one, which is a
 * privilege nobody asked for and a quiet route to taking over an account —
 * changing a password goes through PATCH /api/auth/password, which proves the
 * current one first. An admin-driven reset is a separate feature with its own
 * flow (a one-time link, not a chosen value), and does not exist yet.
 */
const userUpdateSchema = userCreateSchema.omit({ password: true }).partial();

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * roleId is a slug on the wire and an ObjectId in the database, so every write
 * path converts. An unknown slug is a 422 on the roleId field rather than a 404
 * for the whole request: it is the submitted value that is wrong, and the form
 * needs it back on the input that produced it.
 */
async function resolveRole(slug) {
  const role = await Role.findOne({ slug });
  if (!role) throw ApiError.validation({ roleId: 'Choose a role.' });
  return role;
}

/**
 * A cast failure on a malformed :id would otherwise surface as a 500. The
 * resource doesn't exist either way, so it answers the same 404 as a well-formed
 * id that matches nothing.
 */
async function findUserOr404(id) {
  const user = mongoose.isValidObjectId(id) ? await User.findById(id) : null;
  if (!user) throw ApiError.notFound('User not found.');
  return user;
}

/** Email is the login identifier, so it has to be unique. Case-insensitive. */
async function assertEmailFree(email, exceptId = null) {
  const filter = { email: email.toLowerCase() };
  if (exceptId) filter._id = { $ne: exceptId };

  if (await User.exists(filter)) {
    throw ApiError.conflict('That email address is already in use.');
  }
}

/**
 * The unique index is the actual guarantee; assertEmailFree is the check that
 * produces a good message. Between the two lies a race two concurrent creates
 * can win, and Mongo answers that with E11000 — which is the same conflict, so
 * it gets the same 409 rather than a 500.
 */
function asConflictIfDuplicate(err) {
  return err?.code === 11000
    ? ApiError.conflict('That email address is already in use.')
    : err;
}

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/users — collection, so the envelope carries meta.
 *
 * Search covers firstName, lastName and email. The mock also searches roleName,
 * which cannot be done here: roleName is denormalised from the populated role
 * rather than stored on the user, so there is no field for Mongo to match. See
 * the note in the handover summary.
 */
router.get('/', requirePermission('users.view'), async (req, res, next) => {
  try {
    // ?roleId=admin&roleId=staff — repeatable, and slugs, like everywhere else.
    // Module-specific filters are the module's own (api-contract.md §2).
    const slugs = [].concat(req.query.roleId ?? []).filter((s) => typeof s === 'string' && s);

    let baseFilter;
    if (slugs.length) {
      const ids = await Role.find({ slug: { $in: slugs } }).distinct('_id');
      // An unknown slug leaves ids empty, which matches nothing — the honest
      // answer for "users whose role is one that doesn't exist".
      baseFilter = { roleId: { $in: ids } };
    }

    const { data, meta } = await paginate(User, req.query, {
      searchFields: ['firstName', 'lastName', 'email'],
      sortable: ['firstName', 'lastName', 'email', 'status', 'lastLoginAt', 'createdAt'],
      defaultSort: '-createdAt',
      baseFilter,
    });

    // paginate has no populate hook, and User's toJSON reads the role to fill in
    // roleId, roleName and permissions — without this every row comes back with
    // an ObjectId for roleId, a null name and no permissions. Populating the
    // returned page is one extra query for the whole page, not one per row.
    await User.populate(data, { path: 'roleId' });

    res.json({ data, meta });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/users — 201 + Location header.
 *
 * The created document is built field by field rather than by spreading the
 * body: anything the client sent that is not on this list simply never reaches
 * the model, which is mass-assignment protection by construction rather than by
 * deletion.
 */
router.post(
  '/',
  requirePermission('users.create'),
  validateBody(userCreateSchema),
  async (req, res, next) => {
    try {
      const { email, password, firstName, lastName, roleId, status } = req.body;

      // Role before email, so a body with both an unknown role and a taken
      // address answers the 422 rather than the 409 — a malformed field beats a
      // state conflict, and the form has somewhere to put the message. Matches
      // the mock, which validates the whole body before testing for duplicates.
      const role = await resolveRole(roleId);
      await assertEmailFree(email);

      const user = await User.create({
        email,
        // Assigned in plaintext and hashed by the model's pre-save hook, which
        // create() runs. An insertMany or updateOne here would store it as
        // typed. It never comes back out: password is select:false and toJSON
        // deletes it regardless.
        password,
        firstName,
        lastName,
        avatarUrl: null,
        roleId: role._id,
        status,
        lastLoginAt: null,
      });

      // toJSON reads the role for roleId, roleName and permissions.
      await user.populate('roleId');

      res
        .status(201)
        .location(`/api/users/${user.id}`)
        .json({ data: user });
    } catch (err) {
      next(asConflictIfDuplicate(err));
    }
  },
);

/** PATCH /api/users/:id — partial update, 200 with the updated resource. */
router.patch(
  '/:id',
  requirePermission('users.edit'),
  validateBody(userUpdateSchema),
  async (req, res, next) => {
    try {
      const user = await findUserOr404(req.params.id);
      const { email, firstName, lastName, roleId, status } = req.body;

      // Resolved up here rather than at the assignment below so that an unknown
      // role is a 422 before a taken email can be a 409 — the same precedence as
      // POST and as the mock, which validates the whole body before testing for
      // duplicates.
      const role = roleId !== undefined ? await resolveRole(roleId) : null;

      if (email !== undefined) {
        await assertEmailFree(email, user._id);
        user.email = email; // the model lowercases on save
      }
      if (firstName !== undefined) user.firstName = firstName;
      if (lastName !== undefined) user.lastName = lastName;
      if (status !== undefined) user.status = status;

      // roleName and permissions follow the role and are never taken from the
      // body — the schema has no field for either, so there is nothing to strip.
      if (role) user.roleId = role._id;

      // password is unmodified, so the pre-save hook won't re-hash the hash.
      await user.save();
      await user.populate('roleId');

      res.json({ data: user });
    } catch (err) {
      next(asConflictIfDuplicate(err));
    }
  },
);

/**
 * DELETE /api/users/:id — 204, no body.
 *
 * Refuses to delete the account making the request. This is not a hypothetical:
 * it is one click in an admin list, and the result is an admin who can no longer
 * sign in to undo it. 409 rather than 403 — the caller is allowed to delete
 * users, this particular target conflicts with the session making the request.
 *
 * TODO(A): the related rule — refusing to delete or demote the last remaining
 * admin — is a different check and is not implemented here, matching the mock.
 */
router.delete('/:id', requirePermission('users.delete'), async (req, res, next) => {
  try {
    const user = await findUserOr404(req.params.id);

    if (user._id.equals(req.user._id)) {
      throw ApiError.conflict('You cannot delete the account you are signed in as.');
    }

    await user.deleteOne();

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
