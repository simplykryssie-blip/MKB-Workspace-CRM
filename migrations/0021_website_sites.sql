-- More than one public website: MKB Financial Group (settings row 1, site 'mkb')
-- and Monarch Tax Suite (settings row 2, site 'monarch'). Page addresses are
-- unique within each website. Existing MKB content is kept as-is.

CREATE TABLE website_settings_new (
  id           INTEGER PRIMARY KEY CHECK (id IN (1, 2)),
  draft        TEXT NOT NULL,
  published    TEXT,
  rev          INTEGER NOT NULL DEFAULT 1,
  updated_at   TEXT NOT NULL,
  updated_by   TEXT REFERENCES members(id),
  published_at TEXT
) STRICT;
INSERT INTO website_settings_new (id, draft, published, rev, updated_at, updated_by, published_at)
  SELECT id, draft, published, rev, updated_at, updated_by, published_at FROM website_settings;
DROP TABLE website_settings;
ALTER TABLE website_settings_new RENAME TO website_settings;

CREATE TABLE website_pages_new (
  id           TEXT PRIMARY KEY,
  site         TEXT NOT NULL DEFAULT 'mkb' CHECK (site IN ('mkb', 'monarch')),
  slug         TEXT NOT NULL,
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
  deleted_at   TEXT,
  UNIQUE (site, slug)
) STRICT;
INSERT INTO website_pages_new (id, site, slug, title, description, nav, position, draft, published, rev, updated_at, updated_by, published_at, deleted_at)
  SELECT id, 'mkb', slug, title, description, nav, position, draft, published, rev, updated_at, updated_by, published_at, deleted_at FROM website_pages;
DROP TABLE website_pages;
ALTER TABLE website_pages_new RENAME TO website_pages;
CREATE INDEX website_pages_order ON website_pages(site, position);
