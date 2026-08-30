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

import { delay, validationError } from './helpers';

const BASE = '/api/auth';

/**
 * The password strength rule, mirroring backend/src/utils/password.js: a
 * minimum length and a blocklist, no composition requirements (NIST SP 800-63B
 * §5.1.1.2 advises against them — they produce Password1! and rule out the long
 * passphrases that are actually stronger).
 *
 * Exported because POST /api/users applies the same rule when an admin sets
 * someone's initial password. Passwords are this file's business — it is the
 * only place in the frontend that knows one — so the rule lives here rather
 * than being written out a second time in the users handlers.
 *
 * The blocklist is a short excerpt of the backend's. Mock-land does not need
 * the whole thing; it needs enough to demonstrate the rejection.
 *
 * @param {unknown} value
 * @returns {string|null} the message, or null when the password is acceptable
 */
export function passwordIssue(value) {
  const password = String(value ?? '');

  if (password.length < 8) return 'Use at least 8 characters.';

  const COMMON = [
    'password',
    'password1',
    'password123',
    'passw0rd',
    '12345678',
    '123456789',
    'qwerty123',
    'iloveyou',
    'admin123',
    'welcome1',
    'changeme',
  ];

  return COMMON.includes(password.toLowerCase())
    ? 'That password is too common. Choose something less guessable.'
    : null;
}

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

/**
 * ── Keeping this file's accounts in step with the users handlers ─────────────
 *
 * Mock-land has two arrays: the one below, which knows passwords and answers
 * login, and the one in userHandlers, which answers the Users page. The real
 * backend has a single users collection, so anything that changes an account
 * there has to change it in both here.
 *
 * Without these, "create a user, then sign in as them" — the demo path —
 * worked only against the real backend, because a user created through
 * POST /api/users existed in the other array and had no password anywhere.
 *
 * The three below are called by userHandlers after each write. They are
 * deliberately narrow: this file owns passwords, so the password is the one
 * field it keeps for itself and never accepts from the caller.
 */

/** After POST /api/users — the new account can now sign in. */
export function registerMockAccount(user, password) {
  users.push({ ...user, password });
}

/**
 * After PATCH /api/users/:id. Without this a renamed email would still sign in
 * under the old address, and /me would answer with stale permissions.
 */
export function syncMockAccount(user) {
  const index = users.findIndex((candidate) => candidate.id === user.id);
  if (index === -1) return; // a seeded user this file never registered

  // The password is this file's business and is not on the record the users
  // handlers hold, so it is carried across rather than taken from the caller.
  users[index] = { ...user, password: users[index].password };
}

/** After DELETE /api/users/:id — a deleted account must stop signing in. */
export function forgetMockAccount(id) {
  const index = users.findIndex((candidate) => candidate.id === id);
  if (index !== -1) users.splice(index, 1);
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

    // One message for all three failures — no such email, wrong password, and
    // an account that is not active. Telling them apart hands an attacker a
    // list of valid accounts — docs/security-notes.md §4.
    //
    // The status check matches the real backend, which refuses anything that is
    // not active. It matters now that accounts can be created here: without it
    // an invited account would sign in against the mock and be refused by the
    // server, which is the worst way to find out.
    if (!user || user.status !== 'active') {
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

  /**
   * PATCH /api/auth/password — changes the signed-in user's own password.
   *
   * The target is always the token's own user; there is no id in the path or
   * the body, so no version of this request touches another account.
   *
   * Unlike login and /me above, the failures here use the backend's
   * `{ error: { code, message } }` envelope rather than this file's older flat
   * `{ message }`. That is deliberate — new handlers match the real server, and
   * apiClient reads both, so the two styles coexist until the older pair is
   * brought across.
   */
  http.patch(`${BASE}/password`, async ({ request }) => {
    await delay();

    const user = userFromRequest(request);
    if (!user) {
      return HttpResponse.json(
        {
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication is required.',
          },
        },
        { status: 401 },
      );
    }

    const { currentPassword, newPassword } = await request.json();

    // Shape first, so an empty box is a field error rather than a failed
    // comparison reported as a wrong password.
    const fields = {};
    if (!String(currentPassword ?? '')) {
      fields.currentPassword = 'Enter your current password.';
    }
    const issue = passwordIssue(newPassword);
    if (issue) fields.newPassword = issue;
    if (Object.keys(fields).length > 0) return validationError(fields);

    // 401 rather than a field error, matching the backend. Plaintext compare,
    // like everything else in this file, and for the same reason.
    if (user.password !== currentPassword) {
      return HttpResponse.json(
        {
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Current password is incorrect.',
          },
        },
        { status: 401 },
      );
    }

    // Mutated in place, so the old password stops working and the new one
    // starts, for as long as the page stays loaded — same lifetime as every
    // other write in mock-land.
    user.password = newPassword;
    user.updatedAt = new Date().toISOString();

    return HttpResponse.json({ data: publicUser(user) });
  }),
];
