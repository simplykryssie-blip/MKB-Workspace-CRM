-- Company-wide settings stored as JSON by key (e.g. 'fees').
CREATE TABLE service_settings (
  key         TEXT PRIMARY KEY,
  data        TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  updated_by  TEXT
);
