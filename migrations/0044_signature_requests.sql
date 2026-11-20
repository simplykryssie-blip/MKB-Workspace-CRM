-- Documents sent to a client to read and sign online (private link, no login).
-- The exact text signed is kept with the request; the signed PDF goes to the client's Documents.
CREATE TABLE signature_requests (
  id            TEXT PRIMARY KEY,
  client_id     TEXT NOT NULL REFERENCES clients(id),
  service       TEXT NOT NULL CHECK (service IN ('tax', 'books', 'biz', 'expunge')),
  kind          TEXT NOT NULL CHECK (kind IN ('engagement', 'records_release', 'custom', 'intake')),
  title         TEXT NOT NULL,
  parts         TEXT NOT NULL DEFAULT '[]',   -- [{ title, body, version }] — the exact text shown and signed
  ref_id        TEXT,                         -- intake id (kind = intake)
  letter_key    TEXT,                         -- engagement letter key + versions (kind = engagement)
  message       TEXT,
  email         TEXT,
  status        TEXT NOT NULL CHECK (status IN ('sent', 'signed', 'cancelled')),
  signed_name   TEXT,
  signed_at     TEXT,
  pdf_file_id   TEXT,
  history       TEXT NOT NULL DEFAULT '[]',
  created_at    TEXT NOT NULL,
  created_by    TEXT REFERENCES members(id),
  updated_at    TEXT NOT NULL
);
CREATE INDEX signature_requests_client ON signature_requests (client_id, created_at);
CREATE INDEX signature_requests_status ON signature_requests (status, created_at);
