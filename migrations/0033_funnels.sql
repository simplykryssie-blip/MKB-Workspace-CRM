-- Campaign funnels (e.g. the 2027 Money Vault page at /unlock).
-- Forms can show one section at a time; submissions carry a one-time key (so a double
-- tap or a retried request never creates a second lead) and where the visitor came from
-- (UTM tags, ad click IDs, landing page) — never anything sensitive.
ALTER TABLE forms ADD COLUMN layout TEXT NOT NULL DEFAULT 'single';
ALTER TABLE form_submissions ADD COLUMN client_key TEXT;
ALTER TABLE form_submissions ADD COLUMN attribution TEXT;
CREATE UNIQUE INDEX form_submissions_client_key ON form_submissions(form_id, client_key) WHERE client_key IS NOT NULL;

-- Page visits per funnel per day (a count only: no IP, no cookie, no visitor ID).
CREATE TABLE funnel_visits (
  funnel  TEXT NOT NULL,
  day     TEXT NOT NULL,
  visits  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (funnel, day)
) STRICT;
