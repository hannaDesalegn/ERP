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
