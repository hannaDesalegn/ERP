# Deployment

How this project is deployed.

The two halves deploy separately and are joined by a rewrite, so the browser
only ever talks to one origin:

```
browser ──▶ Vercel (React build)
                │  /api/*  rewritten
                ▼
            Render (Express)  ──▶  MongoDB Atlas
```

Why a rewrite rather than pointing the frontend at the API domain directly:
`frontend/src/lib/apiClient.js` builds its request URL and then returns only
`pathname + search`, discarding the origin. An absolute cross-origin API base
would be silently dropped and every call would hit the Vercel domain instead.
Keeping everything same-origin avoids that, and removes the need for CORS
configuration at the same time.

---

## Before anything goes public

**Rotate the database password and the token signing secret.** Any credential
used during development should be treated as spent: development credentials get
pasted into chat, shells and notifications, and none of those are places a
production secret should live. In Atlas: Database Access, edit the user, set a
new password, then update `MONGO_URI` everywhere it is used. Generate a fresh
`JWT_SECRET` at the same time. Do this before the API is reachable from the
internet, not after.

---

## 1. MongoDB Atlas

Already provisioned. Two settings matter:

| Setting | Value | Note |
|---|---|---|
| Database user password | rotated, 24+ random characters | see above |
| Network access | see below | |

The API host's free tier gives the service no fixed outbound IP address, so the
database's IP access list cannot be narrowed to it specifically. A permissive
access list leaves the database password as the only barrier, which is why that
password must be long, random and rotated before the deployment is exposed. A
paid tier provides a static outbound address and allows a narrow access list
instead; that is the correct end state.

Note that a permissive entry also admits everyone else. Review the access list
before a deployment is left running unattended.

---

## 2. Backend on Render

Create a new Web Service pointed at this repository.

| Field | Value |
|---|---|
| Root directory | `backend` |
| Build command | `npm ci` |
| Start command | `npm start` |
| Instance type | Free is sufficient for a demo |

Environment variables:

| Key | Value |
|---|---|
| `MONGO_URI` | the rotated Atlas connection string |
| `JWT_SECRET` | a fresh random string, 32+ characters, not reused from anywhere |
| `CORS_ORIGIN` | the Vercel URL, e.g. `https://erp-demo.vercel.app` |
| `PORT` | leave unset, Render provides it |

Generate the JWT secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Note the service URL Render gives you. It is needed in the next step.

**Free tier behaviour:** the service sleeps after roughly 15 minutes without
traffic and takes 30 to 50 seconds to wake. The first request after a quiet
period appears to hang. This is hosting behaviour, not a fault in the
application; mention it to anyone testing the deployment.

---

## 3. Seed the database

From a machine with the rotated `MONGO_URI` in `backend/.env`:

```bash
cd backend
npm run seed              # roles, the three accounts, baseline records
npm run seed:operations   # 6 categories, 32 products, 18 suppliers, 16 orders
npm run seed:commercial   # 30 customers, 48 sales orders, 40 invoices
```

Run them in that order. `seed:operations` needs the accounts to attribute
records to, and `seed:commercial` needs the products to price order lines from;
each one says so and stops rather than guessing if you skip a step.

`npm run seed` also needs `TEST_ADMIN_PASSWORD`, `TEST_MANAGER_PASSWORD` and
`TEST_STAFF_PASSWORD` in `backend/.env`. No account password is stored in the
repository. The script creates missing accounts only and never modifies an
existing one, so it cannot reset a password that is already set — rotation goes
through `PATCH /api/auth/password`.

Both clear their own collections before inserting, so they are safe to run more
than once — but note that "safe" means the result is the same, not that nothing
is lost. Re-running `seed:commercial` during a test window destroys any customer,
order or invoice the testers created. Tell them before you run it.

`seed:operations` reads its fixtures from the frontend module folders so that the
demo data and the mock data cannot drift apart. `seed:commercial` takes its
customers the same way, but builds orders and invoices against the product
documents actually in the database, and calculates every total with the same
arithmetic as the route that would have produced the record — so a total that
does not add up is a bug in the server, not in the seed.

**The seeds connect to MongoDB directly**, so the machine running them must be
on the database's IP access list — not only the API host. If it is not, an
Atlas shared-tier cluster accepts the TCP connection and then rejects the TLS
handshake (`tlsv1 alert internal error`, SSL alert 80), which the driver reports
as a server-selection failure mentioning the IP whitelist. A residential or
mobile connection may change its public address between attempts; if an entry
for the current address stops working, check whether the address has changed.

---

## 4. Frontend on Vercel

Import the same repository as a new project.

| Field | Value |
|---|---|
| Root directory | `frontend` |
| Framework preset | Vite |
| Build command | `npm run build` (from `vercel.json`) |
| Output directory | `dist` |

Environment variables:

| Key | Value |
|---|---|
| `VITE_USE_MOCKS` | `false` |
| `VITE_API_BASE_URL` | `/api` |
| `VITE_APP_ENV` | `production` |

`VITE_USE_MOCKS=false` is the switch that matters. Left at `true`, the browser
intercepts its own API calls and the deployed site never contacts the server at
all, which looks like it works and proves nothing.

**Then point the rewrite at your API.** `frontend/vercel.json` holds the API
service URL as the destination of the `/api/*` rewrite; set it to the Render
service URL from step 2. Commit and push; Vercel redeploys automatically.

Vercel rewrites cannot read environment variables, so this URL is necessarily
committed. It is the API's public address, not a credential — but it does mean
anyone reading the repository can find the API directly, so the API must be
safe to reach without going through the frontend. It is designed to be.

---

## 5. Verify

The smoke test runs against any base URL, so point it at the deployment:

```bash
cd backend
BASE_URL=https://your-service.onrender.com node src/smokeOperations.js
```

It signs in as the three test accounts, so `TEST_ADMIN_PASSWORD`,
`TEST_MANAGER_PASSWORD` and `TEST_STAFF_PASSWORD` must be set in `backend/.env`
or the environment. It exits before making any request if they are not.

45 checks covering authentication, unauthenticated refusal, pagination,
authorisation boundaries, validation, server-managed fields, stock adjustments
and the full purchase order lifecycle. All 45 must pass. Anything else means the
deployment differs from the local environment.

Then check by hand in a browser, because a passing API is not a working page:

- Sign in as each of the three accounts and confirm the sidebar differs
- As administrator, open a product, adjust its stock, confirm the history entry
- Create a purchase order, submit it, approve it, receive part of it
- As staff, type `/products` into the address bar directly and confirm the
  refusal page rather than a blank screen

---

## 6. Custom domain

Optional. In Vercel, Settings, Domains, add the domain and create the CNAME
record it specifies at your registrar. Certificates are issued automatically.
Nothing in the application needs to change, but update `CORS_ORIGIN` on Render
to the new domain.

---

## Rollback

Vercel keeps every previous deployment and any can be promoted to production
from the dashboard. Render redeploys from a previous commit. Neither rollback
touches the database, so a schema change would need reverting separately. There
are none at present.
