-- Funnel pages: a page can hide the site menu so visitors stay on the path.
ALTER TABLE website_pages ADD COLUMN hide_nav INTEGER NOT NULL DEFAULT 0;
