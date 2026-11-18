-- Monarch tax calculator licenses (moved from the Monarch/Verexa app). The public embed id goes in the
-- customer's website; the calculator only renders inside that license's authorized websites.
CREATE TABLE calc_licenses (
  id            TEXT PRIMARY KEY,
  office_id     TEXT NOT NULL REFERENCES mon_offices(id),
  embed_id      TEXT NOT NULL UNIQUE,
  key_prefix    TEXT NOT NULL DEFAULT '',
  key_hash      TEXT NOT NULL DEFAULT '',          -- SHA-256 of the license key (kept from the old system)
  tax_years     TEXT NOT NULL DEFAULT '[2026]',
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  package_id    TEXT,
  source        TEXT NOT NULL DEFAULT 'mkb',
  notes         TEXT NOT NULL DEFAULT '',
  last_seen_at  TEXT,
  last_seen_host TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
) STRICT;
CREATE INDEX calc_licenses_office ON calc_licenses (office_id);

CREATE TABLE calc_domains (
  license_id  TEXT NOT NULL REFERENCES calc_licenses(id),
  domain      TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (license_id, domain)
) STRICT;

-- Where a license's calculator leads go (the customer's own GoHighLevel inbound webhook).
CREATE TABLE calc_lead_settings (
  license_id       TEXT PRIMARY KEY REFERENCES calc_licenses(id),
  enabled          INTEGER NOT NULL DEFAULT 0,
  business_name    TEXT NOT NULL DEFAULT '',
  lead_source      TEXT NOT NULL DEFAULT '',
  include_summary  INTEGER NOT NULL DEFAULT 1,
  tags             TEXT NOT NULL DEFAULT '[]',
  webhook_enc      TEXT,                            -- encrypted {url, secret}
  webhook_host     TEXT NOT NULL DEFAULT '',
  last_success_at  TEXT,
  last_error       TEXT,
  last_error_at    TEXT,
  updated_at       TEXT NOT NULL
) STRICT;

-- Delivery log without personal data (outcome only); pruned after 30 days.
CREATE TABLE calc_deliveries (
  id          TEXT PRIMARY KEY,
  license_id  TEXT NOT NULL,
  outcome     TEXT NOT NULL,                        -- sent | failed | rejected | test
  reason      TEXT,
  http_status INTEGER,
  created_at  TEXT NOT NULL
) STRICT;
CREATE INDEX calc_deliveries_license ON calc_deliveries (license_id, created_at);
