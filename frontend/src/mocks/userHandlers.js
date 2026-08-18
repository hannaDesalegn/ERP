/**
 * Users + roles handlers and seed data — owned by A.
 *
 * Five endpoints from docs/api-contract.md §4 (A — Foundation): the four user
 * verbs, plus GET /api/roles, which exists here because the user form's role
 * select has to be populated from somewhere real. Roles moves to its own file
 * when POST/PATCH /roles land; one read does not justify a second file today.
 *
 * Fields follow the User and Role typedefs in docs/entities.md exactly. Nothing
 * is invented and nothing is left out.
 *
 * Every record is fake. docs/security-notes.md § Fake data only.
 */

import { http, HttpResponse } from 'msw';

import { ROLE_PERMISSIONS, userIdFromRequest } from './authHandlers';
import {
  conflict,
  delay,
  forbidden,
  notFound,
  paginate,
  serverError,
  validationError,
} from './helpers';

const BASE = '/api/users';

/**
 * The role catalogue. `permissions` comes from authHandlers so the roles an
 * admin can assign and the permissions login actually grants stay one list.
 *
 * `isSystem` is true only for admin: it is the role that can administer users,
 * so it is the one a future DELETE /roles/:id must refuse to remove.
 */
const roles = [
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Full access, including users and settings.',
    permissions: ROLE_PERMISSIONS.admin,
    isSystem: true,
  },
  {
    id: 'manager',
    name: 'Manager',
    description: 'Customers and reports. No user administration.',
    permissions: ROLE_PERMISSIONS.manager,
    isSystem: false,
  },
  {
    id: 'staff',
    name: 'Staff',
    description: 'Read-only access to customers.',
    permissions: ROLE_PERMISSIONS.staff,
    isSystem: false,
  },
];

function roleById(roleId) {
  return roles.find((role) => role.id === roleId) ?? null;
}

/**
 * id, email, firstName, lastName, roleId, status, lastLoginAt
 *
 * The first three are the accounts in authHandlers — same ids, same emails, on
 * purpose. The signed-in admin has to appear in this list for "you cannot
 * delete yourself" to be reachable at all. The real backend has one users
 * table; mock-land has two arrays that must agree about these three rows, which
 * is the cost of keeping the auth mock self-contained.
 *
 * The other five are invented, on the @example-erp.test domain.
 */
const SEED = [
  [
    'usr_0001',
    'admin@zion.test',
    'Meron',
    'Alemu',
    'admin',
    'active',
    '2026-08-18T07:55:00Z',
  ],
  [
    'usr_0002',
    'manager@zion.test',
    'Dawit',
    'Bekele',
    'manager',
    'active',
    '2026-08-17T16:40:00Z',
  ],
  [
    'usr_0003',
    'staff@zion.test',
    'Sara',
    'Girma',
    'staff',
    'active',
    '2026-08-18T06:20:00Z',
  ],
  [
    'usr_0004',
    'hanna.tesfaye@example-erp.test',
    'Hanna',
    'Tesfaye',
    'manager',
    'active',
    '2026-08-15T09:05:00Z',
  ],
  [
    'usr_0005',
    'yonas.kebede@example-erp.test',
    'Yonas',
    'Kebede',
    'staff',
    'invited',
    null,
  ],
  [
    'usr_0006',
    'liya.mekonnen@example-erp.test',
    'Liya',
    'Mekonnen',
    'staff',
    'active',
    '2026-08-14T11:30:00Z',
  ],
  [
    'usr_0007',
    'bereket.assefa@example-erp.test',
    'Bereket',
    'Assefa',
    'manager',
    'suspended',
    '2026-06-02T13:10:00Z',
  ],
  [
    'usr_0008',
    'tsion.abebe@example-erp.test',
    'Tsion',
    'Abebe',
    'staff',
    'invited',
    null,
  ],
];

/** Deterministic — no randomness, so tests and snapshots stay stable. */
function makeUser(seed, index) {
  const [id, email, firstName, lastName, roleId, status, lastLoginAt] = seed;
  const role = roleById(roleId);

  return {
    id,
    email,
    firstName,
    lastName,
    avatarUrl: null,
    roleId,
    roleName: role.name, // denormalised for display
    // From the role, never per user. A user-level permission array would be a
    // second source of truth for what someone may do.
    permissions: role.permissions,
    status,
    lastLoginAt,
    // Spread across the year so sorting and date filters have something to bite.
    createdAt: `2026-${String((index % 6) + 1).padStart(2, '0')}-12T08:00:00Z`,
    updatedAt: `2026-08-${String((index % 27) + 1).padStart(2, '0')}T10:15:00Z`,
  };
}

/** Mutable on purpose — the handlers push and splice it, like the other mocks. */
const users = SEED.map(makeUser);

function nextUserNumber() {
  return String(users.length + 1).padStart(4, '0');
}

const STATUSES = ['active', 'invited', 'suspended'];

/** Server-managed fields a client must never set or change. */
const READ_ONLY_FIELDS = [
  'id',
  'roleName',
  'permissions',
  'lastLoginAt',
  'createdAt',
  'updatedAt',
];

/** Mirror of the Zod schema on the page. The server owns the real rules. */
function validate(body, { partial = false } = {}) {
  const fields = {};
  const has = (key) => body[key] !== undefined;

  if (
    (!partial || has('email')) &&
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(body.email ?? ''))
  ) {
    fields.email = 'Must be a valid email address.';
  }
  if ((!partial || has('firstName')) && !String(body.firstName ?? '').trim()) {
    fields.firstName = 'Enter a first name.';
  }
  if ((!partial || has('lastName')) && !String(body.lastName ?? '').trim()) {
    fields.lastName = 'Enter a last name.';
  }
  if ((!partial || has('roleId')) && !roleById(body.roleId)) {
    fields.roleId = 'Choose a role.';
  }
  if ((!partial || has('status')) && !STATUSES.includes(body.status)) {
    fields.status = 'Choose a status.';
  }

  return Object.keys(fields).length > 0 ? fields : null;
}

/** Email is the login identifier, so it has to be unique. Case-insensitive. */
function emailTaken(email, exceptId = null) {
  const wanted = String(email ?? '')
    .trim()
    .toLowerCase();
  return users.some(
    (user) => user.id !== exceptId && user.email.toLowerCase() === wanted,
  );
}

export const userHandlers = [
  // ── Deliberate failures, for testing error states ──────────────────────────
  // Declared first so the :id routes below don't swallow them.

  http.get(`${BASE}/demo-server-error`, async () => {
    await delay();
    return serverError('Could not load users. Try again.');
  }),

  http.get(`${BASE}/demo-forbidden`, async () => {
    await delay();
    return forbidden('You do not have permission to manage users.');
  }),

  http.post(`${BASE}/demo-validation-error`, async () => {
    await delay();
    return validationError({
      email: 'Must be a valid email address.',
      roleId: 'Choose a role.',
    });
  }),

  // ── The four verbs ─────────────────────────────────────────────────────────

  /** GET /api/users — collection, so the envelope carries meta. */
  http.get(BASE, async ({ request }) => {
    await delay();
    const url = new URL(request.url);
    return HttpResponse.json(
      paginate(users, url, {
        searchFields: ['firstName', 'lastName', 'email', 'roleName'],
        filterKeys: ['status', 'roleId'],
      }),
    );
  }),

  /** POST /api/users — 201 + Location header. */
  http.post(BASE, async ({ request }) => {
    await delay();
    const body = await request.json();

    const fields = validate(body);
    if (fields) return validationError(fields);
    if (emailTaken(body.email)) {
      return conflict('That email address is already in use.');
    }

    const role = roleById(body.roleId);
    const now = new Date().toISOString();

    // Built field by field rather than spreading the body: anything the client
    // sent that is not on this list simply does not exist here, which is
    // mass-assignment protection by construction rather than by deletion.
    const created = {
      id: `usr_${nextUserNumber()}`,
      email: String(body.email).trim().toLowerCase(),
      firstName: String(body.firstName).trim(),
      lastName: String(body.lastName).trim(),
      avatarUrl: null,
      roleId: body.roleId,
      roleName: role.name,
      permissions: role.permissions,
      status: body.status,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };

    users.push(created);

    return HttpResponse.json(
      { data: created },
      { status: 201, headers: { Location: `${BASE}/${created.id}` } },
    );
  }),

  /** PATCH /api/users/:id — partial update, 200 with the updated resource. */
  http.patch(`${BASE}/:id`, async ({ params, request }) => {
    await delay();
    const index = users.findIndex((user) => user.id === params.id);
    if (index === -1) return notFound('User');

    const body = await request.json();

    const fields = validate(body, { partial: true });
    if (fields) return validationError(fields);
    if (body.email !== undefined && emailTaken(body.email, params.id)) {
      return conflict('That email address is already in use.');
    }

    const patch = { ...body };
    READ_ONLY_FIELDS.forEach((field) => delete patch[field]);

    // roleName and permissions follow the role; they are never taken from the
    // body. A client that could send its own permissions array could grant
    // itself anything — docs/security-notes.md §2.
    if (patch.roleId) {
      const role = roleById(patch.roleId);
      patch.roleName = role.name;
      patch.permissions = role.permissions;
    }
    if (patch.email) patch.email = String(patch.email).trim().toLowerCase();

    users[index] = {
      ...users[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json({ data: users[index] });
  }),

  /**
   * DELETE /api/users/:id — 204, no body.
   *
   * Refuses to delete the account making the request. This is not a
   * hypothetical: it is one click in an admin list, and the result is an admin
   * who can no longer sign in to undo it. 409 rather than 403 — the caller is
   * allowed to delete users, this particular target conflicts with the session
   * making the request.
   *
   * TODO(A): the related rule — refusing to delete or demote the last remaining
   * admin — is a different check and is not implemented here.
   */
  http.delete(`${BASE}/:id`, async ({ params, request }) => {
    await delay();
    const index = users.findIndex((user) => user.id === params.id);
    if (index === -1) return notFound('User');

    if (params.id === userIdFromRequest(request)) {
      return conflict('You cannot delete the account you are signed in as.');
    }

    users.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];

export const roleHandlers = [
  /** GET /api/roles — the full catalogue. A collection, so it carries meta. */
  http.get('/api/roles', async ({ request }) => {
    await delay();
    return HttpResponse.json(paginate(roles, new URL(request.url)));
  }),
];
