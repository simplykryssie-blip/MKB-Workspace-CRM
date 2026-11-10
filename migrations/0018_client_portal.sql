-- Client portal: the 6-digit code emailed at each client sign-in (one per
-- session; only a hash is stored), and client messages kept on the record.
CREATE TABLE login_codes (
  session_hash TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash    TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  sends        INTEGER NOT NULL DEFAULT 1
) STRICT;

-- When the client last read their messages in the portal (for the unread count).
ALTER TABLE users ADD COLUMN messages_read_at TEXT;
