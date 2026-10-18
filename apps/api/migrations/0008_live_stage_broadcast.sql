PRAGMA foreign_keys = ON;

CREATE TABLE live_stage_states (
  edition_id TEXT PRIMARY KEY REFERENCES editions(id) ON DELETE CASCADE,
  payload TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

