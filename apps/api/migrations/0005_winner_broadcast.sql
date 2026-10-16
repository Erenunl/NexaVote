ALTER TABLE editions ADD COLUMN winner_active INTEGER NOT NULL DEFAULT 0 CHECK (winner_active IN (0, 1));
ALTER TABLE editions ADD COLUMN winner_started_at TEXT;
