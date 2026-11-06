-- Tax Preparation: returns and the fee schedule.
-- Interview answers are stored with the return; sensitive answers (SSNs, EINs,
-- bank numbers) are NOT — only their last four digits are, and the full values
-- go to the encrypted vault (owner_type 'tax_return').
CREATE TABLE tax_returns (
  id                    TEXT PRIMARY KEY,
  client_id             TEXT NOT NULL REFERENCES clients(id),
  enrollment_id         TEXT,
  tax_year              INTEGER NOT NULL,
  kind                  TEXT NOT NULL CHECK (kind IN ('individual', 'business')),
  form                  TEXT NOT NULL,
  filing_status         TEXT,
  states                TEXT NOT NULL DEFAULT '[]',
  status                TEXT NOT NULL,
  preparer_id           TEXT NOT NULL,
  reviewer_id           TEXT NOT NULL,
  due_at                TEXT,
  extension             TEXT,
  review_signoff        TEXT,
  approval_signature_id TEXT,
  client_approved_at    TEXT,
  organizer             TEXT NOT NULL,
  checklist             TEXT NOT NULL DEFAULT '[]',
  efile                 TEXT NOT NULL DEFAULT '[]',
  pricing               TEXT NOT NULL,
  status_history        TEXT NOT NULL DEFAULT '[]',
  notes                 TEXT NOT NULL DEFAULT '[]',
  activity              TEXT NOT NULL DEFAULT '[]',
  created_at            TEXT NOT NULL,
  completed_at          TEXT,
  updated_at            TEXT NOT NULL,
  rev                   INTEGER NOT NULL DEFAULT 1,
  UNIQUE (client_id, tax_year, form)
) STRICT;
CREATE INDEX tax_returns_client ON tax_returns(client_id);

CREATE TABLE tax_fee_schedule (
  code     TEXT PRIMARY KEY,
  label    TEXT NOT NULL,
  kind     TEXT NOT NULL CHECK (kind IN ('individual', 'business', 'both')),
  price    REAL NOT NULL,
  unit     TEXT,
  position INTEGER NOT NULL
) STRICT;
