# Deployment

How this project goes live. Written for the pentest handover, but it is the
real procedure.

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

**Rotate the database password.** The connection string was shared through a
chat message during development, which means it exists in a message history and
in at least one notification. Atlas, Database Access, edit the user, set a new
password, then update `MONGO_URI` everywhere it is used. Do this before the API
is reachable from the internet, not after.

---

## 1. MongoDB Atlas

Already provisioned. Two settings matter:

| Setting | Value | Note |
|---|---|---|
| Database user password | rotated, 24+ random characters | see above |
| Network access | `0.0.0.0/0` | required, see below |

Render's free tier gives the service no fixed outbound IP address, so Atlas
cannot allow-list it specifically and has to accept connections from anywhere.
This is a real weakness and it is recorded as such in the pentest handover
rather than hidden. The mitigation is that the only thing standing in front of
the database is the password, so that password must be long and random. On a
paid Render tier this is replaced with a static outbound IP and a narrow
allow-list.

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
period appears to hang. Tell the pentest team this, or they will report it as a
denial-of-service finding.

---

## 3. Seed the database

From a machine with the rotated `MONGO_URI` in `backend/.env`:

```bash
cd backend
npm run seed              # roles, the three accounts, baseline records
npm run seed:operations   # 6 categories, 32 products, 18 suppliers, 16 orders
```

`seed:operations` clears the five operations collections first, so it is safe to
run more than once. It reads its fixtures from the frontend module folders so
that the demo data and the mock data cannot drift apart.

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

**Then edit `frontend/vercel.json`** and replace
`REPLACE-WITH-RENDER-URL.onrender.com` with the Render service URL from step 2.
Commit and push; Vercel redeploys automatically.

---

## 5. Verify

The smoke test runs against any base URL, so point it at the deployment:

```bash
cd backend
BASE_URL=https://your-service.onrender.com node src/smokeOperations.js
```

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
