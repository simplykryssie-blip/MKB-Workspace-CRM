-- Monarch product customers: buy store products (calculator, WISP build, downloads) but aren't
-- service bureau firms, so they have no onboarding. Kept off Onboarding, Offices and Leads.
ALTER TABLE mon_offices ADD COLUMN is_customer INTEGER NOT NULL DEFAULT 0;

-- Anyone who bought or has a calculator license but never took a service bureau package.
UPDATE mon_offices SET is_customer = 1, is_lead = 0
WHERE package_id IS NULL AND stage = 'interested' AND coalesce(software_username, '') = ''
  AND (EXISTS (SELECT 1 FROM mon_sales s WHERE s.office_id = mon_offices.id AND s.status = 'paid')
    OR EXISTS (SELECT 1 FROM calc_licenses c WHERE c.office_id = mon_offices.id));
