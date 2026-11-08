-- Bell notifications for staff. One row per recipient. Text holds names only —
-- never SSNs, EINs, amounts or document contents.
CREATE TABLE notifications (
  id          TEXT PRIMARY KEY,
  member_id   TEXT NOT NULL REFERENCES members(id),
  kind        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  href        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  read_at     TEXT
);
CREATE INDEX notifications_member ON notifications (member_id, created_at DESC);
