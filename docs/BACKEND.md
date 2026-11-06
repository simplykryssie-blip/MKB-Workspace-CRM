# MKB Business Suite — Backend (Phase 3)

Status: **foundation built and tested locally. Not deployed. No cloud resources created.**

The backend runs on Cloudflare: the Next.js app is compiled into a Cloudflare
Worker (OpenNext), data lives in **D1** (SQLite), files will live in **R2**, and
email goes through **Resend**. Everything below runs locally against Cloudflare's
own local runtime and database — nothing touches a real account yet.

## What's built (foundation)

| Area | What it does |
| --- | --- |
| Database schema | `migrations/0001_foundation.sql`: roles, team members, departments, invitations, access requests, security policy, clients (core), services, record assignments, encrypted identifier vault, sign-in accounts, sessions, one-time tokens, rate limits, audit log, email outbox. |
| Permissions | `lib/team/policy.ts` — the exact rules approved in Team & Permissions, used by the interface **and** enforced by the server on every request, from database records only. |
| Sign-in | Email + password (PBKDF2-SHA256, 100,000 iterations — the Workers maximum), authenticator-app MFA (TOTP, replay-protected) required for Owner/Administrator/Manager by default, lockout after failed attempts, idle timeout from the security policy, 12-hour maximum session, sign-out everywhere on password reset or suspension. |
| Sessions | 256-bit random token in an HttpOnly, SameSite=Lax (Secure on HTTPS) cookie; only a SHA-256 hash is stored. |
| Sensitive data | SSN/ITIN, EIN, date of birth (and later bank numbers) are encrypted with AES-256-GCM, bound to their record. Only the last four digits are stored in plain text. Reveal is a POST that needs both record access and the separate reveal permission, is rate-limited, and is always audited (successes and denials). Values are never written to the audit log. |
| Audit log | Append-only — the database itself rejects edits and deletes. |
| Request safety | State-changing requests must be JSON from the app's own origin (blocks cross-site requests); bodies capped at 64 KB; unexpected errors are hidden from callers; security headers (no framing except public forms, HSTS, nosniff, referrer and permissions policies). |
| Email | Resend when `RESEND_API_KEY` is set; otherwise every email is recorded in `email_outbox` (bodies kept only in development). |
| APIs | `app/api/auth/*` (sign-in, MFA, sign-out, session, password reset, invitations), `app/api/team/*` (members, invitations, role/department/grant changes, suspend/reactivate/unlock/sign-out, audit log, security policy), `app/api/clients/*` (scoped list, record, reveal/update identifiers). |
| Screens | `/login` (sign-in, MFA setup with QR code, MFA code, forgot password), `/login/reset`, `/login/invite`. With `NEXT_PUBLIC_BACKEND=1`, staff pages send signed-out visitors to `/login`. |

The modules' screens (Clients, Leads, Tax, Bookkeeping, Business Services,
Expungement, Forms) still use the in-browser sample data. They are connected to
the backend module by module next.

## Run it locally

```bash
cp dev.vars.example .dev.vars          # then fill in ENCRYPTION_KEY and DEV_SEED_PASSWORD
npx wrangler d1 migrations apply DB --local
NEXT_PUBLIC_BACKEND=1 npx next dev -p 3100
curl -X POST -H "origin: http://localhost:3100" -H "content-type: application/json" http://localhost:3100/api/dev/seed
```

Sign in at http://localhost:3100/login with any sample team member's email and
the `DEV_SEED_PASSWORD`. Owner, Administrator and Manager accounts are asked to
set up an authenticator app on first sign-in. The seed endpoint only works when
`APP_ENV=development` and the database is empty. To start over, delete
`.wrangler/state` and re-run the migration.

Run inside Cloudflare's actual runtime: `npx opennextjs-cloudflare build && npx wrangler dev`.

## Tests

- Backend security suite (20 checks): signed-out access, generic sign-in errors, MFA required and
  replay-protected, record-level access and denials audited, SSN reveal/update permissions,
  admin limits (no Owner assignment, no self-escalation, grants limited to what you hold, department
  still required), invitations with one-time hashed tokens, immediate sign-out on suspension,
  lockout and unlock, password reset, client-portal isolation, Owner-only security policy,
  encryption at rest, append-only audit log, server-side sign-out.
- Sign-in screens (5 checks), including MFA setup with a real authenticator code.
- All 10 existing interface suites (217 checks) still pass.

## Before anything goes live (needs your approval)

1. **Create resources** (Cloudflare account): a D1 database and an R2 bucket for a *protected
   preview* environment; put their IDs in `wrangler.jsonc` (the current ID is a local placeholder,
   so this branch must not be merged to `main` before then).
2. **Secrets** (`wrangler secret put`): `ENCRYPTION_KEY` (32 random bytes, base64 — store a copy in a
   password manager; losing it makes encrypted fields unreadable), `RESEND_API_KEY`, `EMAIL_FROM`,
   `APP_ORIGIN`. Set `APP_ENV=production` and `BACKEND_ENABLED=true` for that environment.
3. **Workers Paid plan (about $5/month)**: password hashing needs more CPU time per request than the
   free plan's 10 ms limit allows.
4. **Resend**: verify the sending domain (SPF/DKIM) for MKB's email address.
5. **Cloudflare Access** on the preview URL until launch.
6. **Before real client data**: an independent security review, D1 backups / Time Travel confirmed,
   an encryption-key rotation plan (`key_version` is stored with every encrypted value), a data
   retention policy, and the IRS safeguards expected of a tax preparer (written information
   security plan).

## Known follow-ups

- Dependency advisories reported by `npm audit` are in build tooling (OpenNext's minifier and
  Next.js's bundled PostCSS), not in code that runs in production; update when patched versions
  are released.
- A Content-Security-Policy for scripts is not yet set (only framing is restricted).
