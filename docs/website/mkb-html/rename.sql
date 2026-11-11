UPDATE website_pages SET slug = 'financial-management', title = 'Financial Management', id = id WHERE site = 'mkb' AND slug = 'business-financial-management' AND NOT EXISTS (SELECT 1 FROM website_pages WHERE site = 'mkb' AND slug = 'financial-management');
UPDATE website_pages SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE site = 'mkb' AND slug = 'resources' AND deleted_at IS NULL;
