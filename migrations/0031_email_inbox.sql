-- Client email replies received through Resend (reply address on a receive-only subdomain).
-- Bodies can hold personal details, so they are stored encrypted.
CREATE TABLE email_inbox (
  id           TEXT PRIMARY KEY,
  provider_id  TEXT NOT NULL UNIQUE,
  from_email   TEXT NOT NULL,
  from_name    TEXT,
  subject      TEXT NOT NULL DEFAULT '',
  body_enc     TEXT,
  client_id    TEXT REFERENCES clients(id),
  read_at      TEXT,
  received_at  TEXT NOT NULL
) STRICT;
CREATE INDEX email_inbox_client ON email_inbox(client_id, received_at);
CREATE INDEX email_inbox_unread ON email_inbox(read_at);
