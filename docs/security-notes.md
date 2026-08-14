# Security notes

Maintained by A, reviewed by all three. Two jobs:

1. Stop us from building false confidence — a frontend check is not a security
   control, and a team that forgets this ships something that looks safe and
   isn't.
2. Be the handover document for the backend team. Every row in section 2 is a
   check they must implement independently.

**Threat model for this project:** an internal ERP holding payroll, supplier
pricing, and customer records. Real ERP data is genuinely sensitive. But this
is an intern build with fake data and no real attackers, so the target is
*"follows standard practice and passes a competent code review,"* not
*"hardened against a nation-state."* OWASP Top 10 is the measuring stick.

---

## 1. The rule

> The frontend runs on the user's machine. They can open devtools, edit the
> JavaScript, disable a check, or ignore the UI entirely and hit the API with
> curl. **Every control that exists only in React is a suggestion.**

Hiding a Delete button from a non-admin is UX. If the server doesn't also reject
the request, there is no security. The failure mode we are specifically avoiding
is `if (user.role === 'admin')` in a component, followed by everyone feeling
safe and nobody adding the server check.

---

## 2. Responsibility split

Left column = what our UI appears to enforce. Right column = what the backend
**must** enforce independently. The right column is the real one.

| Frontend (UX only) | Backend (the actual control) |
|---|---|
| `<Can>` hides buttons and nav items | Authorise every endpoint against the user's permissions, per request |
| Route guard redirects to `/login` | Reject any request without a valid token — 401 |
| Zod validates the form before submit | Re-validate every field server-side — 422 with `fields` |
| Status buttons only shown in valid states | Reject illegal status transitions — 409 |
| Read-only fields rendered disabled | Ignore/reject server-managed fields in the request body |
| Totals previewed optimistically | Calculate all money server-side; never trust client totals |
| Numeric inputs bounded | Enforce ranges, reject negative quantities and prices |
| Only my-permission modules in the sidebar | Scope every list query to what the user may see |
| SKU uniqueness hinted after blur | Enforce uniqueness with a DB constraint — 409 |
| File input restricted by accept + size | Validate MIME by content, cap size, strip metadata, serve from a separate origin |

**Rule of thumb for B and C:** for every `permission=` you write and every Zod
rule you add, there must be a corresponding line in this table. If you add one,
add the row.

---

## 3. What we own on the frontend

These are genuinely ours. The backend cannot fix them for us.

### XSS — the one real frontend vulnerability

If an attacker runs script in our page, they *are* the logged-in user and every
backend control is bypassed. React escapes output by default, so this reduces to
a short list:

- **No `dangerouslySetInnerHTML`.** Enforced by `react/no-danger` as an ESLint
  **error**, so it fails CI. The rule is never disabled, including "just this
  once for the invoice notes field."
- No `innerHTML`, no building DOM from strings, no `eval`, no `new Function`.
- Never put user input into an `href` without checking the scheme —
  `javascript:` URLs are a real vector. A provides `safeUrl()` in `lib/`.
- If rich text is ever needed, it goes through DOMPurify with an allow-list, and
  that decision comes to the group first.

### Nothing secret in the bundle

Everything in our source and every `VITE_*` variable ships to the browser as
readable text. No API keys, no credentials, no internal URLs that matter.
`.env` is gitignored; `.env.example` is committed with empty values.

### Dependencies

The most likely way a project like this actually gets compromised is a malicious
npm package.

- Lockfile committed. `npm ci` in CI, never `npm install`.
- `npm audit --audit-level=high` runs in CI.
- New dependency in `components/ui`, `lib`, or `app` requires all three to agree.
- Check weekly downloads and last-publish date before adding anything. A package
  with 200 downloads a week is a liability.
- shadcn/ui was chosen partly for this: components are copied into our repo
  rather than pulled from npm, so they can't be swapped under us in a later
  release.

### Token handling

Decided, not negotiable (see `docs/api-contract.md` §3):

- Access token in memory, in React state. **Never localStorage** — that is
  readable by any injected script, which turns an XSS into a permanent account
  takeover.
- Refresh token in an httpOnly, Secure, SameSite=Strict cookie. JS never sees it.
- Logout clears in-memory state *and* calls `/auth/logout` so the server
  invalidates the refresh token. Clearing client state alone is not a logout.
- Auto-logout after 30 minutes idle, with a warning at 28. ERP sessions get left
  open on shared office machines — this is a realistic risk, not theatre.

### Not leaking data in the UI

- Error toasts show the server's `message` field only — never a raw response
  body or stack trace.
- No `console.log` of user data, tokens, or full API responses in committed
  code. ESLint warns on `console` outside `console.error`.
- Sensitive fields (bank details, salary, if they ever appear) are masked by
  default with an explicit reveal action.

### Fake data only

Every mock record is obviously invented: `Acme Trading PLC`,
`+251-900-000-001`, `@example-erp.test`. No real people, no real companies,
nothing copied from an actual business. Fake data in a public repo is a
non-event; real data in a public repo is an incident that follows you.

---

## 4. Backend handover checklist

Hand this section, `entities.md`, and each module's `schema.js` to whoever builds
the API.

**Authentication**
- [ ] Don't roll your own. Use a maintained library or provider. Hand-rolled
      session logic is the single most common way student and intern projects
      fail, and it fails silently — it looks like it works.
- [ ] Argon2id or bcrypt (cost ≥ 12). Never MD5, SHA-1, or plain SHA-256.
- [ ] Access token 15 min; refresh token rotated on use, revocable, and reuse of
      a rotated token invalidates the family.
- [ ] Rate limit login: per-IP and per-account, with backoff.
- [ ] Identical response and timing for unknown email vs wrong password.
- [ ] Password reset tokens single-use, 30-minute expiry, invalidated on use.

**Authorisation**
- [ ] Check permissions on **every** endpoint, including GET.
- [ ] Object-level checks, not just route-level — can *this* user see *this*
      customer? (OWASP calls this Broken Object Level Authorization; it is the
      #1 API vulnerability and the easiest to miss.)
- [ ] Deny by default. New endpoint with no explicit permission = 403.
- [ ] 404 rather than 403 where existence itself is sensitive.

**Input**
- [ ] Validate and re-validate everything, mirroring the Zod schemas.
- [ ] Parameterised queries / ORM only. No string-concatenated SQL, ever.
- [ ] Allow-list which fields a PATCH may touch — mass assignment protection.
      A user must not be able to PATCH their own `roleId`.
- [ ] Cap `perPage` server-side at 100 regardless of what the client sends.

**Transport and headers**
- [ ] HTTPS only, HSTS on.
- [ ] CSRF protection on all state-changing requests (we use a cookie, so this
      is required): SameSite=Strict plus an Origin check, or double-submit token.
- [ ] CORS allow-list of exact origins. Never `*` with credentials.
- [ ] Content-Security-Policy — this is the backstop that limits damage if XSS
      ever gets through.
- [ ] `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
      `X-Frame-Options: DENY`.

**Data**
- [ ] Audit log on every create/update/delete/approve: who, what, when, before,
      after. Non-negotiable for an ERP — approvals and stock adjustments are
      exactly the things people dispute later.
- [ ] Soft-delete business records. A deleted customer with historical invoices
      must remain resolvable.
- [ ] Encryption at rest for the database.
- [ ] Backups, and at least one tested restore.
- [ ] Generic 500 responses. No stack traces, no SQL, no library versions.

---

## 5. Our own checklist before the demo

- [ ] `npm audit` clean at high and above
- [ ] No `dangerouslySetInnerHTML` anywhere — grep it
- [ ] No secrets in the repo — grep for `key`, `secret`, `password`, `token` in
      committed files
- [ ] `.env` gitignored, `.env.example` present
- [ ] No real personal data in any mock file
- [ ] Every `<Can permission="...">` has a matching row in section 2
- [ ] Token in memory, not localStorage — check devtools Application tab
- [ ] Logout clears state and redirects
- [ ] Direct-URL access to a module the user lacks permission for lands on 403,
      not a blank page
- [ ] Idle timeout works
- [ ] No user data in console output

---

## 6. What we are explicitly not doing

Named so nobody burns a week on it: penetration testing, WAF, 2FA/MFA, SSO/SAML,
field-level encryption, intrusion detection, compliance certification. All
legitimate for a production ERP. None of them belong in a three-week intern
frontend with mock data. If the intern leader asks for one, it becomes a scoped
task with an owner — not something we bolt on quietly.
