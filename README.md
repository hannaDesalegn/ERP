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

### Real auth — **done, except for session persistence**

`STUB_USER` is gone. `src/auth/` now holds the whole flow: `AuthContext.jsx`
(state, `login`, `logout`, `<Can>`, `useCan`), `ProtectedRoute.jsx` and
`RequireRole.jsx`. `POST /auth/login`, `GET /auth/me` and `POST /auth/logout`
are mocked in `src/mocks/authHandlers.js` against three seed accounts —
`admin@zion.test`, `manager@zion.test`, `staff@zion.test`.

The access token lives in React state and nowhere else, so **a page refresh
signs you out**. That is the documented decision, not a bug
(`docs/security-notes.md` § Token handling), and it is the one piece still
outstanding: booting from `POST /auth/refresh` against an httpOnly cookie, as
specified in `docs/api-contract.md` §3. `isLoading` on the auth context already
exists for it and `ProtectedRoute` already branches on it, so that work should
not touch any consumer.

`GET /auth/me` is written and correct but currently unreferenced — with no
persisted token there is nothing to restore on mount. It becomes live with
refresh.

### "Remember me" — removed pending `/auth/refresh`

The login form had a "Remember me" checkbox. It is gone: the access token lives
in React state, so nothing survives a page load and the control could not do
anything. Staying signed in across a refresh is a backend concern — an httpOnly
refresh cookie and `POST /auth/refresh` (`docs/api-contract.md` §3), not a
client-side box to tick.

Bring it back when refresh lands, and only if it then changes behaviour.

### 4 tests red — `LoginPage.test.jsx`

All four cases fail with `useAuth must be used inside <AuthProvider>`. The test
renders `<LoginPage />` bare in a `MemoryRouter`, which was enough when submit
was a fake 1.2s delay. It now needs an `AuthProvider`, a `QueryClientProvider`
and MSW, and two of its cases still assert on the removed "Remember me"
checkbox.

Left red deliberately rather than half-fixed. To be sorted out with the MSW test
setup — `src/mocks/server.js` via `setupServer`, wired into `src/test/setup.js`,
plus a render helper that wraps the providers.

### Row actions render but do nothing — customers, and everything copied from it

`CustomerListPage` renders Edit and Delete in the row menu. Neither works:

- **Edit** calls `navigate('/customers/:id/edit')`, and `customerRoutes` exports
  only `{ path: '/customers' }`. There is no detail route and no edit route, so
  the click falls through to the catch-all and renders the 404 page inside the
  shell.
- **Delete** is `onClick: () => {}` — no confirm, no request, no feedback. It
  looks like a no-op bug from the user's side, because it is one.

The detail, edit and delete flows were never built in the reference module. That
matters more than one module's gap: `orders` was copied from it and has the
identical pair — `navigate('/orders/:id/edit')` against a single `/orders`
route, and an empty Delete handler. `invoices` carries it too. Any module copied
from the reference inherits both until the reference is finished.

Owned by B. The row actions should either be wired or removed — a menu entry
that silently does nothing is worse than an absent one.

### Invoices is not registered

`src/app/registry.js` imports `orders` but holds `invoices` out, commented with
a `TODO(B)`. Registering it fails the build:

```
"invoiceKeys" is not exported by "src/modules/invoices/api.js",
imported by "src/modules/invoices/pages/InvoiceListPage.jsx"
```

`src/modules/invoices/api.js` is still the copied customers file — the header
reads "Customers API", `RESOURCE` is `'/customers'`, and it exports
`customerKeys` / `fetchCustomers` rather than the `invoice*` names the page
imports. That module's `index.js` and `handlers.js` are already correct, so the
fix is confined to `api.js`: rename `RESOURCE`, the key namespace, and the six
CRUD functions. Then uncomment the import and the three spreads in the registry.

Until that lands, invoices has no route, no nav entry, and no mock handlers.

### DataTable still has its own inline skeletons

`<Skeleton>` shipped, but `DataTable` does not use it. Two places still build
their own placeholders inline:

- the table body row, `h-3 w-full animate-pulse rounded-sm bg-bg` (~line 387)
- the `MobileCards` card, `h-24 animate-pulse rounded-md ...` (~line 469)

Both differ from the component in ways that matter. They use plain
`animate-pulse`, which the global rule in `styles/tailwind.css` only clamps to
`0.01ms` — the animation is frozen rather than absent, where `<Skeleton>` uses
`motion-safe:` and removes it outright under `prefers-reduced-motion`. The row
bar is also `bg-bg`, which only reads against `bg-surface`, where the component
uses `bg-border` and works on either ground.

Left as a deliberate follow-up rather than folded into the component work:
swapping them changes the loading appearance of every list page in the app, so
it deserves its own change and its own look.

### KPICard trend has no polarity — needs a group decision

The locked signature in `docs/components.md` gives the trend a direction and
nothing else:

```jsx
trend={{ value: 12.4, direction: 'up', label: 'vs last month' }}
```

So `up` renders green and `down` renders red, always. That is backwards for
every metric where a rise is bad news — outstanding balance, overdue invoices,
low stock, days sales outstanding. The dashboard is exactly the screen that will
show those, in cards sitting next to ones where up genuinely is good.

The component cannot fix this on its own; the signature has nowhere to put the
answer. It needs a `polarity` or `intent` prop agreed by all three and written
into `docs/components.md`.

The dashboard shipped before that decision, and works around it rather than
pre-empting it: all four of its cards are metrics where a rise is good news —
revenue this month, orders this month, active customers, average order value —
so direction-as-colour is correct for every one of them. **Outstanding balance
and overdue invoices stay off the dashboard until polarity is settled**, because
those are exactly the cards that would paint a growing debt green. Adding them
is blocked on the decision, not on the work.

Related and smaller: `trend.value` is rendered as a percentage — `12.4` shows as
`12.4%`. The doc does not say that anywhere. It is the only reading that makes
sense next to `label: 'vs last month'`, but it is an inference, and it should be
stated in the signature rather than left for the next person to rediscover.

### FormTextarea has no character counter

`FormTextarea` delegates to `FormField`, which already renders a `<textarea>`
when `type="textarea"`. That keeps one textarea implementation in the kit
instead of two that can drift, and `maxLength` passes straight through.

The cost is that setting `maxLength` gives no character counter — the input
simply stops accepting characters, with nothing telling the user why. Adding one
means abandoning the delegation and writing `FormTextarea` standalone, at which
point the kit has two textareas to keep in step. Deliberate trade, recorded so
the next person does not "fix" the delegation without knowing what it bought.

### FieldShell — done, ahead of the trigger this entry set

Extracted in `f094cdb`, before `FormDate`, `FormSection`, `FormRow` and
`FormActions` landed rather than after — four copies of the label / hint / error
block were already enough on their own.

`FieldShell.jsx` is kit-internal, not exported from `index.js`. `FormField`,
`FormSelect`, `FormMoney` and `FormCheckbox` render through it with unchanged
DOM, and `FormDate` inherits it by delegating to `FormField`. The other three
never touch it and should not: `FormSection` has a heading rather than a label,
`FormRow` is a grid and `FormActions` is two buttons, so none of them owns a
control for the shell's generated id and `aria-describedby` to attach to.

Nothing here is outstanding; the entry stays only so the plan it used to
describe is not carried out a second time.

### No husky pre-commit hook

`husky` is installed and `core.hooksPath` points at `frontend/.husky`, and
`lint-staged` is configured in `frontend/package.json` — but there is no
`frontend/.husky/pre-commit`, so **nothing runs on commit**. Unformatted code
and lint errors can land.

The hook needs one line, `cd frontend && npx lint-staged`; the `cd` is required
because git runs hooks from the repo root and the package lives in `frontend/`.
Alternatively a root `package.json` could own husky instead.

### Restart the dev server after pulling new MSW handlers

After pulling changes that add or modify MSW handlers, restart the dev server.
The service worker is registered at startup and does not pick up new handler
files.

It shows as **"The server returned an unreadable response" on every API call**,
including login, which reads like broken auth rather than a stale worker. The
message looks that way because the proxy in `vite.config.js` is unconditional:
anything MSW does not intercept is forwarded to `VITE_API_PROXY_TARGET`
(`localhost:8000` by default), nothing is listening there, and the proxy's error
body is not JSON — so `apiClient` reports it as unparseable rather than as a
missing mock.

Not a bug. Recorded because it cost twenty minutes to diagnose once already.

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
- The seed accounts and plaintext passwords in `src/mocks/authHandlers.js` —
  they go with the rest of MSW when the real auth service lands.
- The `demo-server-error` and `demo-validation-error` handlers in
  `src/modules/customers/handlers.js` are **not** in this list. They are how
  error states get tested and they stay until the real backend does.
