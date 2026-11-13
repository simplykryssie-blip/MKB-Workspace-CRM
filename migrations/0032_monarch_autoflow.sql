-- Monarch: a package can be bought from a Stripe payment link on the website, and sets the
-- office's software and bank; software has its own onboarding application link.
ALTER TABLE mon_packages ADD COLUMN stripe_link TEXT NOT NULL DEFAULT '';
ALTER TABLE mon_packages ADD COLUMN software_id TEXT;
ALTER TABLE mon_packages ADD COLUMN bank_id TEXT;
ALTER TABLE mon_software ADD COLUMN application_url TEXT NOT NULL DEFAULT '';
-- When the automatic welcome (setup link + applications) was sent.
ALTER TABLE mon_offices ADD COLUMN welcome_sent_at TEXT;
