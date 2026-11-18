-- Monarch store: packages and products sold on Monarch's website (/store), each with its own page.
ALTER TABLE mon_packages ADD COLUMN slug TEXT;
ALTER TABLE mon_packages ADD COLUMN store INTEGER NOT NULL DEFAULT 0;          -- 1 = listed in the store
ALTER TABLE mon_packages ADD COLUMN summary TEXT NOT NULL DEFAULT '';          -- one or two lines on the store grid
ALTER TABLE mon_packages ADD COLUMN description TEXT NOT NULL DEFAULT '';      -- product page text (blank line = new paragraph)
ALTER TABLE mon_packages ADD COLUMN terms TEXT NOT NULL DEFAULT '';
ALTER TABLE mon_packages ADD COLUMN disclaimer TEXT NOT NULL DEFAULT '';
ALTER TABLE mon_packages ADD COLUMN images TEXT NOT NULL DEFAULT '[]';         -- website media keys (Monarch site)
ALTER TABLE mon_packages ADD COLUMN after_purchase TEXT NOT NULL DEFAULT '';   -- shown after paying and in the buyer's email
ALTER TABLE mon_packages ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX mon_packages_slug ON mon_packages (slug) WHERE slug IS NOT NULL;
