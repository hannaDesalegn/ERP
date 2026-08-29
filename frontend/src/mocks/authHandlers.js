/**
 * Auth handlers + seed users — owned by A.
 *
 * This is the mock stand-in for the auth service. It is the only place in the
 * frontend that knows a password, and it is deliberately dumb: plaintext
 * comparison, no hashing, no expiry, no refresh rotation. Nothing here is a
 * security control — it exists so the real login flow can be built and tested
 * before the backend does. See docs/security-notes.md § Token handling.
 *
 * Success responses use the same `{ data }` envelope as the real backend —
 * `{ data: { user, accessToken } }` from login, `{ data: user }` from /me, per
 * docs/api-contract.md §3. They did not always: auth was flat once, and
 * AuthContext had to unwrap one shape or the other. Both paths answering
 * identically is what lets the frontend run on mocks or on the backend without
 * a line changing.
 *
 * Errors are still flat `{ message }` where the backend sends
 * `{ error: { code, message } }`. apiClient reads both, so this is a remaining
 * difference rather than a break.
 */

import { http, HttpResponse } from 'msw';

import { delay } from './helpers';

const BASE = '/api/auth';

/**
 * The full permission catalogue from docs/entities.md § Permission strings.
 * Admin holds all of it; the other roles hold a named subset below.
 */
const ALL_PERMISSIONS = [
  'dashboard.view',
  'customers.view',
  'customers.create',
  'customers.edit',
  'customers.delete',
  'orders.view',
  'orders.create',
  'orders.edit',
  'orders.delete',
  'orders.approve',
  'invoices.view',
  'invoices.create',
  'invoices.edit',
  'invoices.void',
  'products.view',
  'products.create',
  'products.edit',
  'products.delete',
  'products.adjust_stock',
  'suppliers.view',
  'suppliers.create',
  'suppliers.edit',
  'suppliers.delete',
  'purchasing.view',
  'purchasing.create',
  'purchasing.edit',
  'purchasing.approve',
  'purchasing.receive',
  'reports.view',
  'users.view',
  'users.create',
  'users.edit',
  'users.delete',
  'settings.view',
  'settings.edit',
];

/**
 * Role → permissions. The server is the authority on this mapping; the client
 * only ever receives the resulting array on the user.
 *
 * Exported because GET /api/roles serves this same catalogue: the roles an
 * admin can assign and the permissions login actually grants have to be one
 * list, not two that drift the first time someone edits only one of them.
 *
 * Manager and staff get customers and reports but no orders, invoices,
 * products, suppliers or purchasing — those modules were not in the agreed
 * permission brief. Add them here when the brief says so; the sidebar and every
 * <Can> follow automatically.
 */
export const ROLE_PERMISSIONS = {
  admin: ALL_PERMISSIONS,
  manager: [
    'dashboard.view',
    'customers.view',
    'customers.create',
    'customers.edit',
    'customers.delete',
    'reports.view',
  ],
  staff: ['dashboard.view', 'customers.view'],
};

/**
 * Seed accounts. `roleId` is the role slug — <RequireRole roles={['admin']}>
 * matches on it — and `roleName` is the label the UI shows. Both fields are
 * from the User shape in docs/entities.md; no new field was added for the role.
 *
 * `password` is stripped before any response leaves this file.
 */
const users = [
  {
    id: 'usr_0001',
    email: 'admin@zion.test',
    password: 'admin123',
    firstName: 'Meron',
    lastName: 'Alemu',
    avatarUrl: null,
    roleId: 'admin',
    roleName: 'Administrator',
    permissions: ROLE_PERMISSIONS.admin,
    status: 'active',
    lastLoginAt: null,
    createdAt: '2026-01-06T08:00:00Z',
    updatedAt: '2026-01-06T08:00:00Z',
  },
  {
    id: 'usr_0002',
    email: 'manager@zion.test',
    password: 'manager123',
    firstName: 'Dawit',
    lastName: 'Bekele',
    avatarUrl: null,
    roleId: 'manager',
    roleName: 'Manager',
    permissions: ROLE_PERMISSIONS.manager,
    status: 'active',
    lastLoginAt: null,
    createdAt: '2026-01-06T08:00:00Z',
    updatedAt: '2026-01-06T08:00:00Z',
  },
  {
    id: 'usr_0003',
    email: 'staff@zion.test',
    password: 'staff123',
    firstName: 'Sara',
    lastName: 'Girma',
    avatarUrl: null,
    roleId: 'staff',
    roleName: 'Staff',
    permissions: ROLE_PERMISSIONS.staff,
    status: 'active',
    lastLoginAt: null,
    createdAt: '2026-01-06T08:00:00Z',
    updatedAt: '2026-01-06T08:00:00Z',
  },
];

/** Everything except the password. The password never crosses the wire. */
function publicUser({ password: _password, ...rest }) {
  return rest;
}

/** The mock token is just the user id in a wrapper — it proves nothing. */
const TOKEN_PREFIX = 'mock-token-';

function tokenFor(user) {
  return `${TOKEN_PREFIX}${user.id}`;
}

/**
 * The id of the user a request is signed in as, or null.
 *
 * Exported for the users handlers, which must refuse to delete the caller's own
 * account. How a token maps back to a user is this file's business — a second
 * file parsing the same string format is how the two stop agreeing.
 *
 * @param {Request} request
 * @returns {string|null}
 */
export function userIdFromRequest(request) {
  const header = request.headers.get('Authorization') ?? '';
  if (!header.startsWith('Bearer ')) return null;

  const token = header.slice('Bearer '.length);
  return token.startsWith(TOKEN_PREFIX)
    ? token.slice(TOKEN_PREFIX.length)
    : null;
}

/**
 * Resolve `Authorization: Bearer <token>` back to a user, or null.
 *
 * A real server verifies a signature and an expiry here. This one does a string
 * comparison, which is exactly why it must never ship.
 */
function userFromRequest(request) {
  const id = userIdFromRequest(request);
  return users.find((user) => user.id === id) ?? null;
}

export const authHandlers = [
  http.post(`${BASE}/login`, async ({ request }) => {
    await delay();

    const { email, password } = await request.json();

    // Email is matched case-insensitively; the password is not.
    const user = users.find(
      (candidate) =>
        candidate.email ===
          String(email ?? '')
            .trim()
            .toLowerCase() && candidate.password === password,
    );

    // One message for both "no such email" and "wrong password". Telling them
    // apart hands an attacker a list of valid accounts —
    // docs/security-notes.md §4.
    if (!user) {
      return HttpResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 },
      );
    }

    // The real server stamps this; the mock keeps it truthful for the session.
    user.lastLoginAt = new Date().toISOString();

    return HttpResponse.json({
      data: { user: publicUser(user), accessToken: tokenFor(user) },
    });
  }),

  http.get(`${BASE}/me`, async ({ request }) => {
    await delay();

    const user = userFromRequest(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'Your session has ended. Sign in again.' },
        { status: 401 },
      );
    }

    return HttpResponse.json({ data: publicUser(user) });
  }),

  // 204 even without a valid token: logging out is never an error, and a
  // failure here would strand a user with a token they cannot clear.
  http.post(`${BASE}/logout`, async () => {
    await delay(100);
    return new HttpResponse(null, { status: 204 });
  }),
];
