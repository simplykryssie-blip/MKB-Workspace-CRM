-- A client's service can be marked urgent: its document requests sort to the top of Documents.
ALTER TABLE client_enrollments ADD COLUMN urgent INTEGER NOT NULL DEFAULT 0;
