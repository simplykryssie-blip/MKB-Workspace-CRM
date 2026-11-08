-- Extra return details: Owner final approval, due diligence, amended-return
-- link and extension-only flag (JSON).
ALTER TABLE tax_returns ADD COLUMN extra TEXT NOT NULL DEFAULT '{}';
