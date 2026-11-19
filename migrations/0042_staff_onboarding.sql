-- Staff onboarding: documents each team member signs (or uploads) before using the CRM,
-- and the Owner's identity confirmation. The server blocks everything else until both are done.

-- Document wording, versioned (an edit = a new version; old versions stay forever).
CREATE TABLE staff_docs (
  key         TEXT NOT NULL,
  version     INTEGER NOT NULL,
  title       TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('sign', 'upload')),
  body        TEXT NOT NULL,
  required    INTEGER NOT NULL DEFAULT 1,
  active      INTEGER NOT NULL DEFAULT 1,
  position    INTEGER NOT NULL DEFAULT 99,
  note        TEXT,
  created_at  TEXT NOT NULL,
  created_by  TEXT,
  PRIMARY KEY (key, version)
) STRICT;

-- What each member signed or uploaded. Rows are never edited or deleted (signed records).
CREATE TABLE staff_doc_signatures (
  id            TEXT PRIMARY KEY,
  member_id     TEXT NOT NULL REFERENCES members(id),
  doc_key       TEXT NOT NULL,
  version       INTEGER NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('sign', 'upload')),
  signed_name   TEXT NOT NULL,
  r2_key        TEXT NOT NULL,          -- signed PDF, or the uploaded file
  file_name     TEXT NOT NULL,
  content_type  TEXT NOT NULL,
  text_sha256   TEXT,                   -- hash of the exact wording signed
  ip            TEXT NOT NULL,
  user_agent    TEXT NOT NULL DEFAULT '',
  signed_at     TEXT NOT NULL
) STRICT;
CREATE INDEX staff_doc_signatures_member ON staff_doc_signatures (member_id, doc_key);
CREATE TRIGGER staff_doc_signatures_no_update BEFORE UPDATE ON staff_doc_signatures BEGIN SELECT RAISE(ABORT, 'signed records cannot be changed'); END;
CREATE TRIGGER staff_doc_signatures_no_delete BEFORE DELETE ON staff_doc_signatures BEGIN SELECT RAISE(ABORT, 'signed records cannot be deleted'); END;

-- The Owner confirms each person's identity (live video call + government photo ID).
ALTER TABLE members ADD COLUMN identity_verified_at TEXT;
ALTER TABLE members ADD COLUMN identity_verified_by TEXT;
ALTER TABLE members ADD COLUMN identity_note TEXT NOT NULL DEFAULT '';
