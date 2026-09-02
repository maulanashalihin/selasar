-- 0007_user_sites.sql — per-site access control.
-- Direct user-site assignment: admin assigns sites to users.
-- Admins bypass (see accessibleSites/accessibleSite in db.ts).
-- Site creators are auto-assigned on creation (see sites.routes.ts).

CREATE TABLE IF NOT EXISTS user_sites (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id   INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, site_id)
);

CREATE INDEX IF NOT EXISTS idx_user_sites_user ON user_sites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sites_site ON user_sites(site_id);
