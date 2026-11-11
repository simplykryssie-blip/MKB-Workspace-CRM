-- Private-link intakes for payroll, Business Solutions and MKB Record Relief
-- (the bookkeeping intake and tax interview have their own tables).
CREATE TABLE service_intakes (
  id            TEXT PRIMARY KEY,
  client_id     TEXT NOT NULL REFERENCES clients(id),
  kind          TEXT NOT NULL CHECK (kind IN ('payroll', 'biz', 'relief')),
  status        TEXT NOT NULL CHECK (status IN ('in_progress', 'submitted')),
  answers       TEXT NOT NULL DEFAULT '{}',
  step          INTEGER NOT NULL DEFAULT 0,
  entered_by    TEXT NOT NULL DEFAULT 'client',
  consent_name  TEXT,
  submitted_at  TEXT,
  pdf_file_id   TEXT,
  history       TEXT NOT NULL DEFAULT '[]',
  created_at    TEXT NOT NULL,
  created_by    TEXT,
  updated_at    TEXT NOT NULL,
  rev           INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX service_intakes_client ON service_intakes (client_id, kind);
