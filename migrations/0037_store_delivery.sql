-- What a store product delivers once paid, and the pieces that delivery needs.
ALTER TABLE mon_packages ADD COLUMN delivery TEXT NOT NULL DEFAULT 'none';   -- none | calculator_license | calculator_update | download
ALTER TABLE mon_packages ADD COLUMN tax_year INTEGER;                        -- calculator license/update: tax year delivered
ALTER TABLE calc_licenses ADD COLUMN max_domains INTEGER NOT NULL DEFAULT 3; -- websites the customer may add themselves

-- Customer's private calculator setup link (/i/m/c/<token>): only the SHA-256 is stored; a new link replaces the old one.
CREATE TABLE calc_setup_links (
  token_hash  TEXT PRIMARY KEY,
  license_id  TEXT NOT NULL REFERENCES calc_licenses(id),
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  revoked_at  TEXT,
  last_used_at TEXT
) STRICT;
CREATE INDEX calc_setup_links_license ON calc_setup_links (license_id);

-- Files a download product delivers (stored privately in R2).
CREATE TABLE mon_package_files (
  id           TEXT PRIMARY KEY,
  package_id   TEXT NOT NULL REFERENCES mon_packages(id),
  name         TEXT NOT NULL,
  r2_key       TEXT NOT NULL,
  size         INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  deleted_at   TEXT
) STRICT;

-- A buyer's private download link (/i/m/d/<token>), valid 30 days.
CREATE TABLE mon_download_links (
  token_hash  TEXT PRIMARY KEY,
  sale_id     TEXT NOT NULL,
  package_id  TEXT NOT NULL,
  office_id   TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  downloads   INTEGER NOT NULL DEFAULT 0
) STRICT;

-- The products moved from the old store: the calculator issues a 2026 license; the annual update adds 2027.
UPDATE mon_packages SET delivery = 'calculator_license', tax_year = 2026 WHERE slug = 'monarch-basic-tax-calculator';
UPDATE mon_packages SET delivery = 'calculator_update', tax_year = 2027 WHERE slug = 'monarch-basic-tax-calculator-annual-update';
