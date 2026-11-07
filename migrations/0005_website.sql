-- Public website: site-wide settings and pages. Each keeps a draft (edited in the
-- CRM) and the published copy visitors see. Public marketing content only.
CREATE TABLE website_settings (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  draft        TEXT NOT NULL,
  published    TEXT,
  rev          INTEGER NOT NULL DEFAULT 1,
  updated_at   TEXT NOT NULL,
  updated_by   TEXT REFERENCES members(id),
  published_at TEXT
) STRICT;

CREATE TABLE website_pages (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  nav          INTEGER NOT NULL DEFAULT 1,
  position     INTEGER NOT NULL DEFAULT 0,
  draft        TEXT NOT NULL DEFAULT '[]',
  published    TEXT,
  rev          INTEGER NOT NULL DEFAULT 1,
  updated_at   TEXT NOT NULL,
  updated_by   TEXT REFERENCES members(id),
  published_at TEXT,
  deleted_at   TEXT
) STRICT;
CREATE INDEX website_pages_order ON website_pages(position);

-- Images uploaded for the website (files live in R2 under website/).
CREATE TABLE website_media (
  key          TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  size         INTEGER NOT NULL,
  name         TEXT NOT NULL,
  uploaded_at  TEXT NOT NULL,
  uploaded_by  TEXT REFERENCES members(id)
) STRICT;
