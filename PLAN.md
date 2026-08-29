# GA Clone — Implementation Plan

## Overview

Google Analytics clone built on Dulak boilerplate (Svelte 5 + Hono + Inertia + bun:sqlite).
Analytics engine: ClickHouse. Multi-domain per site (1 site_id = many domains, traffic aggregated).

## Architecture

```
Client websites (any domain)
  ↓ tracker.js (2KB, async)
  ↓ POST /api/event (CF Pages Function, edge)
  ↓ batch buffer (2s or 500 events)
  ↓
  ClickHouse (events table + MVs)
  ↑ dashboard queries (HTTP, localhost)
  ↑
Bun server (Hono)
  ├── /dashboard/*     → ClickHouse queries → Inertia Svelte pages
  ├── /api/sites       → SQLite CRUD (sites, site_domains)
  ├── /api/analytics/* → ClickHouse JSON endpoints (for SPA navigation)
  └── /auth/*          → SQLite (users, sessions) — already from dulak
```

## Phase 1: Database Schema

### 1a. SQLite migrations (OLTP — sites, domains, API keys)

```
migrations/0006_sites.sql
```

```sql
CREATE TABLE IF NOT EXISTS sites (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  created_by    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,              -- "My Company Website"
  tracking_id   TEXT NOT NULL UNIQUE,       -- public ID for tracker.js
  primary_domain TEXT,                      -- canonical primary domain, must exist in site_domains
  timezone      TEXT NOT NULL DEFAULT 'UTC',
  auto_accept_domains INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_sites_created_by ON sites(created_by);
CREATE INDEX IF NOT EXISTS idx_sites_tracking_id ON sites(tracking_id);

CREATE TABLE IF NOT EXISTS site_domains (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id       INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  domain        TEXT NOT NULL,              -- mycompany.com
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(site_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_site_domains_site ON site_domains(site_id);
CREATE INDEX IF NOT EXISTS idx_site_domains_domain ON site_domains(domain);

-- API keys for programmatic analytics access (admin generates)
CREATE TABLE IF NOT EXISTS api_keys (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash     TEXT NOT NULL UNIQUE,
  label        TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
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
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_conversion_goals_site ON conversion_goals(site_id);

-- Dashboard preferences per user per site
CREATE TABLE IF NOT EXISTS dashboard_prefs (
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id       INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  default_range TEXT NOT NULL DEFAULT '7d',
  PRIMARY KEY (user_id, site_id)
);
```

### 1b. ClickHouse schema (analytics — events + materialized views)

```sql
-- Raw events: append-only, tagged with site_id (not domain)
CREATE TABLE events (
  site_id       UInt32,
  domain        LowCardinality(String),
  event_time    DateTime,
  event_date    Date,
  event_name    LowCardinality(String),
  visitor_id    String,
  session_id    String,
  page_path     String,
  page_title    String,
  source        LowCardinality(String),
  medium        LowCardinality(String),
  device        LowCardinality(String),
  browser       LowCardinality(String),
  country       LowCardinality(String),
  city          LowCardinality(String),
  duration_ms   UInt32,
  is_new_visitor UInt8,
  is_bounce     UInt8
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (site_id, event_date, event_name)
SETTINGS index_granularity = 8192;

-- MV: daily aggregated stats per site
CREATE MATERIALIZED VIEW daily_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (site_id, date, source, medium, device, country)
AS SELECT
  site_id,
  event_date AS date,
  source, medium, device, country,
  count() AS events,
  countIf(event_name = 'pageview') AS pageviews,
  countIf(event_name = 'conversion') AS conversions,
  uniqState(visitor_id) AS unique_visitors,
  uniqState(session_id) AS unique_sessions,
  sum(duration_ms) AS total_duration,
  sum(is_bounce) AS bounces
FROM events
GROUP BY site_id, event_date, source, medium, device, country;

-- MV: per-page daily stats
CREATE MATERIALIZED VIEW page_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (site_id, date, page_path)
AS SELECT
  site_id,
  event_date AS date,
  page_path,
  count() AS views,
  uniqState(visitor_id) AS unique_visitors,
  sum(duration_ms) AS total_duration
FROM events
WHERE event_name = 'pageview'
GROUP BY site_id, event_date, page_path;
```

### 1c. ClickHouse client module

```
src/server/clickhouse.ts
```

- HTTP client to ClickHouse (localhost:8123)
- Query helper: `chQuery(sql) → rows`
- Insert helper: `chInsert(table, rows[])`
- Config: `CLICKHOUSE_URL` env var (default `http://localhost:8123`)
- Schema init script: `scripts/init-clickhouse.ts`

### 1d. SQLite queries for sites/domains/goals/keys/prefs

Add to `src/server/db.ts`:
- `createSite(createdBy, name, trackingId)` — audit only, not ownership
- `findSiteById(id)`
- `findSiteByTrackingId(trackingId)` — used by ingestion
- `listSites()` — all sites, all users see all (internal tool)
- `updateSite(name, timezone, autoAccept, id)`
- `setPrimaryDomain(domain, siteId)` — app must ensure domain exists in site_domains first
- `deleteSite(id)`
- `addDomain(siteId, domain)`
- `removeDomain(id, siteId)`
- `listDomains(siteId)`
- `findSiteByDomain(domain)` — resolve domain → site_id at ingestion
- `isDomainRegistered(siteId, domain)`
- API keys: `createApiKey`, `findApiKeyByHash`, `listApiKeysByUser`, `revokeApiKey`, `touchApiKey`
- Conversion goals: `createGoal`, `listGoals`, `deleteGoal`
- Dashboard prefs: `getPrefs`, `setPrefs`

## Phase 2: Event Ingestion

### 2a. CF Pages Function — edge ingestion

```
functions/api/event.ts
```

- Receives POST with event payload from tracker.js
- Resolves `tracking_id → site_id` (lookup from SQLite via API, or D1 KV cache)
- Captures: domain, path, referrer, UA (parse to device/browser), country (from CF-IPCountry header)
- Generates: visitor_id (hash of IP+UA+site_id), session_id (hash of visitor_id + 30min window)
- Buffers events in memory (or CF Durable Objects)
- Flushes batch to ClickHouse every 2s or 500 events
- Returns 204 No Content (fire-and-forget, tracker doesn't wait)

**CORS — standard industry practice:**
- `Access-Control-Allow-Origin: *` (tracker.js dari domain manapun POST ke sini)
- `Access-Control-Allow-Methods: POST`
- `Access-Control-Allow-Headers: Content-Type`
- Tidak perlu credentials, tidak ada cookie — simple wildcard OK

**tracking_id generation (saat create site):**
- `crypto.randomUUID()` — native Bun 1.4, pakai BoringSSL RAND_bytes (single DRBG)
- Format: `crypto.randomUUID()` (36 chars, URL-safe, RFC 4122 v4)
- Zero dependency, zero allocation overhead — paling ringan
- Contoh: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

**Referrer → source/medium parsing:**

```
Referrer: https://www.google.com/search?q=shoes
  → source: "google",    medium: "organic"

Referrer: https://t.co/abc123
  → source: "twitter",   medium: "social"

Referrer: https://mycompany.com/blog
  → source: "mycompany.com", medium: "referral"  (internal cross-link)

No referrer (typed URL / bookmark)
  → source: "(direct)",  medium: "(none)"
```

Rules:
- Search engines (google, bing, duckduckgo, yandex, baidu) → medium: "organic"
- Social (twitter/x, facebook, linkedin, instagram, reddit, youtube) → medium: "social"
- Same domain as event → medium: "referral" (internal)
- Other external → medium: "referral"
- Empty referrer → source: "(direct)", medium: "(none)"

**UA parsing — custom 10-line parser (zero dependency):**

```ts
function parseUA(ua: string): { device: string; browser: string } {
  const device = /iPad|Tablet|PlayBook|Silk/.test(ua) ? 'tablet'
    : /Mobile|Android|iPhone|iPod/.test(ua) ? 'mobile'
    : 'desktop';
  const browser = /Edg\//.test(ua) ? 'edge'
    : /Firefox\//.test(ua) ? 'firefox'
    : /Chrome\//.test(ua) ? 'chrome'
    : /Safari\//.test(ua) ? 'safari'
    : 'other';
  return { device, browser };
}
```

Kenapa custom, bukan library (lightua 2.2KB, ua-lite 6KB):
- Analytics cuma butuh device type + browser name — 5 values
- ClickHouse pakai `LowCardinality(String)` — values terbatas, tidak perlu akurasi 100%
- 10 lines vs 6KB library + dependency maintenance
- Bot detection tidak perlu — CF sudah filter bot di edge

### 2b. Tracker script

```
public/tracker.js  (~3KB, vanilla JS, no dependency)
```

**Install — 1 baris di HTML visitor:**

```html
<script defer src="https://analytics.dulak.pages.dev/tracker.js"
        data-tracking-id="maulanashalihin-abc123"></script>
```

Selesai. Pageview, duration, bounce rate, device, browser, country, referrer —
semua otomatis. Tidak perlu `track()` call manual untuk basic analytics.

**Event types:**

| Event | Trigger | Otomatis? |
|---|---|---|
| `pageview` | Page load | ✓ auto |
| `heartbeat` | Setiap 10s saat tab visible | ✓ auto |
| `exit` | `pagehide` / `beforeunload` | ✓ auto |
| `bounce` | Tidak ada heartbeat dalam 30s | ✓ server-side detect |
| custom (`signup_click`, `download`, dll) | `analytics.track()` call | manual, optional |

**Custom events (optional, untuk conversion tracking):**

```js
// Visitor code this explicitly — connect ke conversion_goals table
analytics.track('signup_click', { plan: 'pro' });
analytics.track('download', { file: 'whitepaper.pdf' });
```

Admin define goal "event = signup_click" di dashboard, sistem auto-match
dan hitung conversion rate.

**Client cuma kirim event, tidak resolve apa-apa.** Semua heavy lifting
(site_id resolution, visitor hashing, batching, dedup, bounce detection)
di server-side. Client tidak tahu site_id, tidak tahu IP, tidak tahu visitor_id.

- Generates anonymous visitor_id: `hash(IP + UA + site_id)` (server-side, from headers)
- site_id included in hash to prevent cross-site visitor correlation —
  same person visiting site_id=1 and site_id=2 gets different visitor_ids,
  so even with direct ClickHouse access, cross-site tracking is impossible
- Session: `session_id = hash(visitor_id + floor(event_time / 1800))`
  — 30min window bucketing, no server-side state needed
  — new event after 30 min gap = new session_id automatically
  — `is_new_visitor = 1` if visitor_id not seen in ClickHouse before today

**Engagement tracking — `navigator.sendBeacon()` + heartbeat (bukan SSE/WS):**

```
Page load → send pageview event (timestamp T0)
  ↓
Every 10s while visible → send heartbeat ping (engaged time)
  ↓
visibilitychange → hidden → pause heartbeat, record gap
visibilitychange → visible → resume heartbeat
  ↓
pagehide / beforeunload → sendBeacon(final duration)
```

Kenapa `sendBeacon` bukan WebSocket/SSE:
- SSE = server→client (one-way) — arah salah, kita butuh client→server
- WebSocket = butuh Durable Objects di CF Pages (kompleksitas naik), overkill
- `sendBeacon` = HTTP POST, fire-and-forget, browser buffer saat page unload
- GA4, Plausible, Fathom semua pakai approach ini
- CF Pages Functions support POST endpoint, tidak support WS

```js
// 3 event types: pageview, heartbeat, exit
// duration_ms dihitung server-side dari delta timestamp antar ping

let lastPing = Date.now();

// Heartbeat: kirim ping setiap 10s saat tab visible
setInterval(() => {
  if (document.visibilityState === 'visible') {
    navigator.sendBeacon(ENDPOINT, JSON.stringify({
      type: 'heartbeat',
      tracking_id: TRACKING_ID,
      path: location.pathname,
      ts: Date.now()
    }));
  }
}, 10000);

// Exit: kirim duration final saat page unload
document.addEventListener('pagehide', () => {
  navigator.sendBeacon(ENDPOINT, JSON.stringify({
    type: 'exit',
    tracking_id: TRACKING_ID,
    path: location.pathname,
    duration_ms: Date.now() - lastPing,
    ts: Date.now()
  }));
});
```

Server-side: simpan `last_ping_ts` per `visitor_id + session_id`, update setiap
heartbeat. Duration = sum of heartbeat intervals (10s each) while visible.
Atau simpler: hitung duration saat query dari delta timestamp antar event.

### 2c. Ingestion fallback (Bun server)

```
src/server/routes/event.routes.ts
```

- Same logic as CF Function, but runs on Bun server
- For dev/local: events go directly to ClickHouse
- For production without CF: fallback ingestion endpoint
- Rate limited per tracking_id

**End-to-end flow:**

```
Visitor HTML
  ↓
tracker.js load (auto)
  ↓
sendBeacon(POST /api/event)  ← pageview + heartbeat + exit
  ↓
CF Pages Function / Bun fallback
  ↓ resolve tracking_id → site_id
  ↓ hash(IP + UA + site_id) → visitor_id
  ↓ batch buffer (2s or 500 events)
  ↓
ClickHouse INSERT (batch)
  ↓
events table + daily_stats MV + page_stats MV (auto-aggregate)
  ↓
Dashboard query → hit MV, <1ms response
```

## Phase 3: Dashboard UI

### 3a. Install shadcn-svelte

```bash
bunx shadcn-svelte@latest init
bunx shadcn-svelte@latest add card badge table tabs select chart separator skeleton
```

### 3b. Dashboard pages

```
src/client/pages/
├── Analytics.svelte          — main analytics dashboard (replaces Dulak Dashboard)
├── analytics/
│   ├── Overview.svelte       — metric cards + traffic chart + breakdowns
│   ├── Realtime.svelte       — live visitor count + current pages
│   ├── Pages.svelte          — top pages table with trends
│   ├── Sources.svelte        — traffic sources breakdown
│   ├── Devices.svelte        — device/browser/OS breakdown
│   ├── Geography.svelte      — world map + country table
│   └── Conversions.svelte    — conversion goals + inline "What is a conversion goal?" explanation
├── Sites.svelte              — site list + create/edit
├── SiteSettings.svelte       — manage domains, tracking code, settings
├── admin/
│   └── Users.svelte          — admin-only: create/list/delete users (replaces public registration)
├── ApiKeys.svelte            — manage API keys (create/revoke, plaintext shown once)

### 3c. Dashboard components

```
src/client/components/analytics/
├── MetricCard.svelte         — number + delta badge + sparkline
├── DeltaBadge.svelte         — +12.5% ↑ green / -3% ↓ red
├── TrafficChart.svelte       — LayerChart LineChart (visitors over time)
├── BreakdownTable.svelte     — sortable table with percentage bars
├── WorldMap.svelte           — svg-world-maps choropleth
├── DateRangePicker.svelte    — tabs: Today / 7d / 30d / 90d + custom
├── SiteSwitcher.svelte       — dropdown to switch between sites
├── Sparkline.svelte          — mini LineChart for metric cards
└── LiveBadge.svelte          — realtime visitor count (polling)
```

### 3d. App navigation + layout — Dulak conversion

**Dulak sekarang:**

```
Routes:
  /              → Home.svelte (public, CDN-cached)
  /login         → Login.svelte
  /register      → Register.svelte (SUDAH DIHAPUS)
  /dashboard     → Dashboard.svelte (user count + recent users)
  /admin         → Admin.svelte (user list + pagination)
  /profile       → Profile.svelte (name/email/password/avatar)
  /uploads       → TUS upload handler
  /auth/google   → Google OAuth

Layout.svelte sidebar:
  NAV_ITEMS = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/profile',   label: 'Profile' },
    { href: '/admin',     label: 'Admin', roles: ['admin'] },
  ]

Components: Layout, AuthLayout, Brand, Field
```

**Konversi ke GA Analytics:**

| Dulak sekarang | GA Analytics | Aksi |
|---|---|---|
| `/` Home.svelte | `/` Home.svelte | Keep — landing page, tapi ganti "Create account" link (sudah dihapus) |
| `/login` Login.svelte | `/login` Login.svelte | Keep — hapus register link (sudah dihapus) |
| `/register` Register.svelte | — | Hapus file (route sudah dihapus) |
| `/dashboard` Dashboard.svelte | redirect → `/sites` | Hapus Dashboard.svelte, ganti route jadi redirect |
| `/admin` Admin.svelte | redirect → `/admin/users` | Hapus Admin.svelte, ganti route jadi redirect |
| `/profile` Profile.svelte | `/settings/profile` Profile.svelte | Keep — pindah ke /settings/, reuse untuk name/email/password/avatar |
| `/uploads` TUS | `/uploads` TUS | Keep — masih dipakai untuk avatar upload |
| `/auth/google` Google OAuth | `/auth/google` | Keep — optional login |
| Layout.svelte NAV_ITEMS | Layout.svelte NAV_ITEMS baru | Update nav items (lihat sidebar di bawah) |
| Admin.svelte (user table) | admin/Users.svelte | Reuse table + pagination logic, tambah create/delete user |
| Dashboard.svelte | — | Hapus — tidak relevan lagi (bukan user counter) |

**File yang dihapus:**
- `src/client/pages/Dashboard.svelte` — tidak relevan
- `src/client/pages/Register.svelte` — register disabled

**File yang dipindah/rename:**
- `Admin.svelte` → `admin/Users.svelte` (reuse table + pagination, tambah create/delete)

**File yang tetap:**
- `Home.svelte`, `Login.svelte`, `Profile.svelte`, `ForgotPassword.svelte`, `ResetPassword.svelte`, `NotFound.svelte`
- `Layout.svelte`, `AuthLayout.svelte`, `Brand.svelte`, `Field.svelte`

**File baru (Phase 3b):**
- `Analytics.svelte`, `analytics/Overview.svelte`, `analytics/Realtime.svelte`, `analytics/Pages.svelte`, `analytics/Sources.svelte`, `analytics/Devices.svelte`, `analytics/Geography.svelte`, `analytics/Conversions.svelte`
- `Sites.svelte`, `SiteSettings.svelte`, `ApiKeys.svelte`
- `admin/Users.svelte`

**Route changes di `pages.routes.ts`:**

```ts
// SEBELUM:
app.get("/dashboard", requireAuth, (c) => c.var.inertia.render("Dashboard", { stats }));
app.get("/admin", requireRole("admin"), (c) => c.var.inertia.render("Admin", { users }));

// SESUDAH:
app.get("/dashboard", requireAuth, (c) => c.var.inertia.redirect("/sites"));
app.get("/admin", requireRole("admin"), (c) => c.var.inertia.redirect("/admin/users"));
// Site + analytics routes di file baru: sites.routes.ts, analytics.routes.ts, admin.routes.ts
```

**Layout.svelte NAV_ITEMS baru:**

```ts
const NAV_ITEMS: NavItem[] = [
  // Analytics section — hanya tampil kalau ada site terpilih
  { href: '/sites/:id/analytics',           label: 'Overview',   match: ... },
  { href: '/sites/:id/analytics/realtime',  label: 'Realtime',   match: ... },
  { href: '/sites/:id/analytics/pages',     label: 'Pages',      match: ... },
  { href: '/sites/:id/analytics/sources',   label: 'Sources',    match: ... },
  { href: '/sites/:id/analytics/devices',   label: 'Devices',    match: ... },
  { href: '/sites/:id/analytics/geography', label: 'Geography',  match: ... },
  { href: '/sites/:id/analytics/conversions', label: 'Conversions', match: ... },
  // Management
  { href: '/sites',           label: 'Sites',     match: ... },
  { href: '/settings/keys',   label: 'API Keys',  match: ... },
  { href: '/settings/profile', label: 'Profile',  match: ... },
  // Admin
  { href: '/admin/users',     label: 'Users',     roles: ['admin'], match: ... },
]
```

**Sidebar layout (replaces Dulak's 3-item sidebar):**

```
┌──────────────────────────────────────────────────────────┐
│  [Analytics logo]                                        │
│                                                          │
│  [Site: My Company ▾]  ← site switcher (all sites)      │
│                                                          │
│  📊 Overview        /sites/:id/analytics                 │
│  ⚡ Realtime        /sites/:id/analytics/realtime        │
│  📄 Pages           /sites/:id/analytics/pages           │
│  🔗 Sources         /sites/:id/analytics/sources         │
│  📱 Devices         /sites/:id/analytics/devices         │
│  🌍 Geography       /sites/:id/analytics/geography       │
│  🎯 Conversions     /sites/:id/analytics/conversions     │
│  ─────────────                                      │
│  🌐 Sites           /sites                               │
│  ⚙️ API Keys        /settings/keys                       │
│  👤 Profile         /settings/profile                    │
│  ─────────────                                      │
│  👥 Users (admin)   /admin/users                         │
│                                                          │
│  [user@email.com ▾]  ← profile dropdown (logout)        │
└──────────────────────────────────────────────────────────┘
```

- Sidebar persistent across all pages (Inertia shared layout)
- Site switcher: dropdown list all sites, switch changes `:id` in URL
- Analytics section hidden kalau belum ada site dipilih (di `/sites` list page)
- Admin section only visible if `user.role === 'admin'`
- Dulak's `/dashboard` route → redirect to `/sites`
- Dulak's `/admin` route → redirect to `/admin/users`
- Profile pindah dari `/profile` ke `/settings/profile` (grouped dengan API keys)

**Analytics dashboard layout (content area):**

```
┌─────────────────────────────────────────────────────────┐
│  [Today|7d|30d|90d]  [↻ Live: 42]                       │
├─────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │Visitors │ │Pageviews│ │Bounce   │ │Duration │       │
│  │ 12,345  │ │ 45,678  │ │ 23%     │ │ 2m 15s  │       │
│  │+12% ▲   │ │+8% ▲    │ │-3% ▼    │ │+5% ▲    │       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
├─────────────────────────────────────────────────────────┤
│  📈 Visitors over time (line chart, full width)          │
├─────────────────────────────────────────────────────────┤
│  Top Pages    │  Sources     │  Devices    │  Countries │
│  /products    │  google      │  desktop    │  🌍 map    │
│  /blog        │  direct      │  mobile     │  US 30%    │
│  /pricing     │  facebook    │  tablet     │  ID 20%    │
└─────────────────────────────────────────────────────────┘
```

## Phase 4: API Endpoints

### 4a. Analytics API (ClickHouse queries)

```
src/server/routes/analytics.routes.ts
```

| Endpoint | Query | ClickHouse source |
|---|---|---|
| `GET /api/analytics/overview?site_id=1&range=7d` | Metric cards (visitors, pageviews, bounce, duration) | daily_stats MV |
| `GET /api/analytics/traffic?site_id=1&range=7d` | Line chart data (visitors per day) | daily_stats MV |
| `GET /api/analytics/pages?site_id=1&range=7d` | Top pages table | page_stats MV |
| `GET /api/analytics/sources?site_id=1&range=7d` | Source/medium breakdown | daily_stats MV |
| `GET /api/analytics/devices?site_id=1&range=7d` | Device/browser breakdown | daily_stats MV |
| `GET /api/analytics/geography?site_id=1&range=7d` | Country breakdown + map data | daily_stats MV |
| `GET /api/analytics/realtime?site_id=1` | Live visitor count (last 5 min) | events raw |

All endpoints:
- Auth required (any authenticated user — internal tool, all users access all sites)
- Return JSON (for Inertia SPA navigation + client-side refetch on filter change)
- `range` param: `today`, `1d`, `7d`, `30d`, `90d`, or `from=YYYY-MM-DD&to=YYYY-MM-DD`

### 4b. Site management API (SQLite)

```
src/server/routes/sites.routes.ts
```

| Endpoint | Action |
|---|---|
| `GET /api/sites` | List all sites (internal tool — all users see all) |
| `POST /api/sites` | Create site (generate tracking_id, created_by = current user) |
| `GET /api/sites/:id` | Site detail + domains |
| `PATCH /api/sites/:id` | Update name/timezone/auto_accept_domains |
| `DELETE /api/sites/:id` | Delete site + all data — SQLite cascade (domains, goals, prefs) + ClickHouse `ALTER TABLE events DELETE WHERE site_id = ?` |
| `POST /api/sites/:id/domains` | Add domain |
| `DELETE /api/sites/:id/domains/:domainId` | Remove domain (clear primary_domain if it was primary) |
| `PATCH /api/sites/:id/primary-domain` | Set primary domain (must exist in site_domains) |
| `GET /api/sites/:id/goals` | List conversion goals |
| `POST /api/sites/:id/goals` | Create conversion goal |
| `DELETE /api/sites/:id/goals/:goalId` | Delete conversion goal |
| `GET /api/keys` | List current user's API keys |
| `POST /api/keys` | Create API key (returns plaintext once) |
| `DELETE /api/keys/:id` | Revoke API key |

**API key auth flow — deferred (setelah produk jadi):**
- Key format: `ga_<base64hash>` (prefix untuk identify)
- Auth: `Authorization: Bearer ga_xxx` header
- Scope: analytics read endpoints only (`/api/analytics/*`)
- Key hash disimpan (SHA-256), plaintext hanya ditampilkan sekali saat create
- Dibangun setelah dashboard + ingestion berjalan, bukan blocker

### 4d. Admin user management API (SQLite)

```
src/server/routes/admin.routes.ts
```

| Endpoint | Action |
|---|---|
| `GET /admin/users` | List all users (admin only) |
| `POST /admin/users` | Create user — name, email, password, role (admin only) |
| `DELETE /admin/users/:id` | Delete user (admin only, cannot delete self) |
| `PATCH /admin/users/:id` | Update role (admin only) |

All endpoints require `requireRole("admin")`.

### 4e. Inertia pages for admin + API keys

| Route | Page | Notes |
|---|---|---|
| `/admin/users` | admin/Users.svelte | Admin-only: create/list/delete users |
| `/settings/keys` | ApiKeys.svelte | Manage API keys (create/revoke) |
| `/settings/profile` | Profile.svelte | Reuse Dulak Profile — name/email/password/avatar |

### 4c. Inertia pages for site management
| Route | Page | Notes |
|---|---|---|
| `/sites` | Sites.svelte | List + create |
| `/sites/:id` | SiteSettings.svelte | Edit, manage domains, show tracking code |
| `/sites/:id/analytics` | Analytics.svelte | Dashboard for this site (Overview) |
| `/sites/:id/analytics/realtime` | analytics/Realtime.svelte | Live visitor count |
| `/sites/:id/analytics/pages` | analytics/Pages.svelte | Top pages |
| `/sites/:id/analytics/sources` | analytics/Sources.svelte | Traffic sources |
| `/sites/:id/analytics/devices` | analytics/Devices.svelte | Device/browser breakdown |
| `/sites/:id/analytics/geography` | analytics/Geography.svelte | World map + countries |
| `/sites/:id/analytics/conversions` | analytics/Conversions.svelte | Conversion goals + inline explanation |

## Phase 5: Tracking Script + Multi-Domain

### 5a. tracking_id resolution

- `tracking_id` is public (safe to expose in HTML)
- CF Function resolves `tracking_id → site_id` via:
  - D1/KV cache (fast, edge-local)
  - Or API call to Bun server `/api/resolve?tracking_id=abc123` (fallback)
- Domain validation: check if incoming domain exists in `site_domains` for that site
  - If domain not registered → reject (prevents abuse)
  - OR: allow auto-register if site setting `auto_accept_domains = true`

### 5b. Multi-domain behavior

```
Site: "My Company" (site_id=1, tracking_id=abc123)
  Domains: mycompany.com, mycompany.co.id, mycompany.io

Visitor on mycompany.co.id/about
  → event: { site_id: 1, domain: "mycompany.co.id", path: "/about", ... }

Dashboard for site_id=1:
  → all events from all 3 domains aggregated
  → "by domain" breakdown shows split: .com 60%, .co.id 30%, .io 10%
```

### 5c. Domain management UX

Admin (site owner) must manually add domains before tracking works.
No auto-accept by default — prevents abuse (someone copies tracking_id,
injects fake events from their own domain).

**Create site flow (inline domain input):**

```
┌─ Create New Site ──────────────────────────┐
│                                            │
│  Site Name: [My Company Website      ]     │
│                                            │
│  Domains:                                  │
│  [mycompany.com              ] [Add]       │
│  [mycompany.co.id            ] [Add]       │
│  [mycompany.io               ] [Add]       │
│                                            │
│              [Cancel]  [Create Site]       │
└────────────────────────────────────────────┘
```

**After create — show tracking code:**

```
┌─ Tracking Code ────────────────────────────┐
│                                            │
│  Paste this on all your domains:           │
│                                            │
│  <script async defer                       │
│    src="https://dulak.pages.dev/tracker.js"│
│    data-tracking-id="abc123">              │
│  </script>                                 │
│                                            │
│  [Copy]  [Done]                            │
└────────────────────────────────────────────┘
```

**Site Settings — manage domains anytime:**

```
┌─ Site Settings: My Company ────────────────┐
│                                            │
│  Name: [My Company Website          ]      │
│  Timezone: [Asia/Jakarta          ▾]       │
│                                            │
│  Domains:                                  │
│  ✓ mycompany.com         [Remove]          │
│  ✓ mycompany.co.id       [Remove]          │
│  ✓ mycompany.io          [Remove]          │
│  [Add domain...            ] [Add]         │
│                                            │
│  Tracking Code:                            │
│  <script async defer src="...tracker.js"   │
│    data-tracking-id="abc123"></script>     │
│  [Copy]                                    │
│                                            │
│  [Save Changes]  [Delete Site]             │
└────────────────────────────────────────────┘
```

**Domain validation rules:**
- Normalize: lowercase, strip `https://`, strip `www.`, strip trailing `/`
- Reject if: not valid hostname format, already exists for this site
- Domain can belong to multiple sites (different users tracking same domain — rare but valid)
- Removing a domain stops new events from that domain; historical data stays in ClickHouse

**Ingestion domain check (CF edge):**

```
Event arrives: { tracking_id: "abc123", domain: "mycompany.co.id", ... }
  1. Resolve tracking_id → site_id (D1/KV cache or API fallback)
  2. Check: domain "mycompany.co.id" in site_domains for site_id?
     → YES: accept event, insert to ClickHouse
     → NO: reject (204 but don't store) — log for debugging
```

**Optional: auto_accept_domains setting (opt-in, off by default):**

Already in schema: `sites.auto_accept_domains INTEGER NOT NULL DEFAULT 0`.

If `auto_accept_domains = 1`: first event from any domain with valid tracking_id
auto-registers that domain in site_domains. Convenience for users who don't
want to pre-register, but security tradeoff: tracking_id leak = anyone can
inject data. Default off. Show warning in UI when enabling.

## Phase 6: Polish + Deploy

### 6a. Tracking script optimization
- Minify to <2KB
- Cache on CF edge (immutable, 1 year TTL)
- `defer` + `sendBeacon` — zero impact on page load

### 6b. ClickHouse on VPS
- Install ClickHouse alongside Bun server
- Config: `CLICKHOUSE_URL=http://localhost:8123`
- TTL: auto-drop raw events older than 2 years (MVs keep forever)
- Backup: daily `clickhouse-backup` to R2

### 6c. CF Pages deployment
- `functions/api/event.ts` — edge ingestion
- `public/tracker.js` — tracking script
- `public/tracker.js.map` — source map (dev only)
- Bun server on VPS — dashboard + site management

### 6d. Tests
- Event ingestion: validate payload, tracking_id resolution, domain check
- Analytics queries: verify MV aggregation correctness
- Site CRUD: create, add domains, delete cascade
- Admin users: create, delete (cannot delete self), role update
- API keys: create, revoke, auth with key
- Conversion goals: create, match events, delete
- Multi-domain: events from different domains aggregate under 1 site

## Implementation Order

1. **Phase 1a** — SQLite migration: sites + domains + api_keys + goals + prefs (done)
2. **Phase 1b** — ClickHouse schema: events + MVs (done)
3. **Phase 1c** — ClickHouse client module (done)
4. **Phase 1d** — SQLite queries for sites/domains/goals/keys/prefs (done)
5. **Phase 4b** — Site management API + routes (1 hr)
6. **Phase 4d** — Admin user management API (30 min)
7. **Phase 3a** — Install shadcn-svelte (15 min)
8. **Phase 3b+3c** — Dashboard pages + components (3-4 hr)
9. **Phase 4a** — Analytics API endpoints (2 hr)
10. **Phase 2b** — Tracker script (1 hr)
11. **Phase 2a** — CF Pages Function ingestion (1 hr)
12. **Phase 2c** — Bun ingestion fallback (30 min)
13. **Phase 5** — Multi-domain resolution (30 min)
14. **Phase 6** — Polish + deploy (2 hr)

Total estimate: ~12-14 hours

## Key Decisions

- **Internal tool** — no public registration, admin creates accounts
- **All users access all sites** — sites.created_by = audit only, not ownership
- **site_id, not domain** — multi-domain sites aggregate under 1 entity
- **visitor_id = hash(IP + UA + site_id)** — prevents cross-site visitor correlation
- **session_id = hash(visitor_id + floor(ts/1800))** — 30min window, stateless, no server tracking
- **Admin user management** — no public registration, admin creates accounts via /admin/users
- **ClickHouse MVs** — pre-aggregate on insert, dashboard queries hit MVs (<1ms)
- **crypto.randomUUID()** — native Bun 1.4 BoringSSL, zero-dependency tracking_id generation
- **Custom UA parser** — 10-line regex, zero dependency; analytics cuma butuh device + browser
- **Referrer parsing** — search→organic, social→social, internal/external→referral, none→direct
- **CORS wildcard** — tracker.js dari domain manapun, no credentials needed
- **ClickHouse cleanup on delete** — `ALTER TABLE events DELETE WHERE site_id = ?` (no FK in CH)
- **Sidebar nav** — replaces Dulak /dashboard + /admin, site switcher persistent
- **CF edge ingestion** — visitor latency <5ms, batch to ClickHouse
- **shadcn-svelte** — design system, copy-paste, Tailwind v4
- **svg-world-maps** — 15KB choropleth, no tile server
- **Privacy-first** — no cookies, anonymous visitor_id, no PII stored
- **SQLite for OLTP** — users, sessions, sites, site_domains, api_keys, conversion_goals, dashboard_prefs
- **ClickHouse for OLAP** — events, daily_stats MV, page_stats MV
