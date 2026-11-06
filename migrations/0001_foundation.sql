-- MKB Business Suite — foundation schema (Cloudflare D1 / SQLite).
-- Identity, roles and permissions, sessions, audit log, clients core,
-- encrypted identifier vault, record assignments, email outbox.
-- Times are ISO-8601 UTC strings. JSON columns hold arrays/objects.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- roles & team
CREATE TABLE roles (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE COLLATE NOCASE,
  description     TEXT NOT NULL DEFAULT '',
  kind            TEXT NOT NULL CHECK (kind IN ('system', 'custom')),
  level           INTEGER NOT NULL,
  is_owner        INTEGER NOT NULL DEFAULT 0,
  is_client       INTEGER NOT NULL DEFAULT 0,
  all_departments INTEGER NOT NULL DEFAULT 0,
  scope           TEXT NOT NULL CHECK (scope IN ('all_departments', 'assigned', 'team', 'selected')),
  max_sensitivity TEXT NOT NULL CHECK (max_sensitivity IN ('standard', 'confidential', 'restricted')),
  perms           TEXT NOT NULL DEFAULT '{}',
  record_types    TEXT NOT NULL DEFAULT '{}',
  sensitive       TEXT NOT NULL DEFAULT '[]',
  caps            TEXT NOT NULL DEFAULT '[]',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
) STRICT;

CREATE TABLE members (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  initials              TEXT NOT NULL,
  title                 TEXT NOT NULL DEFAULT '',
  email                 TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone                 TEXT NOT NULL DEFAULT '',
  role_id               TEXT NOT NULL REFERENCES roles(id),
  status                TEXT NOT NULL CHECK (status IN ('invited', 'active', 'suspended', 'deactivated')),
  manager_id            TEXT REFERENCES members(id),
  grants                TEXT NOT NULL DEFAULT '[]',
  selected_client_ids   TEXT NOT NULL DEFAULT '[]',
  onboarding            TEXT NOT NULL DEFAULT '{}',
  offboarding           TEXT,
  last_access_review_at TEXT,
  added_at              TEXT NOT NULL
) STRICT;
CREATE INDEX members_role ON members(role_id);
CREATE INDEX members_manager ON members(manager_id);

CREATE TABLE member_departments (
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  dept      TEXT NOT NULL CHECK (dept IN ('tax', 'books', 'biz', 'exp', 'admin', 'support')),
  PRIMARY KEY (member_id, dept)
) STRICT;

CREATE TABLE departments (
  key        TEXT PRIMARY KEY CHECK (key IN ('tax', 'books', 'biz', 'exp', 'admin', 'support')),
  manager_id TEXT REFERENCES members(id),
  reporting  INTEGER NOT NULL DEFAULT 1,
  modules    TEXT NOT NULL DEFAULT '[]',
  workflow   TEXT NOT NULL DEFAULT '{}'
) STRICT;

CREATE TABLE invitations (
  id          TEXT PRIMARY KEY,
  member_id   TEXT NOT NULL REFERENCES members(id),
  email       TEXT NOT NULL COLLATE NOCASE,
  token_hash  TEXT UNIQUE,
  sent_at     TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  invited_by  TEXT NOT NULL REFERENCES members(id),
  resent_at   TEXT
) STRICT;

CREATE TABLE access_requests (
  id           TEXT PRIMARY KEY,
  member_id    TEXT NOT NULL REFERENCES members(id),
  kind         TEXT NOT NULL CHECK (kind IN ('sensitive', 'module', 'record')),
  target       TEXT NOT NULL,
  reason       TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied')),
  requested_at TEXT NOT NULL,
  decided_by   TEXT REFERENCES members(id),
  decided_at   TEXT,
  note         TEXT
) STRICT;

CREATE TABLE security_settings (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  data       TEXT NOT NULL,
  updated_at TEXT,
  updated_by TEXT REFERENCES members(id)
) STRICT;

-- ---------------------------------------------------------------- clients (core)
CREATE TABLE clients (
  id                TEXT PRIMARY KEY,
  type              TEXT NOT NULL CHECK (type IN ('individual', 'business')),
  name              TEXT NOT NULL,
  contact_name      TEXT,
  email             TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
  phone             TEXT NOT NULL DEFAULT '',
  preferred_contact TEXT NOT NULL DEFAULT 'Email',
  address           TEXT NOT NULL DEFAULT '{}',
  business          TEXT,
  status            TEXT NOT NULL,
  portal            TEXT NOT NULL DEFAULT 'not_invited',
  tags              TEXT NOT NULL DEFAULT '[]',
  source            TEXT NOT NULL DEFAULT '',
  lead_id           TEXT,
  since             TEXT NOT NULL,
  last_activity_at  TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
) STRICT;
CREATE INDEX clients_email ON clients(email);
CREATE INDEX clients_phone ON clients(phone);

CREATE TABLE client_services (
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service   TEXT NOT NULL CHECK (service IN ('tax', 'books', 'biz', 'expunge')),
  PRIMARY KEY (client_id, service)
) STRICT;

-- Every place a team member is assigned to a client (client team, tax preparer,
-- bookkeeper, request owner, case worker...). Modules write here; record-level
-- access ("assigned records only") reads from here.
CREATE TABLE record_assignments (
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id),
  source    TEXT NOT NULL,
  record_id TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (client_id, member_id, source, record_id)
) STRICT;
CREATE INDEX assignments_member ON record_assignments(member_id);

-- Encrypted identifiers (SSN/ITIN, EIN, date of birth, bank numbers). Only the
-- last four digits are ever stored in plain text. Ciphertext is AES-256-GCM
-- with the record's identity as additional data, so it can't be moved to
-- another record.
CREATE TABLE vault (
  owner_type  TEXT NOT NULL,
  owner_id    TEXT NOT NULL,
  field       TEXT NOT NULL,
  ciphertext  TEXT NOT NULL,
  iv          TEXT NOT NULL,
  key_version INTEGER NOT NULL,
  last4       TEXT,
  kind        TEXT,
  updated_at  TEXT NOT NULL,
  updated_by  TEXT NOT NULL,
  PRIMARY KEY (owner_type, owner_id, field)
) STRICT;

-- ---------------------------------------------------------------- sign-in
CREATE TABLE users (
  id                  TEXT PRIMARY KEY,
  email               TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash       TEXT,
  kind                TEXT NOT NULL CHECK (kind IN ('staff', 'client')),
  member_id           TEXT UNIQUE REFERENCES members(id),
  client_id           TEXT UNIQUE REFERENCES clients(id),
  status              TEXT NOT NULL CHECK (status IN ('pending', 'active', 'disabled')),
  mfa_secret_enc      TEXT,
  mfa_secret_iv       TEXT,
  mfa_enabled         INTEGER NOT NULL DEFAULT 0,
  mfa_last_step       INTEGER NOT NULL DEFAULT 0,
  failed_attempts     INTEGER NOT NULL DEFAULT 0,
  locked_until        TEXT,
  password_changed_at TEXT,
  last_login_at       TEXT,
  created_at          TEXT NOT NULL,
  CHECK ((kind = 'staff' AND member_id IS NOT NULL AND client_id IS NULL) OR (kind = 'client' AND client_id IS NOT NULL AND member_id IS NULL))
) STRICT;

-- Session tokens are stored only as SHA-256 hashes.
CREATE TABLE sessions (
  id_hash      TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  mfa_verified INTEGER NOT NULL DEFAULT 0,
  revoked_at   TEXT,
  ip           TEXT,
  user_agent   TEXT
) STRICT;
CREATE INDEX sessions_user ON sessions(user_id);

-- One-time tokens (password reset, invitation acceptance), hashed.
CREATE TABLE auth_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose    TEXT NOT NULL CHECK (purpose IN ('reset', 'invite')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at    TEXT
) STRICT;

CREATE TABLE rate_limits (
  key          TEXT PRIMARY KEY,
  count        INTEGER NOT NULL,
  window_start TEXT NOT NULL
) STRICT;

-- ---------------------------------------------------------------- audit log
-- Append-only: the triggers below reject every UPDATE and DELETE.
CREATE TABLE audit_events (
  id              TEXT PRIMARY KEY,
  at              TEXT NOT NULL,
  actor_user_id   TEXT,
  actor_member_id TEXT,
  actor_client_id TEXT,
  action          TEXT NOT NULL,
  resource        TEXT NOT NULL,
  department      TEXT,
  meta            TEXT,
  success         INTEGER NOT NULL,
  ip              TEXT
) STRICT;
CREATE INDEX audit_at ON audit_events(at);
CREATE INDEX audit_action ON audit_events(action);
CREATE INDEX audit_actor ON audit_events(actor_member_id);
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;

-- ---------------------------------------------------------------- email
-- Every email the system sends. Bodies are kept only in development (they may
-- contain one-time links); production keeps the template and recipient only.
CREATE TABLE email_outbox (
  id          TEXT PRIMARY KEY,
  to_email    TEXT NOT NULL,
  template    TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body_dev    TEXT,
  created_at  TEXT NOT NULL,
  sent_at     TEXT,
  provider_id TEXT,
  error       TEXT
) STRICT;
