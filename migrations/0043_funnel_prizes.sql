-- Black Friday Tax Prize: one instant prize per person (by email or phone), picked by the server.
CREATE TABLE funnel_prizes (
  id           TEXT PRIMARY KEY,
  campaign     TEXT NOT NULL,
  email        TEXT NOT NULL,
  phone        TEXT NOT NULL,
  prize_cents  INTEGER NOT NULL,
  code         TEXT NOT NULL UNIQUE,
  vip_bonus    INTEGER NOT NULL DEFAULT 0,   -- opted in to texts → VIP bonus
  lead_id      TEXT,
  client_id    TEXT,
  redeemed_at  TEXT,
  created_at   TEXT NOT NULL
) STRICT;
CREATE INDEX funnel_prizes_email ON funnel_prizes (campaign, email);
CREATE INDEX funnel_prizes_phone ON funnel_prizes (campaign, phone);
