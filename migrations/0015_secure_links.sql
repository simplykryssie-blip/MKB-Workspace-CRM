-- Private links that let a client fill in one form (e.g. a bookkeeping intake)
-- without a portal login. Only a SHA-256 hash of the token is stored. A link
-- works for one record only, expires, can be cancelled, and stops once used.
-- `purpose` names the form (books_intake today; tax interviews and others later).
CREATE TABLE secure_links (
  id             TEXT PRIMARY KEY,
  token_hash     TEXT NOT NULL UNIQUE,
  purpose        TEXT NOT NULL,
  target_id      TEXT NOT NULL,
  client_id      TEXT NOT NULL REFERENCES clients(id),
  email          TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  created_by     TEXT NOT NULL,
  expires_at     TEXT NOT NULL,
  revoked_at     TEXT,
  revoked_by     TEXT,
  used_at        TEXT,
  first_opened_at TEXT,
  last_opened_at TEXT
) STRICT;
CREATE INDEX secure_links_target ON secure_links (purpose, target_id, created_at);
