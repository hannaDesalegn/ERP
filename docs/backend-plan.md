# Backend plan

Four days, three people, Node + Express + MongoDB. This document is short on
purpose: the contract already exists in `docs/api-contract.md` and the entity
shapes in `docs/entities.md`. Nothing here re-specifies them — it says who
builds what, and what everyone can assume is already there.

---

## 1. Setup

Same repo. New folder alongside `frontend/`:

```
ERP/
  frontend/
  backend/
    src/
      config/       db connection, env
      middleware/   auth, permissions, errors, validation
      models/       one file per entity
      routes/       one file per resource
      utils/
      app.js
      server.js
    .env.example
    package.json
  docs/             unchanged, shared by both
```

Stack: Express 4, Mongoose 8, `bcrypt`, `jsonwebtoken`, `zod`, `dotenv`.
No other dependencies without agreement.

`.env` is gitignored. `.env.example` is committed with empty values.

Everyone commits directly to `main`, same as the frontend.

---

## 2. Ownership

| Person | Owns |
|---|---|
| **A** | The spine, auth, users, roles, settings |
| **B** | Customers, orders, invoices |
| **C** | Products, suppliers, purchase orders |

Same boundary rule as the frontend: you edit your own route files and your own
models. You read anyone's, you edit nobody's.

**Models live together in `src/models/`, one file per entity, owned by whoever
owns that resource.** Cross-references use the collection name as a string, so
nothing needs importing across owners:

```js
customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true }
```

`User` and `Role` are A's, because the auth middleware reads them on every
request.

**Schemas mirror `docs/entities.md` field for field.** Same names, same types,
same nullability. Money is an integer in minor units — `Number`, never a float
or a string. Dates are ISO strings. If a field seems wrong or missing, raise it
in the group chat rather than fixing it locally; three people quietly
reinterpreting the same typedef is the one thing that will cost us a day.

---

## 3. The spine — A builds first, everyone depends on it

Day 1 morning. Nobody's routes work until this is in, so it goes in first and
gets pushed before anything else.

What it provides, and what you can therefore assume exists:

**`app.js`** — Express app, JSON body parsing, CORS allow-listing the frontend
origin, routes mounted under `/api`.

**`config/db.js`** — Mongoose connection from `MONGO_URI`, exits loudly on
failure rather than serving a half-working API.

**`middleware/error.js`** — one error handler, one envelope, exactly as
`api-contract.md` §1 specifies:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "…", "fields": { … } } }
```

Throw an `ApiError` from anywhere and it comes out in that shape. The codes are
the ones already in the contract's table — `VALIDATION_FAILED`,
`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `SERVER_ERROR`.

**`middleware/auth.js`** — reads `Authorization: Bearer <token>`, verifies it,
loads the user, attaches `req.user`. 401 if missing or invalid.

**`middleware/permissions.js`** — `requirePermission('customers.edit')`. 403 if
the user's role doesn't hold it. Use it on **every** route including GET.

**`utils/paginate.js`** — takes a Mongoose query and the standard query params
from `api-contract.md` §2 (`page`, `perPage`, `search`, `sort`, `status`,
`dateFrom`/`dateTo`), returns `{ data, meta }`. Written once so all three of us
paginate identically.

**`utils/validate.js`** — runs a Zod schema against `req.body` and throws a
422 with `fields` populated. The Zod schemas already exist in each frontend
module's `schema.js`; copy them into the backend rather than writing new rules.

---

## 4. Auth decisions

**Passwords are hashed with bcrypt, cost 12.** Never stored, logged, or
returned. The `password` field is `select: false` on the User model so it can't
leak by accident.

**No public registration.** An ERP does not let strangers create accounts. Admins
create users from the existing Users page.

**Admin sets an initial password when creating a user.** The user changes it
later from their own account. This replaces a proper invite flow, which is more
than four days allows — worth noting as a known gap rather than pretending it's
the finished design.

**Password rules:** minimum 8 characters, and reject a short list of obvious
ones. That is the whole rule; complexity requirements that force a symbol make
people write passwords down.

**Token:** a JWT, 24 hours, returned by `POST /auth/login` and held in React
state by the frontend, which already works that way. The refresh-token rotation
in `api-contract.md` §3 is **out of scope** — the frontend already documents
that a page refresh signs you out, and that stays true.

`GET /auth/me` verifies the token and returns the user. The frontend has this
handler written and currently unreferenced; it becomes live now.

---

## 5. Endpoints

Straight from `api-contract.md` §4. Every list endpoint takes the §2 query
params. Every response uses the §1 envelope.

**A — Foundation**

```
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
PATCH  /api/auth/password          change your own password

GET    /api/users                  POST /api/users
PATCH  /api/users/:id              DELETE /api/users/:id
GET    /api/roles
GET    /api/permissions
GET    /api/settings               PATCH /api/settings
GET    /api/dashboard/summary
```

**B — Commercial**

```
GET/POST/PATCH/DELETE  /api/customers  + /:id
GET  /api/customers/:id/orders    /api/customers/:id/invoices

GET/POST/PATCH/DELETE  /api/orders     + /:id
POST /api/orders/:id/submit  /approve  /cancel

GET/POST/PATCH         /api/invoices   + /:id
POST /api/invoices/:id/send  /record-payment  /void
```

**C — Operations**

```
GET/POST/PATCH/DELETE  /api/products   + /:id
GET  /api/products/categories
GET/POST /api/products/:id/adjustments

GET/POST/PATCH/DELETE  /api/suppliers  + /:id
GET  /api/suppliers/:id/purchase-orders

GET/POST/PATCH         /api/purchase-orders + /:id
POST /api/purchase-orders/:id/submit  /approve  /receive  /cancel
```

Two rules that apply to everyone:

**Status changes are POST actions, not PATCH.** `POST /orders/:id/approve`, not
`PATCH /orders/:id { status: 'approved' }`. A status change has its own rules
and its own permission, and a PATCH body can be crafted to skip states.

**Totals are calculated server-side.** Never trust a total sent by the client.
Line totals, subtotal, tax, grand total — all computed from the line items.

---

## 6. Security floor

Five things, all of them cheap, all of them expected:

1. **bcrypt on passwords**, cost 12. Never MD5, SHA-1, or plain SHA-256.
2. **Permission check on every endpoint**, including GET. Deny by default: a new
   route with no explicit permission returns 403.
3. **Object-level checks**, not just route-level. Can *this* user see *this*
   record? This is the most commonly missed one and the easiest to exploit.
4. **Allow-list what a PATCH may touch.** Build the update field by field rather
   than spreading `req.body`. A user must not be able to PATCH their own
   `roleId`.
5. **Generic 500s.** No stack traces, no Mongo errors, no library versions in a
   response body.

Fake data only, same as the frontend. No real companies, no real phone numbers.

---

## 7. Out of scope — named so nobody builds it

Refresh token rotation. CSRF tokens. Rate limiting. HSTS and security headers.
Audit logging. Soft deletes. Email sending, including password reset. File
uploads. 2FA. Real-time anything.

All of these are legitimate for a production ERP. None belongs in a four-day
build, and `docs/security-notes.md` §4 already records them as backend
requirements for whoever takes this further.

If the intern lead asks for one, it becomes a scoped task with an owner rather
than something bolted on quietly.

---

## 8. Order of work

**Day 1** — A pushes the spine before lunch. B and C write their Mongoose models
and get one GET list endpoint returning real data. Everyone confirms the
frontend can hit their endpoint with `VITE_USE_MOCKS=false`.

**Day 2** — Full CRUD on every resource.

**Day 3** — The action endpoints: order approvals, invoice payments, goods
receipt. Dashboard summary. Password change.

**Day 4** — Point the frontend at the real backend, fix what breaks, seed the
database with fake data, and stop.

Day 4 is not a building day. Something always breaks at the switchover, and
leaving no time for it is how a working project demos badly.
