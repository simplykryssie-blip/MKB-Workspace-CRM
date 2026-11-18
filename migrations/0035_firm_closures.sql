-- Office closed days (holidays): online booking skips them for everyone.
CREATE TABLE business_closures (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  start_date  TEXT NOT NULL,          -- YYYY-MM-DD
  end_date    TEXT NOT NULL,          -- YYYY-MM-DD (same as start for one day)
  source      TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  created_by  TEXT
) STRICT;
CREATE INDEX business_closures_dates ON business_closures (start_date, end_date);
