-- 0006_sites.sql — analytics sites + multi-domain support.
-- Internal tool: all users access all sites. created_by = audit only.
-- One site = one logical entity (tracking_id), can have many domains.
-- All traffic from all domains aggregates under a single site_id.

CREATE TABLE IF NOT EXISTS sites (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  created_by    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  tracking_id   TEXT NOT NULL UNIQUE,
  primary_domain TEXT,  -- canonical primary domain, must exist in site_domains
  timezone      TEXT NOT NULL DEFAULT 'UTC',
  auto_accept_domains INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_sites_created_by ON sites(created_by);
CREATE INDEX IF NOT EXISTS idx_sites_tracking_id ON sites(tracking_id);

CREATE TABLE IF NOT EXISTS site_domains (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id       INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  domain        TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(site_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_site_domains_site ON site_domains(site_id);
CREATE INDEX IF NOT EXISTS idx_site_domains_domain ON site_domains(domain);

-- API keys for programmatic analytics access (internal tool — admin generates)
CREATE TABLE IF NOT EXISTS api_keys (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash     TEXT NOT NULL UNIQUE,
  label        TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_used_at TEXT,
  revoked_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- Conversion goals: user defines what counts as conversion per site
CREATE TABLE IF NOT EXISTS conversion_goals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id     INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  goal_type   TEXT NOT NULL,  -- 'page_visit' | 'event'
  goal_value  TEXT NOT NULL,  -- '/thank-you' or 'signup_click'
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_conversion_goals_site ON conversion_goals(site_id);

-- Dashboard preferences per user per site
CREATE TABLE IF NOT EXISTS dashboard_prefs (
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id       INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  default_range TEXT NOT NULL DEFAULT '7d',
  PRIMARY KEY (user_id, site_id)
);
