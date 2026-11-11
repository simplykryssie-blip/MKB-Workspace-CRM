-- Text messaging (Twilio): one number per brand, two-way conversations, text campaigns.

-- Integration credentials, encrypted with the server key (never shown again in full).
CREATE TABLE integration_secrets (
  key         TEXT PRIMARY KEY,              -- e.g. twilio.auth_token
  ciphertext  TEXT NOT NULL,
  iv          TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  last4       TEXT,
  updated_at  TEXT NOT NULL,
  updated_by  TEXT
) STRICT;

ALTER TABLE campaign_settings ADD COLUMN sms_number TEXT NOT NULL DEFAULT '';      -- +1XXXXXXXXXX (Twilio number for this brand)
ALTER TABLE campaign_settings ADD COLUMN twilio_sid TEXT NOT NULL DEFAULT '';      -- Account SID (not secret; shared by both brands)
ALTER TABLE campaign_settings ADD COLUMN sms_help TEXT NOT NULL DEFAULT '';        -- business name + phone used in opt-out wording

CREATE TABLE sms_messages (
  id           TEXT PRIMARY KEY,
  brand        TEXT NOT NULL CHECK (brand IN ('mkb', 'monarch')),
  direction    TEXT NOT NULL CHECK (direction IN ('out', 'in')),
  phone        TEXT NOT NULL,                -- the other person's 10-digit number
  body         TEXT NOT NULL,
  status       TEXT NOT NULL,                -- queued | sent | delivered | failed | undelivered | received
  error        TEXT,
  provider_sid TEXT,
  contact_type TEXT,                         -- lead | client | office | reseller (when matched)
  contact_id   TEXT,
  campaign_id  TEXT,
  recipient_id TEXT,
  member_id    TEXT,                         -- who sent it (staff replies)
  read_at      TEXT,                         -- incoming: when staff read it
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
) STRICT;
CREATE INDEX sms_thread ON sms_messages (brand, phone, created_at);
CREATE INDEX sms_unread ON sms_messages (brand, direction, read_at);
CREATE INDEX sms_sid ON sms_messages (provider_sid);
