-- Staff workspaces for Business Services and Record Expungement.
-- Each record is one JSON document with a revision number (a stale save is refused).
-- Expungement records hold criminal-history details, so their data is stored
-- encrypted (AES-GCM, see lib/server/crypto.ts); business records are plain JSON.
CREATE TABLE service_records (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('biz_request', 'biz_entity', 'biz_item', 'exp_matter', 'exp_case')),
  client_id   TEXT REFERENCES clients(id),
  data        TEXT NOT NULL,
  encrypted   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  created_by  TEXT,
  updated_at  TEXT NOT NULL,
  rev         INTEGER NOT NULL DEFAULT 1
) STRICT;
CREATE INDEX service_records_kind ON service_records(kind, client_id);
