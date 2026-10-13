ALTER TABLE editions ADD COLUMN guest_active INTEGER NOT NULL DEFAULT 0 CHECK (guest_active IN (0, 1));
ALTER TABLE editions ADD COLUMN guest_started_at TEXT;
