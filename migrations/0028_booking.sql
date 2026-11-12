-- Online booking: each staff member's available hours, public booking pages
-- (MKB and Monarch share one calendar), Zoom links made automatically, paid
-- consultations through Stripe, and confirmation / reminder emails.

-- Each staff member's booking hours. hours = {"mon":[["09:00","17:00"]], ...} in their time zone.
ALTER TABLE calendar_settings ADD COLUMN booking_on INTEGER NOT NULL DEFAULT 0;    -- takes online bookings
ALTER TABLE calendar_settings ADD COLUMN days_off   TEXT NOT NULL DEFAULT '[]';    -- ["2026-12-24", ...]
ALTER TABLE calendar_settings ADD COLUMN zoom_user  TEXT NOT NULL DEFAULT '';      -- their Zoom email ('' = the Zoom account owner)

-- Who can be booked for a type ('[]' = everyone taking bookings).
ALTER TABLE appointment_types ADD COLUMN member_ids TEXT NOT NULL DEFAULT '[]';

-- Booking rules and the Zoom app's IDs (the Zoom client secret is in integration_secrets).
CREATE TABLE booking_settings (
  id                  TEXT PRIMARY KEY CHECK (id = 'main'),
  min_notice_hours    INTEGER NOT NULL DEFAULT 24,
  window_days         INTEGER NOT NULL DEFAULT 30,
  slot_step_min       INTEGER NOT NULL DEFAULT 30,
  change_notice_hours INTEGER NOT NULL DEFAULT 24,   -- clients can reschedule/cancel online until this close to the start
  reminders           TEXT NOT NULL DEFAULT '[24,1]', -- hours before
  zoom_account_id     TEXT NOT NULL DEFAULT '',
  zoom_client_id      TEXT NOT NULL DEFAULT '',
  updated_at          TEXT NOT NULL,
  updated_by          TEXT
) STRICT;
INSERT INTO booking_settings (id, updated_at) VALUES ('main', strftime('%Y-%m-%dT%H:%M:%fZ','now'));

-- Booking details on appointments.
ALTER TABLE appointments ADD COLUMN guest_name       TEXT NOT NULL DEFAULT '';   -- the person (for "Hi Jane")
ALTER TABLE appointments ADD COLUMN guest_email      TEXT NOT NULL DEFAULT '';   -- who gets confirmations and reminders
ALTER TABLE appointments ADD COLUMN guest_phone      TEXT NOT NULL DEFAULT '';
ALTER TABLE appointments ADD COLUMN text_ok          INTEGER NOT NULL DEFAULT 0;  -- asked for text reminders
ALTER TABLE appointments ADD COLUMN meeting_url      TEXT NOT NULL DEFAULT '';
ALTER TABLE appointments ADD COLUMN meeting_id       TEXT NOT NULL DEFAULT '';
ALTER TABLE appointments ADD COLUMN price_cents      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE appointments ADD COLUMN payment_status   TEXT NOT NULL DEFAULT 'none'; -- none | pending | paid | refunded
ALTER TABLE appointments ADD COLUMN payment_ref      TEXT NOT NULL DEFAULT '';
ALTER TABLE appointments ADD COLUMN hold_until       TEXT;                         -- unpaid bookings free the time after this
ALTER TABLE appointments ADD COLUMN manage_hash      TEXT;                         -- sha256 of the client's reschedule/cancel link
ALTER TABLE appointments ADD COLUMN manage_seq       INTEGER NOT NULL DEFAULT 0;   -- bumped when the link is replaced
ALTER TABLE appointments ADD COLUMN reminders_sent   TEXT NOT NULL DEFAULT '[]';   -- hours already reminded, e.g. [24]
ALTER TABLE appointments ADD COLUMN confirmed_at     TEXT;
CREATE INDEX appointments_manage ON appointments (manage_hash);
CREATE INDEX appointments_upcoming ON appointments (status, starts_at);

-- The owner takes bookings from the start: Monday–Friday, 9 to 5 (Central). Edit in Calendar → My hours.
INSERT INTO calendar_settings (member_id, color, timezone, hours, booking_on, updated_at)
SELECT m.id, '#b87912', 'America/Chicago', '{"mon":[["09:00","17:00"]],"tue":[["09:00","17:00"]],"wed":[["09:00","17:00"]],"thu":[["09:00","17:00"]],"fri":[["09:00","17:00"]]}', 1, strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM members m JOIN roles r ON r.id = m.role_id WHERE r.is_owner = 1 AND m.status = 'active'
ON CONFLICT(member_id) DO UPDATE SET hours = excluded.hours, booking_on = 1;

-- Phone appointments: tell people who calls whom.
UPDATE appointment_types SET location_note = 'We''ll call you at the number you give.' WHERE location = 'phone' AND location_note = '';
