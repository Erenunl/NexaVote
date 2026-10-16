PRAGMA foreign_keys = ON;

CREATE TABLE champions (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  edition_name TEXT NOT NULL,
  edition_year INTEGER NOT NULL,
  placement INTEGER NOT NULL CHECK (placement BETWEEN 1 AND 3),
  country_id TEXT NOT NULL REFERENCES countries(id) ON DELETE RESTRICT,
  country_name TEXT NOT NULL,
  country_flag TEXT NOT NULL,
  artist TEXT NOT NULL,
  song_title TEXT NOT NULL,
  total_points INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (edition_id, placement)
);

CREATE INDEX champions_edition_year ON champions(edition_year DESC, placement);
