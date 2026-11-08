-- Bookkeeping: one workspace per client business. QuickBooks stays the system
-- of record (no transactions or balances of record here, no QuickBooks tokens);
-- this tracks MKB's monthly review, reconciliation and close. Bank and card
-- accounts are stored with their last four digits only.
CREATE TABLE books_workspaces (
  id            TEXT PRIMARY KEY,
  client_id     TEXT NOT NULL REFERENCES clients(id),
  enrollment_id TEXT,
  business_name TEXT NOT NULL,
  entity_type   TEXT NOT NULL DEFAULT '',
  bookkeeper_id TEXT NOT NULL,
  reviewer_id   TEXT NOT NULL,
  service       TEXT NOT NULL,
  extras        TEXT NOT NULL DEFAULT '[]',
  qbo           TEXT NOT NULL,
  accounts      TEXT NOT NULL DEFAULT '[]',
  months        TEXT NOT NULL DEFAULT '[]',
  tasks         TEXT NOT NULL DEFAULT '[]',
  notes         TEXT NOT NULL DEFAULT '[]',
  activity      TEXT NOT NULL DEFAULT '[]',
  started_at    TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  rev           INTEGER NOT NULL DEFAULT 1
) STRICT;
CREATE INDEX books_workspaces_client ON books_workspaces(client_id);
