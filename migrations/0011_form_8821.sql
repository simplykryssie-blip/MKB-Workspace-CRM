-- IRS Form 8821 (Tax Information Authorization) for each tax client.
-- The filled form is generated on demand from the client record; the full
-- SSN/EIN is never stored here.
CREATE TABLE tax_8821 (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL REFERENCES clients(id),
  status          TEXT NOT NULL CHECK (status IN ('needs_signature', 'signed', 'submitted', 'on_file', 'revoked')),
  years_from      INTEGER NOT NULL,
  years_to        INTEGER NOT NULL,
  matters         TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  created_by      TEXT,
  signed_at       TEXT,
  signer_name     TEXT,
  signer_title    TEXT,
  sign_method     TEXT,
  id_check        TEXT,
  recorded_by     TEXT,
  copy_file_id    TEXT,
  submitted_at    TEXT,
  submitted_by    TEXT,
  on_file_at      TEXT,
  revoked_at      TEXT,
  note            TEXT,
  updated_at      TEXT NOT NULL
);
CREATE INDEX tax_8821_client ON tax_8821 (client_id);
