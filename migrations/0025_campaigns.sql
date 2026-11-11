-- Campaigns (marketing email; text messages come in a later phase).
--
-- Consent is kept per brand (MKB, Monarch), channel and address, so an
-- unsubscribe applies to that address wherever it appears (lead, client,
-- Monarch office). A missing row means "no choice recorded": email may be sent
-- to known contacts (they can unsubscribe); texts need a recorded opt-in.
CREATE TABLE marketing_consent (
  brand      TEXT NOT NULL CHECK (brand IN ('mkb', 'monarch')),
  channel    TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  address    TEXT NOT NULL,                 -- lowercased email, or 10-digit phone
  status     TEXT NOT NULL CHECK (status IN ('subscribed', 'unsubscribed')),
  source     TEXT NOT NULL DEFAULT '',      -- e.g. "Website form: Start: Tax preparation", "Unsubscribe link"
  at         TEXT NOT NULL,
  updated_by TEXT,
  PRIMARY KEY (brand, channel, address)
) STRICT;

CREATE TABLE campaign_settings (
  brand          TEXT PRIMARY KEY CHECK (brand IN ('mkb', 'monarch')),
  from_name      TEXT NOT NULL,
  from_email     TEXT NOT NULL,
  reply_to       TEXT NOT NULL DEFAULT '',
  mailing_address TEXT NOT NULL DEFAULT '',  -- required in every marketing email (CAN-SPAM)
  daily_limit    INTEGER NOT NULL DEFAULT 100, -- the email provider's daily cap (all emails, not only campaigns)
  reserve        INTEGER NOT NULL DEFAULT 20,  -- kept free each day for intake links, receipts and other system emails
  updated_at     TEXT NOT NULL,
  updated_by     TEXT
) STRICT;
INSERT INTO campaign_settings (brand, from_name, from_email, reply_to, updated_at) VALUES
  ('mkb', 'MKB Financial Group', 'news@mkbfinancialgroup.com', 'info@mkbfinancialgroup.com', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('monarch', 'Monarch Tax Suite', 'news@monarchtaxsuite.com', '', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

CREATE TABLE campaign_audiences (
  id         TEXT PRIMARY KEY,
  brand      TEXT NOT NULL CHECK (brand IN ('mkb', 'monarch')),
  name       TEXT NOT NULL,
  filters    TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE campaign_templates (
  id         TEXT PRIMARY KEY,
  brand      TEXT NOT NULL CHECK (brand IN ('mkb', 'monarch')),
  name       TEXT NOT NULL,
  content    TEXT NOT NULL,                 -- {subject, preheader, heading, body, button, image}
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE campaigns (
  id           TEXT PRIMARY KEY,
  brand        TEXT NOT NULL CHECK (brand IN ('mkb', 'monarch')),
  channel      TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms')),
  name         TEXT NOT NULL,
  content      TEXT NOT NULL DEFAULT '{}',
  filters      TEXT NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  scheduled_at TEXT,
  started_at   TEXT,
  finished_at  TEXT,
  created_at   TEXT NOT NULL,
  created_by   TEXT,
  sent_by      TEXT,
  updated_at   TEXT NOT NULL,
  rev          INTEGER NOT NULL DEFAULT 1
) STRICT;
CREATE INDEX campaigns_brand ON campaigns (brand, created_at);
CREATE INDEX campaigns_due ON campaigns (status, scheduled_at);

CREATE TABLE campaign_recipients (
  id           TEXT PRIMARY KEY,            -- also the tracking key in links
  campaign_id  TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  address      TEXT NOT NULL,
  name         TEXT NOT NULL DEFAULT '',
  contact_type TEXT NOT NULL,               -- lead | client | office | reseller
  contact_id   TEXT NOT NULL,
  vars         TEXT NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
  error        TEXT,
  provider_id  TEXT,
  sent_at      TEXT,
  opened_at    TEXT,
  clicked_at   TEXT,
  unsubscribed_at TEXT,
  UNIQUE (campaign_id, address)
) STRICT;
CREATE INDEX campaign_recipients_queue ON campaign_recipients (campaign_id, status);

-- Owner gets the new Campaigns permission (Approve = send); Administrators can
-- draft but not send. Other roles get it only when the Owner adds it.
UPDATE roles SET perms = json_set(perms, '$.campaigns', json('["view","create","edit","delete","approve","export","settings"]')) WHERE is_owner = 1;
UPDATE roles SET perms = json_set(perms, '$.campaigns', json('["view","create","edit"]')) WHERE id = 'role-admin';
