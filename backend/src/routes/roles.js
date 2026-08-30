import { Router } from 'express';

import Role from '../models/Role.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { paginate } from '../utils/paginate.js';

const router = Router();

/**
 * entities.md § Role on the wire, where `id` is the **slug** and not the
 * ObjectId.
 *
 * This is the whole reason this file has a serialiser instead of leaning on
 * Role's toJSON. User.roleId already serialises as the slug, and the Users page
 * feeds role.id straight into the role select as its option value — so the
 * dropdown only preselects the user's current role, and only sends back
 * something PATCH recognises, if both sides speak slugs. Emitting the ObjectId
 * here would leave every user's role looking unset in a form that otherwise
 * looks fine, which is a bug that shows up in the UI rather than in a test.
 *
 * The ObjectId stays server-side, which also means renaming or re-seeding a
 * role never changes its public identifier.
 */
function toRoleResource(role) {
  return {
    id: role.slug,
    name: role.name,
    description: role.description,
    permissions: role.permissions,
    isSystem: role.isSystem,
  };
}

/**
 * GET /api/roles — the full catalogue.
 *
 * Gated on users.view rather than a roles.* permission because this endpoint
 * exists to populate the Users page's role select; there is no roles screen and
 * no roles.view permission in entities.md § Permission strings. Whoever may
 * list users may read the roles they can be assigned.
 *
 * A collection, so it carries meta even though the catalogue is three rows and
 * fits on any page — the envelope is the same everywhere (api-contract.md §1).
 */
router.get('/', requireAuth, requirePermission('users.view'), async (req, res, next) => {
  try {
    // Sorted by name rather than -createdAt: this is a menu, and seed order is
    // not a meaningful order to show a human.
    const { data, meta } = await paginate(Role, req.query, {
      searchFields: ['name', 'slug', 'description'],
      sortable: ['name', 'slug', 'createdAt'],
      defaultSort: 'name',
    });

    res.json({ data: data.map(toRoleResource), meta });
  } catch (err) {
    next(err);
  }
});

export default router;
