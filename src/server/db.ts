/**
 * bun:sqlite layer — synchronous, zero-ORM.
 * Schema comes from migrations/ (see migrations.ts); statements are
 * prepared once, after migrations are applied.
 */
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Role } from "../shared/types";
import { config } from "./config";
import { migrate } from "./migrations";

export interface UserRow {
	id: number;
	name: string;
	email: string;
	passwordHash: string;
	role: Role;
	googleId: string | null;
	avatarUrl: string | null;
	emailVerified: number; // 0 or 1 (SQLite boolean)
	createdAt: string;
}

export interface SessionRow {
	tokenHash: string;
	userId: number;
	flash: string;
	expiresAt: string;
	createdAt: string;
}

export interface PasswordResetRow {
	email: string;
	tokenHash: string;
	expiresAt: string;
}

/** The user shape that may leave the server (never includes passwordHash). */
export type PublicUser = Omit<UserRow, "passwordHash" | "googleId" | "emailVerified"> & { emailVerified: boolean };

export const toPublicUser = (row: UserRow): PublicUser => ({
	id: row.id,
	name: row.name,
	email: row.email,
	role: row.role,
	avatarUrl: row.avatarUrl,
	emailVerified: row.emailVerified === 1,
	createdAt: row.createdAt,
});
if (config.dbPath !== ":memory:") mkdirSync(dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath, { create: true });
db.exec("PRAGMA journal_mode = WAL");
// WAL + synchronous=NORMAL: skip fsync per commit — measured ~27× faster
// writes (3.5K → 95K/s on M4 NVMe, ~48× on HDD VPS). Tradeoff: on power
// loss the last transactions in WAL may be lost (DB stays consistent).
// Use FULL for zero-loss requirements (e.g. financial transactions).
db.exec("PRAGMA synchronous = NORMAL");
// Concurrent writes (e.g. two tus PATCHes) wait up to 5s instead of
// failing with SQLITE_BUSY.
db.exec("PRAGMA busy_timeout = 5000");
db.exec("PRAGMA foreign_keys = ON");

// Apply pending migrations before any statement is prepared/used.
migrate(db);

/** Cheap liveness probe for the /health endpoint. */
export const pingDb = db.query<{ n: number }, []>(`SELECT 1 AS n`);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const createUser = db.query<{ id: number }, [string, string, string]>(
	`INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?) RETURNING id`,
);
export const createUserWithRole = db.query<
	{ id: number },
	[string, string, string, Role]
>(
	`INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id`,
);
export const createGoogleUser = db.query<
	{ id: number },
	[string, string, string, string]
>(
	`INSERT INTO users (name, email, password_hash, google_id, avatar_url) VALUES (?, ?, '', ?, ?) RETURNING id`,
);
export const findUserByEmail = db.query<UserRow, [string]>(
	`SELECT id, name, email, password_hash AS passwordHash, role, google_id AS googleId, avatar_url AS avatarUrl, email_verified AS emailVerified, created_at AS createdAt FROM users WHERE email = ?`,
);
export const findUserById = db.query<UserRow, [number]>(
	`SELECT id, name, email, password_hash AS passwordHash, role, google_id AS googleId, avatar_url AS avatarUrl, email_verified AS emailVerified, created_at AS createdAt FROM users WHERE id = ?`,
);
export const findUserByGoogleId = db.query<UserRow, [string]>(
	`SELECT id, name, email, password_hash AS passwordHash, role, google_id AS googleId, avatar_url AS avatarUrl, email_verified AS emailVerified, created_at AS createdAt FROM users WHERE google_id = ?`,
);
export const linkGoogleAccount = db.query<null, [string, number]>(
	`UPDATE users SET google_id = ? WHERE id = ?`,
);
export const updateUserPassword = db.query<null, [string, number]>(
	`UPDATE users SET password_hash = ? WHERE id = ?`,
);
export const updateUserAvatar = db.query<null, [string, number]>(
	`UPDATE users SET avatar_url = ? WHERE id = ?`,
);
export const updateUserProfile = db.query<null, [string, string, number]>(
	`UPDATE users SET name = ?, email = ? WHERE id = ?`,
);
export const countUsers = db.query<{ n: number }, []>(
	`SELECT COUNT(*) AS n FROM users`,
);
export const listUsers = db.query<UserRow, [number, number]>(
	`SELECT id, name, email, password_hash AS passwordHash, role, google_id AS googleId, avatar_url AS avatarUrl, email_verified AS emailVerified, created_at AS createdAt FROM users ORDER BY id DESC LIMIT ? OFFSET ?`,
);
export const recentUsers = db.query<UserRow, [number]>(
	`SELECT id, name, email, password_hash AS passwordHash, role, google_id AS googleId, avatar_url AS avatarUrl, email_verified AS emailVerified, created_at AS createdAt FROM users ORDER BY id DESC LIMIT ?`,
);

export const deleteUser = db.query<null, [number]>(
	`DELETE FROM users WHERE id = ?`,
);

export const updateUserRole = db.query<null, [Role, number]>(
	`UPDATE users SET role = ? WHERE id = ?`,
);

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export const insertSession = db.query<null, [string, number, string]>(
	`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)`,
);
export const findSession = db.query<SessionRow, [string]>(
	`SELECT token_hash AS tokenHash, user_id AS userId, flash, expires_at AS expiresAt, created_at AS createdAt FROM sessions WHERE token_hash = ?`,
);
export const deleteSession = db.query<null, [string]>(
	`DELETE FROM sessions WHERE token_hash = ?`,
);
export const deleteOtherSessions = db.query<null, [number, string]>(
	`DELETE FROM sessions WHERE user_id = ? AND token_hash != ?`,
);
export const updateSessionFlash = db.query<null, [string, string]>(
	`UPDATE sessions SET flash = ? WHERE token_hash = ?`,
);

// ---------------------------------------------------------------------------
// Password resets
// ---------------------------------------------------------------------------

export const insertPasswordReset = db.query<null, [string, string, string]>(
	`INSERT INTO password_resets (email, token_hash, expires_at) VALUES (?, ?, ?)`,
);
export const findPasswordReset = db.query<PasswordResetRow, [string]>(
	`SELECT email, token_hash AS tokenHash, expires_at AS expiresAt FROM password_resets WHERE token_hash = ?`,
);
export const deletePasswordResetsByEmail = db.query<null, [string]>(
	`DELETE FROM password_resets WHERE email = ?`,
);

// ---------------------------------------------------------------------------
// Email verification
// ---------------------------------------------------------------------------

export interface EmailVerificationRow {
	tokenHash: string;
	userId: number;
	expiresAt: string;
}

export const insertEmailVerification = db.query<
	null,
	[string, number, string]
>(
	`INSERT INTO email_verifications (token_hash, user_id, expires_at) VALUES (?, ?, ?)`,
);
export const findEmailVerification = db.query<EmailVerificationRow, [string]>(
	`SELECT token_hash AS tokenHash, user_id AS userId, expires_at AS expiresAt FROM email_verifications WHERE token_hash = ?`,
);
export const deleteEmailVerification = db.query<null, [string]>(
	`DELETE FROM email_verifications WHERE token_hash = ?`,
);
export const deleteUserEmailVerifications = db.query<null, [number]>(
	`DELETE FROM email_verifications WHERE user_id = ?`,
);
export const verifyUserEmail = db.query<null, [number]>(
	`UPDATE users SET email_verified = 1 WHERE id = ?`,
);
// ---------------------------------------------------------------------------
// Uploads (tus)
// ---------------------------------------------------------------------------

export interface UploadRow {
	id: string;
	uploadLength: number;
	offset: number;
	metadata: string;
	userId: number | null;
	path: string;
	createdAt: string;
	expiresAt: string | null;
}

export const insertUpload = db.query<
	null,
	[string, number, string, number | null, string, string | null]
>(
	`INSERT INTO uploads (id, upload_length, metadata, user_id, path, expires_at)
   VALUES (?, ?, ?, ?, ?, ?)`,
);

export const findUpload = db.query<UploadRow, [string]>(
	`SELECT id, upload_length AS uploadLength, offset, metadata, user_id AS userId, path, created_at AS createdAt, expires_at AS expiresAt FROM uploads WHERE id = ?`,
);

/** Atomically advance the offset only if the current offset matches `expected`.
 *  Returns the number of rows updated (1 on success, 0 on conflict). */
export const advanceOffset = db.query<{ n: number }, [number, string, number]>(
	`UPDATE uploads SET offset = offset + ? WHERE id = ? AND offset = ? RETURNING 1 AS n`,
);

export const deleteUpload = db.query<null, [string]>(
	`DELETE FROM uploads WHERE id = ?`,
);

/** Uploads whose expiration has passed (used by the sweep job). Caller passes
 *  `now` (ISO) so tests can control time. */
export const listExpired = db.query<UploadRow, [string]>(
	`SELECT id, upload_length AS uploadLength, offset, metadata, user_id AS userId, path, created_at AS createdAt, expires_at AS expiresAt FROM uploads WHERE expires_at IS NOT NULL AND expires_at < ?`,
);

// ---------------------------------------------------------------------------
// Sites (analytics — internal tool, all users access all sites)
// ---------------------------------------------------------------------------

export interface SiteRow {
	id: number;
	createdBy: number;
	name: string;
	trackingId: string;
	primaryDomain: string | null;
	timezone: string;
	autoAcceptDomains: boolean;
	createdAt: string;
}

export interface SiteDomainRow {
	id: number;
	siteId: number;
	domain: string;
	createdAt: string;
}

export interface SiteWithDomains extends SiteRow {
	domains: SiteDomainRow[];
}

export const createSite = db.query<
	{ id: number },
	[number, string, string, string]
>(
	`INSERT INTO sites (created_by, name, tracking_id, timezone) VALUES (?, ?, ?, ?) RETURNING id`,
);

export const findSiteById = db.query<SiteRow, [number]>(
	`SELECT id, created_by AS createdBy, name, tracking_id AS trackingId, primary_domain AS primaryDomain, timezone, auto_accept_domains AS autoAcceptDomains, created_at AS createdAt FROM sites WHERE id = ?`,
);

export const findSiteByTrackingId = db.query<SiteRow, [string]>(
	`SELECT id, created_by AS createdBy, name, tracking_id AS trackingId, primary_domain AS primaryDomain, timezone, auto_accept_domains AS autoAcceptDomains, created_at AS createdAt FROM sites WHERE tracking_id = ?`,
);

/** Internal tool: all users see all sites. */
export const listSites = db.query<SiteRow, []>(
	`SELECT id, created_by AS createdBy, name, tracking_id AS trackingId, primary_domain AS primaryDomain, timezone, auto_accept_domains AS autoAcceptDomains, created_at AS createdAt FROM sites ORDER BY id DESC`,
);

export const updateSite = db.query<null, [string, string, number, number]>(
	`UPDATE sites SET name = ?, timezone = ?, auto_accept_domains = ? WHERE id = ?`,
);

/** Set primary domain — app must ensure domain exists in site_domains first. */
export const setPrimaryDomain = db.query<null, [string, number]>(
	`UPDATE sites SET primary_domain = ? WHERE id = ?`,
);

export const deleteSite = db.query<null, [number]>(
	`DELETE FROM sites WHERE id = ?`,
);

export const addDomain = db.query<{ id: number }, [number, string]>(
	`INSERT INTO site_domains (site_id, domain) VALUES (?, ?) RETURNING id`,
);

export const removeDomain = db.query<null, [number, number]>(
	`DELETE FROM site_domains WHERE id = ? AND site_id = ?`,
);

export const listDomains = db.query<SiteDomainRow, [number]>(
	`SELECT id, site_id AS siteId, domain, created_at AS createdAt FROM site_domains WHERE site_id = ? ORDER BY id`,
);

/** Resolve domain → site at ingestion. Returns site if domain is registered. */
export const findSiteByDomain = db.query<SiteRow, [string]>(
	`SELECT s.id, s.created_by AS createdBy, s.name, s.tracking_id AS trackingId, s.primary_domain AS primaryDomain, s.timezone, s.auto_accept_domains AS autoAcceptDomains, s.created_at AS createdAt
   FROM sites s
   JOIN site_domains d ON d.site_id = s.id
   WHERE d.domain = ?`,
);

/** Check if a specific domain is registered for a site. */
export const isDomainRegistered = db.query<{ n: number }, [number, string]>(
	`SELECT 1 AS n FROM site_domains WHERE site_id = ? AND domain = ?`,
);

// ---------------------------------------------------------------------------
// Per-site access control (user_sites junction)
// ---------------------------------------------------------------------------

/** Sites assigned to a user (non-admin). Admins use listSites.all(). */
export const listUserSites = db.query<SiteRow, [number]>(
	`SELECT s.id, s.created_by AS createdBy, s.name, s.tracking_id AS trackingId, s.primary_domain AS primaryDomain, s.timezone, s.auto_accept_domains AS autoAcceptDomains, s.created_at AS createdAt
   FROM sites s JOIN user_sites us ON us.site_id = s.id
   WHERE us.user_id = ? ORDER BY s.id DESC`,
);

/** Single site accessible by user (non-admin), or null. Admins use findSiteById.get(). */
export const findSiteForUser = db.query<SiteRow, [number, number]>(
	`SELECT s.id, s.created_by AS createdBy, s.name, s.tracking_id AS trackingId, s.primary_domain AS primaryDomain, s.timezone, s.auto_accept_domains AS autoAcceptDomains, s.created_at AS createdAt
   FROM sites s JOIN user_sites us ON us.site_id = s.id
   WHERE s.id = ? AND us.user_id = ?`,
);

/** Check membership: returns row if user has access to site. */
export const userHasSiteAccess = db.query<{ n: number }, [number, number]>(
	`SELECT 1 AS n FROM user_sites WHERE user_id = ? AND site_id = ?`,
);

/** Assign site to user (idempotent — INSERT OR IGNORE). */
export const assignSiteToUser = db.query<null, [number, number]>(
	`INSERT OR IGNORE INTO user_sites (user_id, site_id) VALUES (?, ?)`,
);

/** Remove site access from user. */
export const unassignSiteFromUser = db.query<null, [number, number]>(
	`DELETE FROM user_sites WHERE user_id = ? AND site_id = ?`,
);

/** Site IDs assigned to a user (for admin UI). */
export const listAssignedSiteIds = db.query<{ siteId: number }, [number]>(
	`SELECT site_id AS siteId FROM user_sites WHERE user_id = ? ORDER BY site_id`,
);

/** Count of sites assigned to each user (for admin user list). */
export const countSitesPerUser = db.query<{ userId: number; n: number }, []>(
	`SELECT user_id AS userId, COUNT(*) AS n FROM user_sites GROUP BY user_id`,
);

// --- Access helpers (admin bypasses; users see only assigned) ---

/** Sites accessible by user. Admins see all; users see only assigned. */
export function accessibleSites(user: { id: number; role: Role }): SiteRow[] {
	return user.role === "admin" ? listSites.all() : listUserSites.all(user.id);
}

/** Single site accessible by user, or null. Admins see all; users see only assigned. */
export function accessibleSite(
	siteId: number,
	user: { id: number; role: Role },
): SiteRow | null {
	return user.role === "admin"
		? findSiteById.get(siteId)
		: findSiteForUser.get(siteId, user.id);
}

/** Boolean access check for JSON API endpoints. */
export function canAccessSite(
	siteId: number,
	user: { id: number; role: Role },
): boolean {
	if (user.role === "admin") return true;
	return userHasSiteAccess.get(user.id, siteId) !== undefined;
}

// ---------------------------------------------------------------------------
// API keys (programmatic analytics access)
// ---------------------------------------------------------------------------

export interface ApiKeyRow {
	id: number;
	userId: number;
	keyHash: string;
	label: string | null;
	createdAt: string;
	lastUsedAt: string | null;
	revokedAt: string | null;
}

export const createApiKey = db.query<{ id: number }, [number, string, string]>(
	`INSERT INTO api_keys (user_id, key_hash, label) VALUES (?, ?, ?) RETURNING id`,
);

export const findApiKeyByHash = db.query<ApiKeyRow, [string]>(
	`SELECT id, user_id AS userId, key_hash AS keyHash, label, created_at AS createdAt, last_used_at AS lastUsedAt, revoked_at AS revokedAt FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL`,
);

export const listApiKeysByUser = db.query<ApiKeyRow, [number]>(
	`SELECT id, user_id AS userId, key_hash AS keyHash, label, created_at AS createdAt, last_used_at AS lastUsedAt, revoked_at AS revokedAt FROM api_keys WHERE user_id = ? AND revoked_at IS NULL ORDER BY id DESC`,
);

export const revokeApiKey = db.query<null, [number, number]>(
	`UPDATE api_keys SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND user_id = ?`,
);

export const touchApiKey = db.query<null, [number]>(
	`UPDATE api_keys SET last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
);

// ---------------------------------------------------------------------------
// Conversion goals (per site)
// ---------------------------------------------------------------------------

export interface ConversionGoalRow {
	id: number;
	siteId: number;
	name: string;
	goalType: string;
	goalValue: string;
	createdAt: string;
}

export const createGoal = db.query<
	{ id: number },
	[number, string, string, string]
>(
	`INSERT INTO conversion_goals (site_id, name, goal_type, goal_value) VALUES (?, ?, ?, ?) RETURNING id`,
);

export const listGoals = db.query<ConversionGoalRow, [number]>(
	`SELECT id, site_id AS siteId, name, goal_type AS goalType, goal_value AS goalValue, created_at AS createdAt FROM conversion_goals WHERE site_id = ? ORDER BY id`,
);

export const deleteGoal = db.query<null, [number, number]>(
	`DELETE FROM conversion_goals WHERE id = ? AND site_id = ?`,
);

// ---------------------------------------------------------------------------
// Dashboard preferences (per user per site)
// ---------------------------------------------------------------------------

export interface DashboardPrefsRow {
	userId: number;
	siteId: number;
	defaultRange: string;
}

export const getPrefs = db.query<DashboardPrefsRow, [number, number]>(
	`SELECT user_id AS userId, site_id AS siteId, default_range AS defaultRange FROM dashboard_prefs WHERE user_id = ? AND site_id = ?`,
);

export const setPrefs = db.query<null, [number, number, string]>(
	`INSERT INTO dashboard_prefs (user_id, site_id, default_range) VALUES (?, ?, ?)
   ON CONFLICT(user_id, site_id) DO UPDATE SET default_range = excluded.default_range`,
);
