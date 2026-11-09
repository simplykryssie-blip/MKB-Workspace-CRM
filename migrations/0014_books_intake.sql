-- Bookkeeping client intake (guided questionnaire). The EIN is stored in the
-- client vault; accounts are last 4 digits only.
CREATE TABLE books_intakes (
  id            TEXT PRIMARY KEY,
  client_id     TEXT NOT NULL REFERENCES clients(id),
  status        TEXT NOT NULL CHECK (status IN ('in_progress', 'submitted')),
  answers       TEXT NOT NULL DEFAULT '{}',
  step          INTEGER NOT NULL DEFAULT 0,
  entered_by    TEXT NOT NULL DEFAULT 'staff',
  consent_name  TEXT,
  engagement    TEXT,
  submitted_at  TEXT,
  workspace_id  TEXT,
  history       TEXT NOT NULL DEFAULT '[]',
  created_at    TEXT NOT NULL,
  created_by    TEXT,
  updated_at    TEXT NOT NULL,
  rev           INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX books_intakes_client ON books_intakes (client_id);
