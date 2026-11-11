-- Media library per website (MKB / Monarch), and pictures can be replaced in place.
ALTER TABLE website_media ADD COLUMN site TEXT NOT NULL DEFAULT 'mkb';
ALTER TABLE website_media ADD COLUMN updated_at TEXT;
ALTER TABLE website_media ADD COLUMN deleted_at TEXT;
