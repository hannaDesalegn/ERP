# ERP — Frontend

Internal ERP web application. Desktop-first, login-only, single-page app.
Backend is planned but not yet built; the frontend runs against a mock API layer
that mirrors the real contract exactly (see `docs/api-contract.md`).

---

## 1. Stack

| Concern | Choice | Why |
|---|---|---|
| Language | JavaScript (ES2022) + JSDoc | Team decision. JSDoc typedefs give editor autocomplete without a TS build step. |
| Framework | React 18 | Team already knows it. |
| Build | Vite 5 | Fast dev server, simple env handling. |
| Routing | React Router v6 | Nested layouts, protected routes. |
| Styling | Tailwind CSS 3 | No separate CSS files to fight over. |
| Components | shadcn/ui (Radix) | Copied into the repo, not installed — fewer npm dependencies, full control, keyboard + screen-reader behaviour included. |
| Server state | TanStack Query v5 | Caching, loading/error states. Makes the backend swap near-free. |
| Forms | React Hook Form + Zod | Zod schemas get handed to the backend team so validation matches. |
| Mock API | MSW (Mock Service Worker) | Intercepts at the network layer — real `fetch`, real 401s, real pagination. |
| Icons | lucide-react | Ships with shadcn. |
| Tests | Vitest + Testing Library | Only for the shared kit and auth logic. |
| Quality | ESLint, Prettier, Husky + lint-staged | No unformatted commits, no whitespace diffs. |

**No external third-party APIs.** ERP data is internal by definition — customers,
stock, orders. Nothing useful comes from outside. The only "API" in this project
is our own contract.

---

## 2. Getting started

```bash
npm install
npm run dev          # http://localhost:5173
npm run lint
npm run format
npm run test
```

Copy `.env.example` to `.env`. Note that **anything prefixed `VITE_` is compiled
into the public bundle and visible to any user.** Never put a secret there.

Demo login while MSW is active:

```
admin@example-erp.test / Password123!     (all permissions)
sales@example-erp.test / Password123!     (commercial modules only)
ops@example-erp.test   / Password123!     (operations modules only)
```

---

## 3. Folder structure and ownership

Each person writes **only** inside their own folders. This is the single rule
that keeps three people out of each other's diffs.

```
src/
  app/
    router.jsx            ← A   route tree, assembled from module registries
    registry.js           ← A   imports each module's routes + nav entries
    providers.jsx         ← A   QueryClient, Router, Toaster, ErrorBoundary
  components/ui/          ← A   the shared kit — DO NOT EDIT, request changes
  layouts/                ← A   AppShell, AuthLayout
  lib/
    apiClient.js          ← A   fetch wrapper, auth header, 401 refresh
    auth/                 ← A   AuthProvider, useAuth, ProtectedRoute, <Can>
    format.js             ← A   money, date, number formatting
  mocks/
    browser.js            ← A   MSW worker setup
    handlers.js           ← A   collects handlers from each module
  styles/                 ← A   tokens.css, tailwind entry, print.css

  modules/
    customers/            ← B   pages, components, mock data, schema, handlers
    orders/               ← B
    invoices/             ← B
    products/             ← C
    suppliers/            ← C
    purchasing/           ← C

  pages/                  ← A   Dashboard, Settings, Users, Login, 404, 403

docs/                     ← shared, changes require all three to agree
```

Every module folder is self-contained:

```
modules/customers/
  index.js            exports customerRoutes + customerNav + customerHandlers
  pages/              CustomerListPage.jsx, CustomerDetailPage.jsx, CustomerFormPage.jsx
  components/         CustomerTable.jsx, CustomerStatusBadge.jsx
  schema.js           Zod schemas for create/update
  mock.js             this module's fake records
  handlers.js         this module's MSW handlers
  api.js              this module's fetch functions + query keys
```

### Registry pattern

`src/app/registry.js` is the only file more than one person's work touches, and
it is touched exactly once per module, at the start:

```js
// modules/customers/index.js      ← B owns this file entirely
export const customerNav    = { label: 'Customers', icon: Users, path: '/customers', permission: 'customers.view' };
export const customerRoutes = [ /* ... */ ];
export const customerHandlers = [ /* MSW handlers */ ];

// src/app/registry.js             ← A adds one import line per module, then never again
```

### Naming rules

- Module components are **prefixed**: `CustomerTable`, `ProductTable`,
  `OrderStatusChip`. Never a bare `Table.jsx` in three different folders.
- Mock data is **per module**. `modules/customers/mock.js`, never a shared
  `mockData.js`. If C needs a customer record, C duplicates one. Duplication is
  cheaper than coordination here.
- Query keys are namespaced: `['customers', 'list', params]`.

---

## 4. Git

- Branch per person: `feat/foundation`, `feat/commercial`, `feat/operations`.
- Merge to `dev` **at least every two days.** Long-lived branches are where the
  real conflicts hide.
- `main` is protected. `dev` requires one approving review.
- Lockfile conflict: whoever merges second deletes their `package-lock.json`,
  re-runs `npm install`, commits the result. Never hand-edit a lockfile.
- No new dependency in `src/components/ui`, `src/lib`, or `src/app` without all
  three agreeing. Supply chain is our realest security risk.

---

## 5. Team split

| | Owner | Scope |
|---|---|---|
| **A** | Foundation | Tokens, shell, router, auth plumbing, shared kit, MSW harness, Dashboard, Settings, Users & Roles, print styles |
| **B** | Commercial | Customers, Sales Orders, Invoices |
| **C** | Operations | Products/Inventory, Suppliers, Purchase Orders |

B and C are mirror workloads — the same list → detail → form → status pattern,
three times each — and neither depends on the other at any point.

---

## 6. Timeline

| | Week 1 | Week 2 | Week 3 |
|---|---|---|---|
| **A** | Repo, tokens, docs sign-off, kit v0, MSW harness | Shell, auth, `<Can>`, kit polish | Dashboard, Settings, Users & Roles, print, OWASP pass |
| **B** | Mock data + handlers, Customers | Sales Orders | Invoices |
| **C** | Mock data + handlers, Products | Suppliers | Purchase Orders |

**End of week 2 there is a clickable app.** That is the demo for the intern
leader. Vague briefs produce specific feedback once someone sees something real.

---

## 7. Read before writing code

1. `docs/entities.md` — the data shapes. **Signed off by all three before any
   form is built.**
2. `docs/api-contract.md` — endpoint shapes, response envelope, error format.
3. `docs/components.md` — locked prop signatures for the shared kit.
4. `docs/security-notes.md` — what the frontend can and cannot enforce.

---

## 8. Known gaps

Things that are deliberately unfinished. Listed here so nobody reports them as
bugs, and so none of them reach the demo by being quietly forgotten. Anything
that must be gone before the demo says so.

### Global search (topbar)

Disabled, with the placeholder "Global search — coming soon".

**Blocked on the backend, not on us.** Searching `acme` must return customers,
orders, invoices, products, suppliers and purchase orders in one ranked list,
scoped to what the user may see. That needs a single endpoint spanning every
module — `GET /api/search?q=`. MSW cannot fake it usefully: stitching per-module
mock arrays together gives a result set that looks right and ranks wrong, and we
would build the UI against the wrong shape.

Post-backend item. Not scheduled, no owner yet.

### Real auth — **must be gone before the demo**

`src/app/providers.jsx` contains a `STUB_USER` constant holding the full
permission catalogue, passed to `AuthProvider` as `initialUser`.

It exists because `<Can>` filters the sidebar: with no user, every nav entry is
hidden and the app looks empty. It is not a login and it is not a security
control — it is a placeholder so the shell is usable before week 2.

**Week 2 (A):** delete the constant and the `initialUser` prop, and boot from
`/auth/refresh` then `/auth/me` as specified in `docs/api-contract.md` §3.
Nothing else changes — `useAuth`, `useCan` and `<Can>` already read from the
provider.

Related: the user menu's Log out clears auth state and navigates to `/login`,
which does not exist yet, so it lands on the 404. That resolves itself when the
login screen ships.

### `format.js` whitespace lint errors

`npm run lint` reports two `no-irregular-whitespace` errors in
`src/lib/format.js`. Two regex character classes contain literal non-breaking
space characters (U+00A0) where an escape sequence should be.

Runtime behaviour is correct and the build is unaffected — `formatMoney` strips
the non-breaking spaces Intl inserts, which is what those regexes are for. But
**lint is red**, so CI cannot gate on it until this is fixed. One-line change.

### No husky pre-commit hook

`husky` is installed and `core.hooksPath` points at `frontend/.husky`, and
`lint-staged` is configured in `frontend/package.json` — but there is no
`frontend/.husky/pre-commit`, so **nothing runs on commit**. Unformatted code
and lint errors can land.

The hook needs one line, `cd frontend && npx lint-staged`; the `cd` is required
because git runs hooks from the repo root and the package lives in `frontend/`.
Alternatively a root `package.json` could own husky instead.

### Outstanding `npm audit` advisories

`docs/security-notes.md` §5 requires `npm audit` clean at high and above before
the demo. It is not. Every remaining fix is a major upgrade that contradicts the
stack table in §1, so each is a group decision.

| Package | Severity | Reach | Only fix |
|---|---|---|---|
| `vitest` | critical | dev only; needs the Vitest UI server listening, which we do not use | Vitest 3+ (pulls Vite 6+) |
| `vite` | high | dev server only; two of the three are Windows-specific (NTLMv2 hash disclosure via UNC paths, `server.fs.deny` bypass) — and we are all on Windows | Vite 8 |
| `react-router` | moderate | **ships in the production bundle** | React Router 7 |

Take the React Router one first. It is an open redirect via backslash in `<Link>`
and `useNavigate`, and it lands squarely on the `/login?next=<path>` redirect in
`docs/api-contract.md` §3. There is no patched 6.x — we are on 6.30.4, the
latest v6, and it is still in range.

### Temporary code to delete before the demo

- `src/pages/KitchenSinkPage.jsx` and its `/kitchen-sink` route — the kit
  reference page.
- `STUB_USER` in `src/app/providers.jsx`, as above.
- The `demo-server-error` and `demo-validation-error` handlers in
  `src/modules/customers/handlers.js` are **not** in this list. They are how
  error states get tested and they stay until the real backend does.
