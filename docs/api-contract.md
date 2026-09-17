# API contract

The HTTP contract between the frontend and the API. It describes the behaviour
the API currently implements; where this document and the code disagree, the
route files in `backend/src/routes/` are authoritative.

Base URL: `/api`. In development, Vite proxies `/api` to the backend, or Mock
Service Worker intercepts it when `VITE_USE_MOCKS=true` (§5).

---

## 1. Conventions

- REST, resource-per-noun, plural.
- JSON in, JSON out. `Content-Type: application/json`.
- `camelCase` field names. Ids are strings.
- Every response is **enveloped** — never a bare array at the top level. A bare
  array leaves nowhere to add pagination later without breaking every caller.

### Success — single resource

```json
{ "data": { "id": "6aaa2ea19c…", "name": "Acme Trading PLC" } }
```

### Success — collection

```json
{
  "data": [ { "id": "…" }, { "id": "…" } ],
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
straight onto inputs — `setError(name, { message })` — so every module
gets server-side field errors rendered with no extra work.

### Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_FAILED` | 422 | The body failed validation. `fields` is populated. |
| `UNAUTHENTICATED` | 401 | Missing, invalid or expired token, an inactive account, or a failed sign-in. |
| `FORBIDDEN` | 403 | Signed in, but the role lacks the permission the route requires. |
| `NOT_FOUND` | 404 | No record with that id, or no route matches. |
| `CONFLICT` | 409 | Valid request, but not allowed in the record's current state — an illegal status transition, editing a non-draft order, removing more stock than is on hand, deleting a supplier with open purchase orders, a duplicate email. |
| `RATE_LIMITED` | 429 | Too many sign-in attempts. Sent with a `Retry-After` header. |
| `SERVER_ERROR` | 500 | Anything unhandled. A generic message; no stack trace or database detail. |

Permissions are checked per route against the signed-in user's role; a missing
permission is a 403. Records are not scoped to the user who created them: a role
that may view a resource may view every record of that type.

### Status codes on success

| Request | Code |
|---|---|
| `GET` | 200 |
| `POST` that creates a record | 201, with the created record in `data` |
| `POST` that performs an action (`/submit`, `/approve`, …) | 200, with the updated record |
| `PATCH` | 200, with the updated record |
| `DELETE` | 204, no body |

Creating a product, category, stock adjustment, supplier, purchase order or user
also sets a `Location` header. Creating a customer, order or invoice does not.

---

## 2. Collection query parameters

Every list endpoint accepts the same set. Consistency here is what lets one
`DataTable` drive every module.

| Param | Example | Note |
|---|---|---|
| `page` | `?page=2` | 1-indexed. Default 1. |
| `perPage` | `?perPage=25` | Default 25, capped at 100 server-side. |
| `search` | `?search=acme` | Case-insensitive free text. Each resource decides which fields it searches. |
| `sort` | `?sort=-createdAt` | `-` prefix = descending. One field, from the fields that resource allows; anything else falls back to its default order. |
| `status` | `?status=active` | Repeatable: `?status=draft&status=sent`. |
| `dateFrom` / `dateTo` | `?dateFrom=2026-01-01` | Inclusive, `YYYY-MM-DD`. Filters on `createdAt`. |

**These live in the URL, not in component state.** `/customers?page=2&status=active`
must be shareable, bookmarkable, and survive a refresh. The shared
`useTableParams()` hook syncs `DataTable` state to `useSearchParams`; modules
call it and get this behaviour for free.

Module-specific filters belong to their module:

| Endpoint | Filter |
|---|---|
| `GET /api/products` | `?categoryId=`, `?unitOfMeasure=pcs\|kg\|ltr\|box`, `?lowStock=true` (available ≤ reorder level) |
| `GET /api/purchase-orders` | `?supplierId=` |
| `GET /api/users` | `?roleId=` — a role slug, repeatable |
| `GET /api/audit-logs` | `?userId=` |

---

## 3. Auth

```
POST   /api/auth/login      { email, password }               → 200 { data: { user, accessToken } }
GET    /api/auth/me                                            → 200 { data: user }
PATCH  /api/auth/password   { currentPassword, newPassword }   → 200 { data: user }
```

**Bearer token.** `accessToken` is a JWT valid for 24 hours. Send it on every
other request as `Authorization: Bearer <accessToken>`.

- The API sets **no cookie**, issues **no refresh token**, and has **no logout
  or revocation endpoint**. A token stays valid until it expires, including
  after a password change.
- The user is reloaded on every request, so a suspended account or a changed
  role takes effect immediately rather than when the token expires.
- Because credentials travel in a header rather than a cookie, a browser does
  not attach them to cross-site requests automatically, and no CSRF token is
  used. See `docs/security-notes.md`.

**Sign-in.** An unknown email, a wrong password and an inactive account all
return the same 401, `Invalid email or password.` Attempts are limited to 20 per
source address and 5 per account in any 15 minutes, counted separately; beyond
that the response is 429.

**Changing a password.** `PATCH /api/auth/password` acts only on the signed-in
account — there is no id in the path or body. The current password must be
correct (401 otherwise). The new password must be at least 8 characters, no more
than 72 bytes, and not on the common-password list (422 otherwise). An
administrator cannot set another user's password through `PATCH /api/users/:id`.

**In the frontend,** the token is held in memory in `AuthProvider` — never
`localStorage` or `sessionStorage` — so reloading the page signs the user out.
The frontend's logout also sends `POST /api/auth/logout`; the API does not
implement that route, so the request fails and the client clears its state
regardless.

---

## 4. Endpoints

Create and update bodies follow the shapes in `docs/entities.md`. The exact
validation is in the route files and `backend/src/validation/`. Unknown fields
are discarded, and server-managed fields — codes and SKUs, balances, totals,
stock quantities, status, timestamps — are never taken from a request body.

`PATCH` is partial: send only the fields being changed.

### Commercial

| Method | Path | Permission | Behaviour |
|---|---|---|---|
| GET | `/api/customers` | `customers.view` | List. |
| GET | `/api/customers/:id` | `customers.view` | |
| POST | `/api/customers` | `customers.create` | Code generated by the server; balance starts at 0. |
| PATCH | `/api/customers/:id` | `customers.edit` | |
| DELETE | `/api/customers/:id` | `customers.delete` | **Permanent delete.** Nothing checks for existing orders or invoices. |
| GET | `/api/customers/:id/orders` | `customers.view` + `orders.view` | That customer's orders, paginated. |
| GET | `/api/customers/:id/invoices` | `customers.view` + `invoices.view` | That customer's invoices, paginated. |
| GET | `/api/orders` | `orders.view` | List. |
| GET | `/api/orders/:id` | `orders.view` | |
| POST | `/api/orders` | `orders.create` | Created as `draft`. Line prices and all totals computed server-side. |
| PATCH | `/api/orders/:id` | `orders.edit` | `draft` only; 409 otherwise. |
| DELETE | `/api/orders/:id` | `orders.delete` | `draft` only; 409 otherwise — cancel it instead. |
| POST | `/api/orders/:id/submit` | `orders.edit` | `draft` → `pending_approval` |
| POST | `/api/orders/:id/approve` | `orders.approve` | `pending_approval` → `approved`; records the approver. |
| POST | `/api/orders/:id/cancel` | `orders.edit` | Any status except `fulfilled` or `cancelled` → `cancelled` |
| GET | `/api/invoices` | `invoices.view` | List. `overdue` is derived on read — see below. |
| GET | `/api/invoices/:id` | `invoices.view` | |
| POST | `/api/invoices` | `invoices.create` | Created as `draft`. Totals computed server-side. |
| PATCH | `/api/invoices/:id` | `invoices.edit` | `draft` only; 409 otherwise. |
| POST | `/api/invoices/:id/send` | `invoices.edit` | `draft` → `sent` |
| POST | `/api/invoices/:id/record-payment` | `invoices.edit` | See body below. |
| POST | `/api/invoices/:id/void` | `invoices.void` | Any status except `paid` → `void` |

No endpoint moves an order to `fulfilled`. Invoices cannot be deleted.

**Create an order** — `POST /api/orders`

```json
{
  "customerId": "…",
  "orderDate": "2026-09-01",
  "expectedDeliveryDate": "2026-09-15",
  "lines": [ { "productId": "…", "quantity": 10, "discountPercent": 0, "taxPercent": 15 } ],
  "currency": "ETB",
  "notes": null
}
```

**Create an invoice** — `POST /api/invoices`

```json
{
  "salesOrderId": null,
  "customerId": "…",
  "issueDate": "2026-09-01",
  "dueDate": "2026-10-01",
  "lines": [ { "productId": "…", "quantity": 10, "taxPercent": 15 } ],
  "currency": "ETB",
  "notes": null
}
```

`salesOrderId` links the invoice to an order, or is `null` for a standalone
invoice. Invoice lines have no discount. In both bodies, `quantity` is an integer
of at least 1, and each line's product name, SKU and unit price are copied from
the product at the time of the request.

**Record a payment** — `POST /api/invoices/:id/record-payment`

```json
{ "amount": 150000 }
```

`amount` is an integer in minor units, at least 1, and no more than the amount
currently due (422 otherwise). Not allowed on a `draft` or `void` invoice (409).
The invoice becomes `paid` when the amount paid reaches the grand total, and
`partially_paid` before that.

**Derived `overdue` status.** `overdue` is never stored. An invoice that is `sent`
or `partially_paid`, past its due date, with an amount still due, is returned
with `status: "overdue"`.

### Operations

| Method | Path | Permission | Behaviour |
|---|---|---|---|
| GET | `/api/products` | `products.view` | List. |
| GET | `/api/products/:id` | `products.view` | |
| POST | `/api/products` | `products.create` | SKU generated by the server. |
| PATCH | `/api/products/:id` | `products.edit` | Stock quantities cannot be set here — use adjustments. |
| DELETE | `/api/products/:id` | `products.delete` | Permanent delete. 409 if the product is on a purchase order that is not yet `received` or `cancelled`. |
| GET | `/api/products/categories` | `products.view` | |
| POST | `/api/products/categories` | `products.create` | `{ "name": "…" }` |
| GET | `/api/products/:id/adjustments` | `products.view` | Stock movement history. |
| POST | `/api/products/:id/adjustments` | `products.adjust_stock` | See body below. |
| GET | `/api/suppliers` | `suppliers.view` | List. |
| GET | `/api/suppliers/:id` | `suppliers.view` | |
| POST | `/api/suppliers` | `suppliers.create` | Code generated by the server; balance starts at 0. |
| PATCH | `/api/suppliers/:id` | `suppliers.edit` | |
| DELETE | `/api/suppliers/:id` | `suppliers.delete` | Permanent delete. 409 if the supplier has purchase orders that are not yet `received` or `cancelled`. |
| GET | `/api/suppliers/:id/purchase-orders` | `suppliers.view` + `purchasing.view` | |
| GET | `/api/purchase-orders` | `purchasing.view` | List. |
| GET | `/api/purchase-orders/:id` | `purchasing.view` | |
| POST | `/api/purchase-orders` | `purchasing.create` | Created as `draft`. Totals computed server-side. |
| PATCH | `/api/purchase-orders/:id` | `purchasing.edit` | `draft` only; 409 otherwise. |
| POST | `/api/purchase-orders/:id/submit` | `purchasing.edit` | `draft` → `pending_approval`; 409 if the order has no lines. |
| POST | `/api/purchase-orders/:id/approve` | `purchasing.approve` | `pending_approval` → `approved`; records the approver. |
| POST | `/api/purchase-orders/:id/receive` | `purchasing.receive` | `approved` or `partially_received` → `partially_received` or `received`. See body below. |
| POST | `/api/purchase-orders/:id/cancel` | `purchasing.edit` | `draft`, `pending_approval` or `approved` → `cancelled` |

Purchase orders cannot be deleted.

**Adjust stock** — `POST /api/products/:id/adjustments`

```json
{ "direction": "decrease", "quantity": 2, "reason": "damage", "reference": null, "notes": null }
```

`direction` is `increase` or `decrease`. `quantity` is above zero.
`reason` is one of `purchase`, `sale`, `damage`, `loss`, `count_correction`,
`return`. `reference` and `notes` are optional. A decrease larger than the
quantity on hand is refused with 409.

**Receive goods** — `POST /api/purchase-orders/:id/receive`

```json
{ "lines": [ { "lineId": "…", "quantityReceived": 5 } ] }
```

Each `quantityReceived` is zero or more and no more than that line's outstanding
quantity (422 otherwise), and at least one must be above zero. Received
quantities are added to stock. The order becomes `received` once every line is
complete, `partially_received` before that.

### Foundation

| Method | Path | Permission | Behaviour |
|---|---|---|---|
| GET | `/api/dashboard/summary` | `dashboard.view` | KPI figures and recent activity, as a single object. |
| GET | `/api/users` | `users.view` | List. |
| POST | `/api/users` | `users.create` | Includes the account's initial password, which must meet the password rules in §3. |
| PATCH | `/api/users/:id` | `users.edit` | Does not accept a password. |
| DELETE | `/api/users/:id` | `users.delete` | Permanent delete. 409 when deleting the signed-in account. |
| GET | `/api/roles` | `users.view` | Read-only. Roles cannot be created or edited through the API. |
| GET | `/api/settings` | `settings.view` | |
| PATCH | `/api/settings` | `settings.edit` | |
| GET | `/api/audit-logs` | `audit.view` | List of recorded state-changing requests. Searches email, path, resource and action. |
| GET | `/api/audit-logs/record/:resource/:recordId` | `audit.view` | Every entry for one record, oldest first. |

There is no `GET /api/users/:id`, no permission-catalogue endpoint, and no way to
edit or delete an audit log entry.

### Status transitions are POST actions, not PATCH

`POST /orders/:id/approve` rather than `PATCH /orders/:id { status: 'approved' }`.
A status change is a business operation with its own rules and its own
permission — it is not a field edit. This also means the API can't be tricked
into an illegal transition by a crafted PATCH body.

---

## 5. Mocking with MSW

With `VITE_USE_MOCKS=true`, Mock Service Worker serves the API from in-memory
fixtures in the browser, so the frontend runs with no backend.
`src/mocks/handlers.js` collects each module's handlers from its registry export.
Each module writes its handlers in its own folder; this file is not edited when
a module is added.

```js
// modules/customers/handlers.js
import { http, HttpResponse } from 'msw';
import { customers } from './mock';
import { paginate } from '@/mocks/helpers';   // shared helper

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

`src/mocks/helpers.js` provides `paginate()`, `delay()`, and `validationError()`
so every module behaves identically.

**The mocks are a development aid, not a second implementation.** They follow
this contract closely but not exactly: mock ids are readable strings such as
`cus_0001` rather than database ids, and the mock auth handlers still return
flat `{ message }` errors and accept routes the API does not implement. Test
anything that matters against the real API.

**Mock the failures too.** A happy-path-only mock produces a UI that falls apart
the first time the real backend returns a 422. The customers module includes
`demo-server-error` and `demo-validation-error` handlers for exercising those
states.

**Mock data must be obviously fake.** `Acme Trading PLC`, `+251-900-000-001`,
`@example-erp.test`. No real company names, no real phone numbers, nothing
scraped from an actual business. Fake data in a public repo is a non-event; real
data in a public repo is an incident.

### Switching to the real backend

1. Set `VITE_USE_MOCKS=false`.
2. Set `VITE_API_PROXY_TARGET` to the API's address.

No component changes and no `api.js` changes — that is the point of mocking at
the network layer instead of importing arrays into components.

---

## 6. Validation and authorisation

The Zod schemas in each frontend module's `schema.js` give a form immediate
feedback. The API does not rely on them: it re-validates every request with its
own schemas, which mirror the frontend's, and it checks authentication and
permission on every route, including reads.

Nothing the frontend hides, disables or validates is a security control on its
own. See `docs/security-notes.md`.
