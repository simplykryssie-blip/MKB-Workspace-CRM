-- Monarch leads: contacts you haven't started selling to, kept off Onboarding and Offices.
-- (A flag instead of a new stage value: the stage CHECK can't change without rebuilding a table other tables point to.)
ALTER TABLE mon_offices ADD COLUMN is_lead INTEGER NOT NULL DEFAULT 0;

-- Contacts imported from the old CRM are leads. Anyone who bought, has a calculator license,
-- or has started setup stays an office.
UPDATE mon_offices SET is_lead = 1
WHERE stage = 'interested'
  AND notes LIKE 'Imported from the old CRM%'
  AND package_id IS NULL AND software_username = '' AND link_hash IS NULL AND welcome_sent_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM mon_sales s WHERE s.office_id = mon_offices.id)
  AND NOT EXISTS (SELECT 1 FROM calc_licenses c WHERE c.office_id = mon_offices.id);
