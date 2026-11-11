-- Monarch Tax Suite: the service bureau workspace (staff only).
-- Offices (EROs) are onboarded through a private upload link; sales are paid
-- by Stripe link or recorded by hand; resellers earn a commission on paid
-- sales; bank reports are uploaded as CSV and matched to offices by EFIN.
-- Money is stored in cents.

CREATE TABLE mon_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  updated_by  TEXT
);

CREATE TABLE mon_software (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  sb_fee_cents     INTEGER NOT NULL DEFAULT 0,
  download_url     TEXT NOT NULL DEFAULT '',
  welcome_subject  TEXT NOT NULL DEFAULT '',
  welcome_body     TEXT NOT NULL DEFAULT '',
  active           INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE mon_banks (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  addon_fee_cents   INTEGER NOT NULL DEFAULT 0,
  application_url   TEXT NOT NULL DEFAULT '',
  -- Saved CSV column layouts per report type: {"enrollment": {...}, "funded": {...}}
  layouts           TEXT NOT NULL DEFAULT '{}',
  active            INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE mon_packages (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'package' CHECK (kind IN ('package', 'seat', 'location', 'other')),
  price_cents  INTEGER NOT NULL DEFAULT 0,
  billing      TEXT NOT NULL DEFAULT 'season' CHECK (billing IN ('season', 'once', 'monthly')),
  locations    INTEGER NOT NULL DEFAULT 1,
  seats        INTEGER NOT NULL DEFAULT 1,
  ask_ptins    INTEGER NOT NULL DEFAULT 0,
  features     TEXT NOT NULL DEFAULT '[]',
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE mon_resellers (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  contact     TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL DEFAULT '',
  phone       TEXT NOT NULL DEFAULT '',
  rate_bp     INTEGER NOT NULL DEFAULT 0,   -- commission rate in basis points (2000 = 20%)
  notes       TEXT NOT NULL DEFAULT '',
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE mon_offices (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  contact_name       TEXT NOT NULL DEFAULT '',
  email              TEXT NOT NULL DEFAULT '',
  phone              TEXT NOT NULL DEFAULT '',
  city               TEXT NOT NULL DEFAULT '',
  state              TEXT NOT NULL DEFAULT '',
  stage              TEXT NOT NULL DEFAULT 'interested' CHECK (stage IN ('interested', 'paid', 'collecting', 'setup', 'active', 'inactive')),
  package_id         TEXT REFERENCES mon_packages(id),
  software_id        TEXT REFERENCES mon_software(id),
  bank_id            TEXT REFERENCES mon_banks(id),
  reseller_id        TEXT REFERENCES mon_resellers(id),
  software_username  TEXT NOT NULL DEFAULT '',
  renews_on          TEXT,
  extra_seats        INTEGER NOT NULL DEFAULT 0,
  extra_locations    INTEGER NOT NULL DEFAULT 0,
  notes              TEXT NOT NULL DEFAULT '',
  checklist          TEXT NOT NULL DEFAULT '{}',
  locations          TEXT NOT NULL DEFAULT '[]',
  preparers          TEXT NOT NULL DEFAULT '[]',
  agreement          TEXT,                          -- {name, at, ip, fileId}
  link_hash          TEXT,
  link_sent_at       TEXT,
  link_last_used     TEXT,
  link_expires_at    TEXT,
  link_off_at        TEXT,
  created_at         TEXT NOT NULL,
  created_by         TEXT,
  updated_at         TEXT NOT NULL,
  rev                INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX mon_offices_stage ON mon_offices (stage);
CREATE UNIQUE INDEX mon_offices_link ON mon_offices (link_hash) WHERE link_hash IS NOT NULL;

CREATE TABLE mon_files (
  id            TEXT PRIMARY KEY,
  office_id     TEXT NOT NULL REFERENCES mon_offices(id),
  item          TEXT NOT NULL,
  r2_key        TEXT NOT NULL,
  name          TEXT NOT NULL,
  content_type  TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  uploaded_by   TEXT NOT NULL,                      -- 'office' or a team member id
  created_at    TEXT NOT NULL,
  deleted_at    TEXT
);
CREATE INDEX mon_files_office ON mon_files (office_id);

CREATE TABLE mon_sales (
  id              TEXT PRIMARY KEY,
  office_id       TEXT NOT NULL REFERENCES mon_offices(id),
  package_id      TEXT REFERENCES mon_packages(id),
  description     TEXT NOT NULL,
  qty             INTEGER NOT NULL DEFAULT 1,
  unit_cents      INTEGER NOT NULL,
  amount_cents    INTEGER NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('unpaid', 'paid', 'refunded', 'void')),
  method          TEXT,
  reference       TEXT,
  paid_at         TEXT,
  refunded_at     TEXT,
  pay_token_hash  TEXT,
  link_sent_at    TEXT,
  reseller_id     TEXT REFERENCES mon_resellers(id),
  created_at      TEXT NOT NULL,
  created_by      TEXT,
  updated_at      TEXT NOT NULL
);
CREATE INDEX mon_sales_office ON mon_sales (office_id);
CREATE INDEX mon_sales_status ON mon_sales (status, created_at);
CREATE UNIQUE INDEX mon_sales_pay ON mon_sales (pay_token_hash) WHERE pay_token_hash IS NOT NULL;
-- A Stripe payment can only be applied once.
CREATE UNIQUE INDEX mon_sales_ref ON mon_sales (reference) WHERE reference IS NOT NULL;

CREATE TABLE mon_commissions (
  id            TEXT PRIMARY KEY,
  reseller_id   TEXT NOT NULL REFERENCES mon_resellers(id),
  sale_id       TEXT NOT NULL UNIQUE REFERENCES mon_sales(id),
  rate_bp       INTEGER NOT NULL,
  amount_cents  INTEGER NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('owed', 'paid', 'cancelled')),
  paid_at       TEXT,
  paid_by       TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX mon_commissions_reseller ON mon_commissions (reseller_id, status);

CREATE TABLE mon_bank_uploads (
  id           TEXT PRIMARY KEY,
  bank_id      TEXT NOT NULL REFERENCES mon_banks(id),
  report_type  TEXT NOT NULL CHECK (report_type IN ('enrollment', 'funded')),
  file_name    TEXT NOT NULL,
  rows         INTEGER NOT NULL,
  matched      INTEGER NOT NULL,
  created_at   TEXT NOT NULL,
  created_by   TEXT
);

CREATE TABLE mon_bank_rows (
  id           TEXT PRIMARY KEY,
  upload_id    TEXT NOT NULL REFERENCES mon_bank_uploads(id),
  bank_id      TEXT NOT NULL,
  report_type  TEXT NOT NULL,
  efin         TEXT NOT NULL,
  name         TEXT NOT NULL DEFAULT '',
  office_id    TEXT,
  status       TEXT NOT NULL DEFAULT '',
  funded       INTEGER NOT NULL DEFAULT 0,
  fees_cents   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX mon_bank_rows_upload ON mon_bank_rows (upload_id);
CREATE INDEX mon_bank_rows_efin ON mon_bank_rows (efin);

-- Give the Owner (and Administrators) the new Monarch permission; other roles
-- get it only when the Owner adds it in Team & Permissions.
UPDATE roles SET perms = json_set(perms, '$.monarch', json('["view","create","edit","delete","archive","assign","approve","export","download","print","settings"]'))
  WHERE is_owner = 1;
UPDATE roles SET perms = json_set(perms, '$.monarch', json('["view","create","edit","archive","assign","approve","export","download","print"]'))
  WHERE id = 'role-admin';
