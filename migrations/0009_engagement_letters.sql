-- Engagement letter versions. Version 1 of each letter is the default in code;
-- every saved edit adds a row (never updated or deleted), so each client's
-- acceptance always points at the exact wording they agreed to.
CREATE TABLE engagement_letters (
  key         TEXT NOT NULL,
  version     INTEGER NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  note        TEXT,
  created_at  TEXT NOT NULL,
  created_by  TEXT,
  PRIMARY KEY (key, version)
);
