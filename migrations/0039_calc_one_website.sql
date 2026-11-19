-- A calculator license covers one website by default (www. and bare versions count as one).
-- Licenses that already use more than one website keep what they have.
UPDATE calc_licenses SET max_domains = 1 WHERE (SELECT count(*) FROM calc_domains d WHERE d.license_id = calc_licenses.id) <= 1;
