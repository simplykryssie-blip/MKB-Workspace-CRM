-- One calendar for MKB and Monarch: appointments, time blocks and tasks,
-- with a calendar per staff member. Appointment types are editable; each is
-- tagged MKB or Monarch. (Online booking, Zoom and payment come next.)

CREATE TABLE appointment_types (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  brand         TEXT NOT NULL DEFAULT 'mkb' CHECK (brand IN ('mkb', 'monarch')),
  service       TEXT NOT NULL DEFAULT 'other',      -- tax | books | biz | expunge | monarch | other
  duration_min  INTEGER NOT NULL DEFAULT 30,
  location      TEXT NOT NULL DEFAULT 'video' CHECK (location IN ('video', 'phone', 'in_person')),
  location_note TEXT NOT NULL DEFAULT '',            -- address, or "We'll call you at the number you give"
  color         TEXT NOT NULL DEFAULT '#b87912',
  price_cents   INTEGER NOT NULL DEFAULT 0,          -- paid consultations (charged at booking, next step)
  buffer_min    INTEGER NOT NULL DEFAULT 0,
  description   TEXT NOT NULL DEFAULT '',
  bookable      INTEGER NOT NULL DEFAULT 1,          -- offered for online booking (next step)
  active        INTEGER NOT NULL DEFAULT 1,
  position      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
) STRICT;

CREATE TABLE calendar_settings (
  member_id  TEXT PRIMARY KEY REFERENCES members(id),
  color      TEXT NOT NULL DEFAULT '#2563eb',
  timezone   TEXT NOT NULL DEFAULT 'America/Chicago',
  hours      TEXT NOT NULL DEFAULT '{}',             -- weekly availability for booking (next step)
  feed_token TEXT,                                   -- private calendar link for phones (later step)
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE appointments (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL DEFAULT 'appointment' CHECK (kind IN ('appointment', 'block')),
  type_id       TEXT REFERENCES appointment_types(id),
  title         TEXT NOT NULL,
  brand         TEXT NOT NULL DEFAULT 'mkb' CHECK (brand IN ('mkb', 'monarch')),
  service       TEXT NOT NULL DEFAULT 'other',
  member_id     TEXT NOT NULL REFERENCES members(id),  -- whose calendar
  starts_at     TEXT NOT NULL,
  ends_at       TEXT NOT NULL,
  location      TEXT NOT NULL DEFAULT 'video',
  location_note TEXT NOT NULL DEFAULT '',
  contact_type  TEXT,                                   -- lead | client | office
  contact_id    TEXT,
  contact_name  TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes         TEXT NOT NULL DEFAULT '',
  source        TEXT NOT NULL DEFAULT 'staff',          -- staff | booking | import
  created_by    TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  rev           INTEGER NOT NULL DEFAULT 1
) STRICT;
CREATE INDEX appointments_time ON appointments (starts_at);
CREATE INDEX appointments_member ON appointments (member_id, starts_at);
CREATE INDEX appointments_contact ON appointments (contact_type, contact_id);

CREATE TABLE tasks (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  notes         TEXT NOT NULL DEFAULT '',
  due_at        TEXT,                                   -- ISO time, or YYYY-MM-DD when all_day
  all_day       INTEGER NOT NULL DEFAULT 1,
  priority      TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  done_at       TEXT,
  done_by       TEXT,
  assignee_id   TEXT NOT NULL REFERENCES members(id),
  brand         TEXT NOT NULL DEFAULT 'mkb' CHECK (brand IN ('mkb', 'monarch')),
  service       TEXT NOT NULL DEFAULT 'other',
  contact_type  TEXT,
  contact_id    TEXT,
  contact_name  TEXT NOT NULL DEFAULT '',
  checklist     TEXT NOT NULL DEFAULT '[]',             -- [{id, text, done}]
  repeat        TEXT NOT NULL DEFAULT 'none' CHECK (repeat IN ('none', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  created_by    TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  rev           INTEGER NOT NULL DEFAULT 1
) STRICT;
CREATE INDEX tasks_assignee ON tasks (assignee_id, status, due_at);
CREATE INDEX tasks_contact ON tasks (contact_type, contact_id);

-- Starter appointment types (edit them in Calendar → Settings).
INSERT INTO appointment_types (id, name, brand, service, duration_min, location, location_note, color, price_cents, buffer_min, description, position, created_at, updated_at) VALUES
  ('apt-consult',   'Consultation',            'mkb',     'other',   30, 'video',     '', '#b87912', 0, 15, 'A call to talk through your business and the MKB services that fit.', 0, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('apt-tax',       'Tax appointment',         'mkb',     'tax',     60, 'in_person', '', '#2563eb', 0, 15, 'Tax preparation meeting — bring your documents.', 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('apt-books',     'Bookkeeping review',      'mkb',     'books',   45, 'video',     '', '#0d9488', 0, 15, 'Review your books and monthly reports.', 2, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('apt-biz',       'Business Solutions call', 'mkb',     'biz',     30, 'phone',     '', '#7c3aed', 0, 15, 'Formation, filings and business documents.', 3, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('apt-relief',    'Record Relief consult',   'mkb',     'expunge', 30, 'phone',     '', '#ea580c', 0, 15, 'Talk through the Record Relief process (Louisiana).', 4, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('apt-monarch',   'Monarch partner call',    'monarch', 'monarch', 30, 'video',     '', '#a16207', 0, 15, 'Learn about Monarch software, systems and mentorship.', 5, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'));

-- Bring over appointments saved on client records.
INSERT INTO appointments (id, kind, type_id, title, brand, service, member_id, starts_at, ends_at, location, contact_type, contact_id, contact_name, status, source, created_at, updated_at)
SELECT 'apt_' || c.id || '_' || json_extract(a.value, '$.id'), 'appointment', NULL,
       coalesce(json_extract(a.value, '$.title'), 'Appointment'), 'mkb', coalesce(json_extract(a.value, '$.service'), 'other'),
       coalesce((SELECT m.id FROM members m WHERE m.id = json_extract(a.value, '$.staffId')), (SELECT m.id FROM members m JOIN roles r ON r.id = m.role_id WHERE r.is_owner = 1 LIMIT 1)),
       json_extract(a.value, '$.at'),
       strftime('%Y-%m-%dT%H:%M:%fZ', json_extract(a.value, '$.at'), '+' || coalesce(json_extract(a.value, '$.durationMin'), 30) || ' minutes'),
       CASE json_extract(a.value, '$.mode') WHEN 'Phone' THEN 'phone' WHEN 'In person' THEN 'in_person' ELSE 'video' END,
       'client', c.id, c.name, coalesce(json_extract(a.value, '$.status'), 'scheduled'), 'import',
       strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM clients c, json_each(c.module_data, '$.appointments') a
WHERE c.module_data IS NOT NULL AND json_valid(c.module_data) AND json_extract(a.value, '$.at') IS NOT NULL
  AND (SELECT count(*) FROM members) > 0;
