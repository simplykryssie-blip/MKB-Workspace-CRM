-- Clients (full record) and Leads.

-- Revision number for safe concurrent editing: a save must name the revision
-- it started from, so one person can't silently overwrite another's changes.
ALTER TABLE clients ADD COLUMN rev INTEGER NOT NULL DEFAULT 1;
-- Documents, messages, appointments, invoices and signatures stay together here
-- until the Documents (R2 files), Messages and Billing modules get their own tables.
ALTER TABLE clients ADD COLUMN module_data TEXT NOT NULL DEFAULT '{}';
ALTER TABLE clients ADD COLUMN preferred_contact_note TEXT;

CREATE TABLE client_enrollments (
  id         TEXT PRIMARY KEY,
  client_id  TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service    TEXT NOT NULL CHECK (service IN ('tax', 'books', 'biz', 'expunge')),
  title      TEXT NOT NULL,
  stage      TEXT NOT NULL,
  progress   INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL CHECK (status IN ('active', 'waiting_on_client', 'in_review', 'complete', 'on_hold', 'cancelled')),
  staff_id   TEXT NOT NULL,
  started_at TEXT NOT NULL,
  due_at     TEXT,
  fee        REAL NOT NULL DEFAULT 0
) STRICT;
CREATE INDEX enrollments_client ON client_enrollments(client_id);

-- Internal notes. Deleting a note hides it; the text is kept for history.
CREATE TABLE client_notes (
  id         TEXT PRIMARY KEY,
  client_id  TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL,
  body       TEXT NOT NULL,
  service    TEXT,
  pinned     INTEGER NOT NULL DEFAULT 0,
  at         TEXT NOT NULL,
  deleted_at TEXT,
  deleted_by TEXT
) STRICT;
CREATE INDEX notes_client ON client_notes(client_id);

-- Client timeline (what happened on the record). Append-only.
CREATE TABLE client_activity (
  id        TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  kind      TEXT NOT NULL,
  text      TEXT NOT NULL,
  actor     TEXT NOT NULL CHECK (actor IN ('client', 'staff', 'system')),
  member_id TEXT,
  at        TEXT NOT NULL
) STRICT;
CREATE INDEX activity_client ON client_activity(client_id, at);
CREATE TRIGGER client_activity_no_update BEFORE UPDATE ON client_activity BEGIN SELECT RAISE(ABORT, 'activity history is append-only'); END;

-- ---------------------------------------------------------------- leads
CREATE TABLE lead_stages (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  position INTEGER NOT NULL
) STRICT;

CREATE TABLE lead_sources (
  name     TEXT PRIMARY KEY,
  position INTEGER NOT NULL
) STRICT;

CREATE TABLE leads (
  id                  TEXT PRIMARY KEY,
  type                TEXT NOT NULL CHECK (type IN ('individual', 'business')),
  name                TEXT NOT NULL,
  contact_name        TEXT,
  email               TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
  phone               TEXT NOT NULL DEFAULT '',
  address             TEXT,
  business            TEXT,
  source              TEXT NOT NULL,
  source_detail       TEXT,
  interests           TEXT NOT NULL DEFAULT '[]',
  est_value           REAL NOT NULL DEFAULT 0,
  owner_id            TEXT NOT NULL REFERENCES members(id),
  stage_id            TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('open', 'converted', 'lost')),
  priority            TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  tags                TEXT NOT NULL DEFAULT '[]',
  lost_reason         TEXT,
  converted_client_id TEXT REFERENCES clients(id),
  converted_at        TEXT,
  created_at          TEXT NOT NULL,
  last_activity_at    TEXT NOT NULL,
  rev                 INTEGER NOT NULL DEFAULT 1
) STRICT;
CREATE INDEX leads_email ON leads(email);
CREATE INDEX leads_owner ON leads(owner_id);

CREATE TABLE lead_notes (
  id         TEXT PRIMARY KEY,
  lead_id    TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL,
  body       TEXT NOT NULL,
  pinned     INTEGER NOT NULL DEFAULT 0,
  at         TEXT NOT NULL,
  deleted_at TEXT,
  deleted_by TEXT
) STRICT;
CREATE INDEX lead_notes_lead ON lead_notes(lead_id);

CREATE TABLE lead_reminders (
  id       TEXT PRIMARY KEY,
  lead_id  TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  at       TEXT NOT NULL,
  note     TEXT NOT NULL,
  done     INTEGER NOT NULL DEFAULT 0,
  owner_id TEXT NOT NULL
) STRICT;
CREATE INDEX lead_reminders_lead ON lead_reminders(lead_id);

CREATE TABLE lead_activity (
  id        TEXT PRIMARY KEY,
  lead_id   TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  kind      TEXT NOT NULL,
  text      TEXT NOT NULL,
  actor     TEXT NOT NULL CHECK (actor IN ('client', 'staff', 'system')),
  member_id TEXT,
  at        TEXT NOT NULL
) STRICT;
CREATE INDEX lead_activity_lead ON lead_activity(lead_id, at);
CREATE TRIGGER lead_activity_no_update BEFORE UPDATE ON lead_activity BEGIN SELECT RAISE(ABORT, 'activity history is append-only'); END;
