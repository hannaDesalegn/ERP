# API contract

This is the contract the frontend codes against **and** the specification the
backend team implements. It exists before the backend does, on purpose — MSW
serves it today, a real server serves it later, and the frontend never notices
the swap.

Base URL: `/api` (Vite proxies to the backend in dev; MSW intercepts when
`VITE_USE_MOCKS=true`).

---

## 1. Conventions

- REST, resource-per-noun, plural.
- JSON in, JSON out. `Content-Type: application/json`.
- `camelCase` field names.
- Every response is **enveloped** — never a bare array at the top level. A bare
  array leaves nowhere to add pagination later without breaking every caller.

### Success — single resource

```json
{ "data": { "id": "cus_01", "name": "Acme Trading PLC" } }
```

### Success — collection

```json
{
  "data": [ { "id": "cus_01" }, { "id": "cus_02" } ],
  "meta": { "page": 1, "perPage": 25, "total": 143, "totalPages": 6 }
}
```

### Error — every failure, always this shape

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The submitted data is invalid.",
    "fields": {
      "email": "Must be a valid email address.",
      "creditLimit": "Must be zero or greater."
    }
  }
}
```

`fields` is present only on `VALIDATION_FAILED`. React Hook Form maps it
straight onto inputs — `setError(name, { message })` — so B and C get
server-side field errors rendered with no extra work.

### Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_FAILED` | 422 | Body failed validation. `fields` populated. |
| `UNAUTHENTICATED` | 401 | No/expired token. Triggers the refresh interceptor. |
| `FORBIDDEN` | 403 | Authenticated but lacks the permission. |
| `NOT_FOUND` | 404 | Resource doesn't exist or isn't visible to this user. |
| `CONFLICT` | 409 | Duplicate SKU, stale version, illegal status transition. |
| `RATE_LIMITED` | 429 | Too many requests. |
| `SERVER_ERROR` | 500 | Anything unhandled. Never leaks a stack trace. |

**404 for forbidden-and-invisible is deliberate.** Telling an attacker "this
customer exists but you can't see it" is an information leak. When a user has no
right to know a record exists, the answer is 404.

### Status codes on success

| Verb | Code |
|---|---|
| `GET` | 200 |
| `POST` | 201 + `Location` header |
| `PATCH` | 200 with the updated resource |
| `DELETE` | 204, no body |

---

## 2. Collection query parameters

Every list endpoint accepts the same set. Consistency here is what lets one
`DataTable` drive every module.

| Param | Example | Note |
|---|---|---|
| `page` | `?page=2` | 1-indexed. Default 1. |
| `perPage` | `?perPage=25` | Default 25, max 100. |
| `search` | `?search=acme` | Free text. Server decides which fields. |
| `sort` | `?sort=-createdAt` | `-` prefix = descending. One field. |
| `status` | `?status=active` | Repeatable: `?status=draft&status=sent`. |
| `dateFrom` / `dateTo` | `?dateFrom=2026-01-01` | Inclusive, `YYYY-MM-DD`. |

**These live in the URL, not in component state.** `/customers?page=2&status=active`
must be shareable, bookmarkable, and survive a refresh. A owns the
`useTableParams()` hook that syncs `DataTable` state to `useSearchParams`; B and
C call it and get this behaviour for free.

Module-specific filters are allowed and owned by that module — `?categoryId=`,
`?lowStock=true`, `?supplierId=`.

---

## 3. Auth — A owns, nobody else touches

```
POST   /api/auth/login      { email, password }  → { data: { user, accessToken } }
POST   /api/auth/refresh    (cookie only)        → { data: { accessToken } }
POST   /api/auth/logout                          → 204
GET    /api/auth/me                              → { data: user }
```

**Token handling — this is a decision, not a preference:**

- `accessToken` is short-lived (15 min) and held **in memory only**, in React
  state inside `AuthProvider`. Not localStorage, not sessionStorage, not a
  readable cookie — those are all reachable by injected script.
- The refresh token is set by the server as an **httpOnly, Secure, SameSite=Strict
  cookie**. JavaScript cannot read it. The frontend never sees it and never
  handles it.
- `apiClient` attaches `Authorization: Bearer <accessToken>` to every request.
- On any 401, `apiClient` calls `/auth/refresh` once, retries the original
  request, and if the refresh also fails, clears auth state and redirects to
  `/login?next=<current-path>`. Concurrent 401s share a single refresh promise so
  five parallel table requests don't fire five refreshes.
- Page refresh loses the in-memory token by design. On boot, `AuthProvider` calls
  `/auth/refresh` once, then `/auth/me`, and shows a full-page skeleton until
  that resolves.

**Backend requirement:** `POST` `PATCH` `DELETE` must be CSRF-protected, since a
cookie is involved. Double-submit token or `SameSite=Strict` plus an
`Origin` check. Called out again in `docs/security-notes.md`.

---

## 4. Endpoints

Every module is the same five verbs. B and C get an identical contract with the
noun swapped — this is precisely why their work never overlaps.

### B — Commercial

```
GET    /api/customers                   list
GET    /api/customers/:id               one
POST   /api/customers                   create
PATCH  /api/customers/:id               update (partial)
DELETE /api/customers/:id               archive
GET    /api/customers/:id/orders        that customer's orders
GET    /api/customers/:id/invoices

GET    /api/orders
GET    /api/orders/:id
POST   /api/orders
PATCH  /api/orders/:id
DELETE /api/orders/:id
POST   /api/orders/:id/submit           draft → pending_approval
POST   /api/orders/:id/approve          pending_approval → approved
POST   /api/orders/:id/cancel           → cancelled

GET    /api/invoices
GET    /api/invoices/:id
POST   /api/invoices                    optionally { fromOrderId }
PATCH  /api/invoices/:id
POST   /api/invoices/:id/send           draft → sent
POST   /api/invoices/:id/record-payment { amount, paidAt, method, reference }
POST   /api/invoices/:id/void           → void
```

### C — Operations

```
GET    /api/products
GET    /api/products/:id
POST   /api/products
PATCH  /api/products/:id
DELETE /api/products/:id
GET    /api/products/categories
GET    /api/products/:id/adjustments    stock movement history
POST   /api/products/:id/adjustments    { direction, quantity, reason, notes }

GET    /api/suppliers
GET    /api/suppliers/:id
POST   /api/suppliers
PATCH  /api/suppliers/:id
DELETE /api/suppliers/:id
GET    /api/suppliers/:id/purchase-orders

GET    /api/purchase-orders
GET    /api/purchase-orders/:id
POST   /api/purchase-orders
PATCH  /api/purchase-orders/:id
POST   /api/purchase-orders/:id/submit
POST   /api/purchase-orders/:id/approve
POST   /api/purchase-orders/:id/receive  { lines: [{ lineId, quantityReceived }] }
POST   /api/purchase-orders/:id/cancel
```

### A — Foundation

```
GET    /api/dashboard/summary           KPI cards + recent activity
GET    /api/users
POST   /api/users
PATCH  /api/users/:id
DELETE /api/users/:id
GET    /api/roles
POST   /api/roles
PATCH  /api/roles/:id
GET    /api/permissions                 the full permission catalogue
GET    /api/settings
PATCH  /api/settings
```

### Status transitions are POST actions, not PATCH

`POST /orders/:id/approve` rather than `PATCH /orders/:id { status: 'approved' }`.
A status change is a business operation with its own rules and its own
permission — it is not a field edit. This also means the backend can't be tricked
into an illegal transition by a crafted PATCH body.

---

## 5. Mocking with MSW

`src/mocks/handlers.js` collects each module's handlers from its registry export.
B and C write handlers in their own folder and never touch A's file.

```js
// modules/customers/handlers.js       ← B owns
import { http, HttpResponse } from 'msw';
import { customers } from './mock';
import { paginate } from '@/mocks/helpers';   // A provides

export const customerHandlers = [
  http.get('/api/customers', ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json(paginate(customers, url));
  }),

  http.get('/api/customers/:id', ({ params }) => {
    const found = customers.find((c) => c.id === params.id);
    return found
      ? HttpResponse.json({ data: found })
      : HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Customer not found.' } },
          { status: 404 },
        );
  }),
];
```

A provides `paginate()`, `delay()`, and `validationError()` in
`src/mocks/helpers.js` so all three modules behave identically.

**Mock the failures too.** A happy-path-only mock produces a UI that falls apart
the first time the real backend returns a 422. Every module ships handlers for at
least one 422, one 403, and one 500, toggleable from a dev-only panel A builds.

**Mock data must be obviously fake.** `Acme Trading PLC`, `+251-900-000-001`,
`@example-erp.test`. No real company names, no real phone numbers, nothing
scraped from an actual business. Fake data in a public repo is a non-event; real
data in a public repo is an incident.

### Switching to the real backend

1. Set `VITE_USE_MOCKS=false`.
2. Point the Vite dev proxy at the backend.
3. Delete `src/mocks/` and each module's `handlers.js`.

No component changes, no `api.js` changes. That is the entire point of doing it
this way instead of importing arrays into components.

---

## 6. Handing this to the backend team

When the backend work starts, they get: this file, `docs/entities.md`, and the
Zod schemas from each module's `schema.js`. The Zod schemas are the executable
version of the validation rules — they should mirror them server-side rather than
inventing a second set that drifts.

Non-negotiable on their side: they re-validate and re-authorise **everything**.
Nothing in this document should be read as the frontend having secured anything.
See `docs/security-notes.md`.
