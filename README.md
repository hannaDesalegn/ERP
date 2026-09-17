# ERP

A web-based ERP (Enterprise Resource Planning) application covering the
commercial and operations sides of a small trading business: customers, sales
orders and invoices; products, stock, suppliers and purchase orders; with users,
roles, settings, a dashboard and an audit trail underneath.

Built as a training project. **It holds no real data** — every record in the
repository and in the demo database is invented, and no real company, person,
email address or phone number appears anywhere in it.

---

## Contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Running it locally](#running-it-locally)
- [Environment variables](#environment-variables)
- [Seeding data](#seeding-data)
- [Tests and checks](#tests-and-checks)
- [Deployment](#deployment)
- [Security](#security)
- [Known limitations](#known-limitations)
- [Documentation](#documentation)

---

## What it does

| Area | Capabilities |
|---|---|
| Customers | Create, edit, list and search customers; per-customer order and invoice history; credit limits and payment terms |
| Sales orders | Multi-line orders with per-line discount and tax; server-calculated totals; draft → pending approval → approved, or cancelled |
| Invoices | Raised standalone or against an order; payment recording; `overdue` derived on read from due date and outstanding amount |
| Products | Catalogue with categories, cost and selling price, reorder levels; stock changes only through adjustment records |
| Suppliers | Supplier records with balances derived from received purchase orders |
| Purchase orders | Multi-line orders with an explicit table of legal status transitions |
| Users and roles | Role-based permissions across 36 permission strings, enforced server-side |
| Dashboard | Summary counts and key figures |
| Audit log | Every state-changing request recorded, readable only by administrators |

Money is stored as integers in minor units throughout — never floating point.
Totals are always recalculated server-side and a total supplied by a client is
discarded.

---

## Architecture

Three deployable pieces: a React single-page app, an Express API, and MongoDB.

```
Browser (React SPA)  ──▶  Express API  ──▶  MongoDB
```

The frontend can also run entirely without the backend: Mock Service Worker
intercepts requests at the network layer and serves the same API contract from
in-memory fixtures. That mode is the default for local development.

### Stack

| Layer | Technology |
|---|---|
| Language | JavaScript (ES2022) with JSDoc type annotations |
| Frontend | React 18, Vite 5, React Router 6, Tailwind CSS 3 |
| UI components | shadcn/ui (Radix primitives), vendored into the repo rather than installed |
| Server state | TanStack Query 5 |
| Forms and validation | React Hook Form with Zod schemas shared in shape with the API |
| Mock API | Mock Service Worker |
| Backend | Node.js 20+, Express 4, Mongoose 8 |
| Database | MongoDB |
| Auth | JSON Web Tokens, bcrypt password hashing |
| Tests | Vitest and Testing Library (frontend); a scripted API smoke test (backend) |
| Tooling | ESLint, Prettier, Husky, lint-staged |

No third-party external APIs are used. The only API in the project is its own.

---

## Repository layout

```
backend/
  src/
    models/        Mongoose schemas
    routes/        Express routers, one per resource
    middleware/    auth, permissions, rate limiting, security headers, audit log, errors
    validation/    Zod schemas for request bodies
    utils/         pagination, totals, sequences, password rules
    seed*.js       database seed scripts
    smokeOperations.js   API smoke test
frontend/
  src/
    app/           router, providers, module registry
    auth/          auth context and route guards
    components/ui/ shared component kit
    layouts/       app shell
    lib/           API client
    mocks/         Mock Service Worker setup and shared handlers
    modules/       one folder per business module
docs/              API contract, entity, component and security documentation
```

Each module under `frontend/src/modules/` follows the same shape: `index.js`
exports routes, navigation and mock handlers; `api.js` holds fetch functions and
query keys; `schema.js` holds Zod schemas; `mock.js` holds fixtures; `pages/`
holds the screens.

---

## Running it locally

Requires Node.js 20 or newer.

### Frontend only, against the mock API

No backend or database needed.

```bash
cd frontend
npm install
cp .env.example .env     # VITE_USE_MOCKS defaults to true
npm run dev              # http://localhost:5173
```

Sign in with any of the mock accounts listed in
`frontend/src/mocks/authHandlers.js`. These exist only in the browser, are not
connected to any database, and are reset on every page load.

### Full stack, against a real database

```bash
# 1. API
cd backend
npm install
cp .env.example .env     # fill in MONGO_URI and JWT_SECRET
npm run dev              # http://localhost:8000

# 2. Frontend, in a second terminal
cd frontend
npm install
cp .env.example .env
# set VITE_USE_MOCKS=false so requests reach the API
npm run dev
```

---

## Environment variables

Copy `.env.example` to `.env` in each package and fill it in. `.env` files are
git-ignored and must never be committed.

### `backend/.env`

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for signing access tokens. A long random string |
| `PORT` | Port the API listens on. Defaults to 8000 |
| `CORS_ORIGIN` | Exact browser origin permitted by CORS. Never `*` |

### `frontend/.env`

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Base path for API calls |
| `VITE_USE_MOCKS` | `true` serves the app from Mock Service Worker; `false` sends requests to the API |
| `VITE_API_PROXY_TARGET` | Where the dev server proxies `/api` when mocks are off |
| `VITE_APP_ENV` | Environment label shown in the interface |

Anything prefixed `VITE_` is compiled into the public bundle and is readable by
any user. No secret, key or credential belongs in a `VITE_` variable.

---

## Seeding data

Run from `backend/`, in this order — each script depends on the one before it
and will stop rather than guess if you skip a step.

```bash
npm run seed              # roles and user accounts
npm run seed:operations   # categories, products, suppliers, purchase orders
npm run seed:commercial   # customers, sales orders, invoices
```

`npm run seed` creates the test accounts from `TEST_ADMIN_PASSWORD`,
`TEST_MANAGER_PASSWORD` and `TEST_STAFF_PASSWORD`. Set them in `backend/.env`
first; no account password is stored in the repository. It creates missing
accounts only and never changes an existing one, so it cannot be used to reset a
password — use `PATCH /api/auth/password` for that.

Each script clears the collections it owns before inserting, so re-running one
reproduces the same result rather than duplicating records. That also means
re-running one discards anything created in those collections since.

The seeds calculate every total using the same arithmetic as the route that
would otherwise have produced the record, so seeded data is consistent with what
the API generates.

---

## Tests and checks

```bash
cd frontend
npm run test           # Vitest
npm run lint           # ESLint
npm run format:check   # Prettier
```

The backend has no unit test suite. It has a scripted smoke test that exercises
the operations endpoints against a running server and a real database, covering
authentication, authorisation, validation, server-managed fields, stock
adjustments and the purchase order lifecycle:

```bash
cd backend
BASE_URL=http://localhost:8000 node src/smokeOperations.js
```

**Current state:** ESLint reports no errors (4 `react-refresh` warnings). The
frontend test suite has one test file, `LoginPage.test.jsx`, and its 4 tests
currently fail — the component is rendered without the `AuthProvider` it
depends on. This is a known failure in the test setup, not in the application.

---

## Deployment

The application is deployed as a static frontend, a separately hosted API, and a
managed MongoDB instance. The browser reaches the API through a rewrite on the
application domain, so both share an origin and no cross-origin cookie is
involved.

`DEPLOY.md` documents the full procedure, the required environment variables and
the rollback steps.

---

## Security

A training project, but written against a threat model rather than by habit.
`docs/security-notes.md` records the reasoning; the short version:

- **Authorisation is enforced server-side on every endpoint, including reads.**
  Every route carries a required permission string checked against the signed-in
  user's role. The interface also hides controls a user lacks permission for,
  but that is a usability measure and secures nothing on its own.
- **Passwords** are hashed with bcrypt and the field is excluded from queries by
  default. The password policy follows current NIST guidance — a length minimum
  and a common-password rejection list rather than composition rules.
- **Request bodies** are parsed against Zod schemas that discard unknown fields,
  and updates are built field by field from an allow-list rather than by
  spreading the request body, so server-managed fields cannot be set by a client.
- **Money and stock** are server-calculated. There is no endpoint that sets a
  stock quantity directly; stock moves only through adjustment records.
- **Errors** are logged server-side and returned as a generic message, without
  stack traces or database detail.
- **Rate limiting** is applied to sign-in attempts, by source address and by
  targeted account, counted separately.
- **Security headers** are set on API responses, with a Content-Security-Policy
  on the application itself.
- **Audit logging** records every state-changing request, including failed
  attempts, and is readable only with the `audit.view` permission.

These describe what is implemented. They are not a claim that the application
has been independently verified as secure. Known weaknesses are recorded in the
security documentation rather than omitted, and an external review is the point
at which any of it gets confirmed.

To report a vulnerability, follow [`SECURITY.md`](SECURITY.md). Please do not
open a public issue for security problems.

---

## Known limitations

Stated plainly, because they are the honest current state of a project built to
a deadline:

- **The frontend test suite does not pass.** See [Tests and checks](#tests-and-checks).
- **No refresh token rotation.** A single JWT valid for 24 hours. Signing out
  clears client state, but the token remains valid until it expires.
- **Deletes are permanent.** There is no soft delete or restore.
- **The audit log records the request and the outcome, not the prior state** of
  the record, so it shows that a change happened but not what the record looked
  like before.
- **`Customer.balance` is not maintained by any route.** It is set to zero on
  creation and never recalculated; recording a payment does not move it.
- **Outstanding `npm audit` advisories.** Each remaining fix requires a major
  version upgrade. One of them — an open redirect in React Router 6 — ships in
  the production bundle; the only patched release is React Router 7.
- **Object-level authorisation is thinner than route-level authorisation.**
  Route permissions are in place everywhere; per-record ownership checks are not
  applied consistently.

---

## Documentation

| Document | Contents |
|---|---|
| `docs/entities.md` | Every entity, field by field, with types and nullability |
| `docs/api-contract.md` | Endpoints, envelopes, pagination, filtering, error shapes |
| `docs/components.md` | The shared component kit |
| `docs/security-notes.md` | Threat model and the control checklist behind the security section above |
| `DEPLOY.md` | Deployment procedure and rollback |
| `SECURITY.md` | How to report a vulnerability |
