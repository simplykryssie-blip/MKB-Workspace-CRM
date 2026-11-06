-- Lead-capture forms and their submissions.
CREATE TABLE forms (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  intro        TEXT,
  status       TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  fields       TEXT NOT NULL,
  services     TEXT NOT NULL DEFAULT '[]',
  routing      TEXT NOT NULL,
  thank_you    TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  published_at TEXT
) STRICT;

-- Answers exactly as submitted (forms never collect sensitive information:
-- publishing is blocked for questions that would).
CREATE TABLE form_submissions (
  id        TEXT PRIMARY KEY,
  form_id   TEXT NOT NULL REFERENCES forms(id),
  at        TEXT NOT NULL,
  data      TEXT NOT NULL,
  channel   TEXT NOT NULL,
  outcome   TEXT NOT NULL CHECK (outcome IN ('new_lead', 'existing_lead', 'existing_client', 'spam')),
  lead_id   TEXT,
  client_id TEXT
) STRICT;
CREATE INDEX submissions_form ON form_submissions(form_id, at);
