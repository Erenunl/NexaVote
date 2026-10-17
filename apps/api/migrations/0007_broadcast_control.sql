PRAGMA foreign_keys = ON;

ALTER TABLE editions ADD COLUMN aurora_mode TEXT NOT NULL DEFAULT 'calm'
  CHECK (aurora_mode IN ('calm', 'live', 'ice', 'finale'));

ALTER TABLE editions ADD COLUMN rehearsal_public INTEGER NOT NULL DEFAULT 0
  CHECK (rehearsal_public IN (0, 1));

ALTER TABLE editions ADD COLUMN rehearsal_opened_at TEXT;

CREATE TABLE rehearsal_jury_reveals (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  jury_country_id TEXT NOT NULL REFERENCES countries(id) ON DELETE RESTRICT,
  reveal_order INTEGER NOT NULL CHECK (reveal_order > 0),
  revealed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (edition_id, jury_country_id),
  UNIQUE (edition_id, reveal_order)
);

CREATE INDEX rehearsal_jury_reveals_edition_order
  ON rehearsal_jury_reveals(edition_id, reveal_order);
