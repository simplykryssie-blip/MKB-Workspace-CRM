-- Staff-edited wording for automatic client emails (defaults live in code).
CREATE TABLE email_templates (
  key         TEXT PRIMARY KEY,
  data        TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  updated_by  TEXT
);

-- Files stored in the private R2 bucket for a client's documents. The
-- document's details live on the client record; the storage key lives only
-- here, so a browser can never point a document at someone else's file.
CREATE TABLE client_files (
  id            TEXT PRIMARY KEY,
  client_id     TEXT NOT NULL REFERENCES clients(id),
  r2_key        TEXT NOT NULL,
  name          TEXT NOT NULL,
  content_type  TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  sensitive     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  created_by    TEXT
);
CREATE INDEX client_files_client ON client_files (client_id);
