PRAGMA foreign_keys = ON;

CREATE TABLE editions (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  phase TEXT NOT NULL DEFAULT 'draft' CHECK (phase IN ('draft', 'open', 'closed')),
  results_public INTEGER NOT NULL DEFAULT 0 CHECK (results_public IN (0, 1)),
  public_status_enabled INTEGER NOT NULL DEFAULT 1 CHECK (public_status_enabled IN (0, 1)),
  reveal_count INTEGER NOT NULL DEFAULT 0,
  voting_deadline TEXT,
  is_current INTEGER NOT NULL DEFAULT 0 CHECK (is_current IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX one_current_edition ON editions(is_current) WHERE is_current = 1;

CREATE TABLE countries (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  flag_emoji TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  country_id TEXT NOT NULL REFERENCES countries(id) ON DELETE RESTRICT,
  artist TEXT NOT NULL,
  song_title TEXT NOT NULL,
  youtube_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (edition_id, country_id)
);

CREATE TABLE jury_credentials (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  country_id TEXT NOT NULL REFERENCES countries(id) ON DELETE RESTRICT,
  lookup_hash TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  iterations INTEGER NOT NULL DEFAULT 310000,
  version INTEGER NOT NULL DEFAULT 1,
  rotated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (edition_id, country_id),
  UNIQUE (edition_id, lookup_hash)
);

CREATE TABLE jury_sessions (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  country_id TEXT NOT NULL REFERENCES countries(id) ON DELETE RESTRICT,
  credential_version INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'voting')),
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX jury_sessions_active ON jury_sessions(edition_id, country_id, revoked_at, expires_at);

CREATE TABLE active_jury_sessions (
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  country_id TEXT NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL UNIQUE REFERENCES jury_sessions(id) ON DELETE CASCADE,
  PRIMARY KEY (edition_id, country_id)
);

CREATE TABLE ballots (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  jury_country_id TEXT NOT NULL REFERENCES countries(id) ON DELETE RESTRICT,
  session_id TEXT REFERENCES jury_sessions(id) ON DELETE SET NULL,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (edition_id, jury_country_id)
);

CREATE TABLE ballot_scores (
  id TEXT PRIMARY KEY,
  ballot_id TEXT NOT NULL REFERENCES ballots(id) ON DELETE CASCADE,
  recipient_country_id TEXT NOT NULL REFERENCES countries(id) ON DELETE RESTRICT,
  points INTEGER NOT NULL CHECK (points IN (12, 10, 8, 7, 6, 5, 4, 3, 2, 1)),
  UNIQUE (ballot_id, recipient_country_id),
  UNIQUE (ballot_id, points)
);

CREATE TABLE discord_representatives (
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  country_id TEXT NOT NULL REFERENCES countries(id) ON DELETE RESTRICT,
  discord_user_id TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'not_sent' CHECK (delivery_status IN ('not_sent', 'sent', 'failed')),
  delivery_error_code TEXT,
  delivery_updated_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (edition_id, country_id),
  UNIQUE (edition_id, discord_user_id)
);

CREATE TABLE admin_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE login_attempts (
  scope TEXT NOT NULL,
  identifier_hash TEXT NOT NULL,
  window_started_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  blocked_until TEXT,
  PRIMARY KEY (scope, identifier_hash)
);

CREATE TABLE integration_nonces (
  nonce TEXT PRIMARY KEY,
  key_id TEXT NOT NULL,
  used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  edition_id TEXT REFERENCES editions(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'integration', 'jury', 'system')),
  actor_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX ballot_scores_recipient ON ballot_scores(recipient_country_id);

