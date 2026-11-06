# MKB Business Suite — Backend (Phase 3)

Status: **foundation + Clients, Leads, Team & Permissions and Forms connected; tested locally. Not deployed. No cloud resources created.**

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

## Connected modules

| Module | Status |
| --- | --- |
| **Clients** | Connected. The list and profiles load from the database (only records the person may open); creating a client, editing details, services, team assignment, notes and the timeline are saved to the database. Full SSN/EIN/date of birth are sent once when entered, encrypted on arrival, and never sent back except through the audited reveal. Documents, messages, appointments, invoices and signatures are saved with the client for now and move to their own tables when the Documents, Messages and Billing modules are connected. |
| **Leads** | Connected. Pipeline, stages and sources, notes, reminders, owner changes, marking lost/reopening and conversion to a client are saved to the database. |
| **Team & Permissions** | Connected. The team, roles, departments, invitations (sent by email, resend replaces the old link, cancel), access requests (sensitive access approved only by the Owner), profiles, selected records, access reviews, onboarding, offboarding (deactivates, never deletes), sessions (sign out one device or all) and the security policy all load from and save to the database. The audit log shown is the server's. People without Team access only receive their own record. |
| **Forms** | Connected. Forms are built and published in the database (publishing is refused on the server if a question would collect sensitive information). The public page `/f/<link-name>` loads the published form from the server and submissions become leads: matched to an existing client or open lead by email/phone (no duplicates), otherwise a new lead for the form's owner and stage with a follow-up reminder. Public submissions need no sign-in but are rate-limited (10 per 10 minutes per address), have a spam trap, never return any record, and never reveal whether the person was already known. |
| Tax, Bookkeeping, Business Services, Expungement screens | Still use in-browser sample data (next). |

How saving works: the screens keep working instantly and save each change in the
background. Every save names the version it started from; if someone else saved
first, the save is refused and the latest version is loaded, with a notice — no one
silently overwrites a colleague. The server checks each kind of change separately:
details and notes need "edit", the client's team needs "assign", creating needs
"create", and Senior Staff can only touch clients assigned to them. Note authors and
timeline entries are recorded as the signed-in person, whatever the browser says.
Deleted notes are hidden but kept; the client and lead timelines are append-only.

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

- Team & Forms with the backend on (8 browser checks): directory and audit log from the server; a role
  change, an invitation and the security policy survive a reload; a new form is built, published and
  tested; a signed-out visitor's public submission becomes a real lead for the right owner.
- Team & Forms API (14 checks): limited team view for people without Team access, roles can't be
  escalated (Owner-only and unheld permissions stripped; Owner and same-level roles locked), department
  settings permission, Owner-only approval of sensitive access (then the reveal is allowed), own-profile
  limits, invitation resend/cancel, offboarding order and deactivation, form permissions, public view
  hides internal settings, public submissions create/match leads, spam trap, consent required,
  publishing blocked for sensitive questions, rate limiting, signing out one device.
- Clients & Leads with the backend on (8 browser checks): server-scoped client list; a new client,
  a note, a lead stage change and a lead conversion all survive a full reload; full identifiers
  never appear in the page; reveal refused by the server for a role without the Tax department;
  two people editing the same client — the second save is refused and the latest version loads.
- Clients & Leads API (10 checks): full records with masked identifiers, encrypted creation,
  duplicate ID/email refused, revision conflicts, note authorship from the session, hidden-not-
  deleted notes, append-only timeline, per-change permissions (Senior Staff edit vs. assign),
  lead permissions, conversion rules, pipeline settings, client-portal accounts blocked.
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
