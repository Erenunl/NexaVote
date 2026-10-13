PRAGMA foreign_keys = ON;

CREATE TABLE jury_reveals (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  jury_country_id TEXT NOT NULL REFERENCES countries(id) ON DELETE RESTRICT,
  reveal_order INTEGER NOT NULL CHECK (reveal_order > 0),
  revealed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (edition_id, jury_country_id),
  UNIQUE (edition_id, reveal_order)
);

CREATE INDEX jury_reveals_edition_order ON jury_reveals(edition_id, reveal_order);
