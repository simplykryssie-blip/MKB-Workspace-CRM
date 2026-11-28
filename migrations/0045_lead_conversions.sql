-- A lead who becomes a client is merged into the client: notes, history, texts, tasks, appointments,
-- campaign sends and form submissions move to the client and the lead record is removed, so a person
-- never has two contacts. This keeps only the conversion itself (no names or contact details) for
-- reports — conversion rate, which forms and sources turned into clients — and to send old /leads/ links
-- to the client.
CREATE TABLE lead_conversions (
  lead_id         TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL,
  merged          INTEGER NOT NULL DEFAULT 0,      -- 1 = joined a client who already existed
  source          TEXT NOT NULL DEFAULT '',
  stage_id        TEXT,
  tags            TEXT NOT NULL DEFAULT '[]',
  interests       TEXT NOT NULL DEFAULT '[]',
  owner_id        TEXT,
  lead_created_at TEXT NOT NULL,
  converted_at    TEXT NOT NULL
) STRICT;
CREATE INDEX lead_conversions_client ON lead_conversions (client_id);

-- ---------------------------------------------------------------- fold in leads that already converted
-- Same steps as absorbStatements() in lib/server/leads.ts, for every converted lead whose client exists.
INSERT OR IGNORE INTO lead_conversions (lead_id, client_id, merged, source, stage_id, tags, interests, owner_id, lead_created_at, converted_at)
  SELECT l.id, l.converted_client_id, CASE WHEN c.lead_id = l.id THEN 0 ELSE 1 END, l.source, l.stage_id, l.tags, l.interests, l.owner_id, l.created_at, COALESCE(l.converted_at, l.last_activity_at)
  FROM leads l JOIN clients c ON c.id = l.converted_client_id WHERE l.status = 'converted';

INSERT OR IGNORE INTO client_notes (id, client_id, author_id, body, service, pinned, at)
  SELECT 'n_' || n.id, v.client_id, n.author_id, n.body, NULL, n.pinned, n.at FROM lead_notes n JOIN lead_conversions v ON v.lead_id = n.lead_id
  WHERE n.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM client_notes c WHERE c.client_id = v.client_id AND c.deleted_at IS NULL AND (c.body = n.body OR c.body = 'From lead ' || n.lead_id || ': ' || n.body));

INSERT OR IGNORE INTO client_activity (id, client_id, kind, text, actor, member_id, at)
  SELECT 'la_' || x.id, v.client_id, 'lead', 'Lead: ' || x.text, x.actor, x.member_id, x.at FROM lead_activity x JOIN lead_conversions v ON v.lead_id = x.lead_id
  WHERE NOT EXISTS (SELECT 1 FROM client_activity c WHERE c.client_id = v.client_id AND c.text = 'Lead: ' || x.text AND c.at = x.at);

UPDATE form_submissions SET client_id = COALESCE(client_id, (SELECT v.client_id FROM lead_conversions v WHERE v.lead_id = form_submissions.lead_id)) WHERE lead_id IN (SELECT lead_id FROM lead_conversions);
UPDATE funnel_prizes SET client_id = COALESCE(client_id, (SELECT v.client_id FROM lead_conversions v WHERE v.lead_id = funnel_prizes.lead_id)) WHERE lead_id IN (SELECT lead_id FROM lead_conversions);
UPDATE sms_messages SET contact_type = 'client', contact_id = (SELECT v.client_id FROM lead_conversions v WHERE v.lead_id = sms_messages.contact_id) WHERE contact_type = 'lead' AND contact_id IN (SELECT lead_id FROM lead_conversions);
UPDATE tasks SET contact_type = 'client', contact_id = (SELECT v.client_id FROM lead_conversions v WHERE v.lead_id = tasks.contact_id) WHERE contact_type = 'lead' AND contact_id IN (SELECT lead_id FROM lead_conversions);
UPDATE appointments SET contact_type = 'client', contact_id = (SELECT v.client_id FROM lead_conversions v WHERE v.lead_id = appointments.contact_id) WHERE contact_type = 'lead' AND contact_id IN (SELECT lead_id FROM lead_conversions);
UPDATE campaign_recipients SET contact_type = 'client', contact_id = (SELECT v.client_id FROM lead_conversions v WHERE v.lead_id = campaign_recipients.contact_id) WHERE contact_type = 'lead' AND contact_id IN (SELECT lead_id FROM lead_conversions);
UPDATE notifications SET href = (SELECT '/clients/' || v.client_id FROM lead_conversions v WHERE '/leads/' || v.lead_id = notifications.href) WHERE href IN (SELECT '/leads/' || lead_id FROM lead_conversions);

DELETE FROM lead_reminders WHERE lead_id IN (SELECT lead_id FROM lead_conversions);
DELETE FROM lead_notes WHERE lead_id IN (SELECT lead_id FROM lead_conversions);
DELETE FROM lead_activity WHERE lead_id IN (SELECT lead_id FROM lead_conversions);
DELETE FROM leads WHERE id IN (SELECT lead_id FROM lead_conversions);
