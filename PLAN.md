# Selasar — Implementation Plan

> The corridor between data and insight.

Self-hosted, open-source web analytics. Built on Dulak boilerplate (Svelte 5 + Hono + Inertia v3 + bun:sqlite) with ClickHouse analytics engine, multi-domain support per site, and a professional dashboard UI.

## Architecture

```
Client websites (any domain)
  ↓ tracker.js (async, sendBeacon)
  ↓ POST /api/event
  ↓
  ClickHouse (events table + materialized views)
  ↑ dashboard queries (HTTP, localhost:8123)
  ↑
Bun server (Hono)
  ├── /sites/:id/analytics/*  → ClickHouse queries → Inertia Svelte pages
  ├── /api/analytics/*        → ClickHouse JSON endpoints (SPA refetch)
  ├── /api/sites/*            → SQLite CRUD (sites, site_domains)
  ├── /api/event              → Event ingestion (tracker.js target)
  └── /auth/*                 → SQLite (users, sessions) — from Dulak
```

## Status: All Phases Complete

| Phase | Status | Description |
|-------|--------|-------------|
| 1. Database Schema | ✅ Done | SQLite (sites, domains, API keys) + ClickHouse (events + MVs) |
| 2. Event Ingestion | ✅ Done | tracker.js + Bun ingestion endpoint + visitor/session hashing |
| 3. Dashboard UI | ✅ Done | 9 analytics pages + site management + admin + API keys |
| 4. API Endpoints | ✅ Done | Analytics JSON API + site CRUD + admin + API keys |
| 5. Multi-Domain | ✅ Done | Domain resolution, multi-domain aggregation, domain management UX |
| 6. Polish | ✅ Done | Empty states, tracking guide page, rebranding, README |

---

## Phase 1: Database Schema ✅

### SQLite (OLTP — sites, domains, API keys)

`migrations/0006_sites.sql` — sites, site_domains, api_keys tables.

### ClickHouse (analytics — events + materialized views)

`scripts/init-clickhouse.ts` — creates `analytics.events` table with columns:
site_id, domain, event_time, event_date, event_name, visitor_id, session_id, page_path, page_title, source, medium, device, browser, country, city, duration_ms, is_new_visitor, is_bounce, os, utm_campaign, utm_content, utm_term.

Materialized views: `daily_stats` (SummingMergeTree), `page_stats` (SummingMergeTree).

### ClickHouse client

`src/server/clickhouse.ts` — HTTP client (localhost:8123), `chQuery(sql)`, `chInsert(table, rows)`, `chPing()`.

### Seed data

`scripts/seed-clickhouse.ts` — generates 250k+ events across 90 days, 80k+ unique visitors, 46 cities across 12 countries, 5 custom event types, ~20% campaign traffic with UTM params, OS detection (Windows/macOS/Linux/Android/iOS).

---

## Phase 2: Event Ingestion ✅

### Tracker script

`public/tracker.js` — vanilla JS, no dependencies.

**Installation:**
```html
<script async defer src="https://your-selasar.com/tracker.js" data-tracking-id="uuid"></script>
```

**Auto-tracked events:**
| Event | Trigger |
|-------|---------|
| `pageview` | Page load |
| `heartbeat` | Every 10s while tab visible |
| `exit` | `pagehide` / `beforeunload` |
| SPA route change | `pushState` / `replaceState` / `popstate` |

**Custom events:**
```js
analytics.track('signup_click', { plan: 'pro' });
```

**Data collected:** page path, page title, referrer (→ source/medium), UTM params, user agent (→ device/browser/OS), screen size, language.

### Ingestion endpoint

`src/server/routes/event.routes.ts` — Bun server fallback, resolves tracking_id → site_id, hashes visitor_id (IP + UA + site_id), generates session_id (30min window), inserts to ClickHouse.

### Visitor/session identification

- `visitor_id = hash(IP + UA + site_id)` — prevents cross-site correlation
- `session_id = hash(visitor_id + floor(ts/1800))` — 30min window, stateless
- `is_new_visitor` — checked against ClickHouse history

### Referrer → source/medium parsing

- Search engines (google, bing, duckduckgo, yandex, baidu) → organic
- Social (twitter/x, facebook, linkedin, instagram, reddit, youtube) → social
- Same domain → referral (internal)
- Other external → referral
- Empty → (direct) / (none)

### OS detection

Custom regex parser: Windows, macOS, Linux, Android, iOS, other.

---

## Phase 3: Dashboard UI ✅

### Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home.svelte | Landing page (public, CDN-cached) |
| `/login` | Login.svelte | Login form |
| `/sites` | Sites.svelte | Site list grid with cards |
| `/sites/new` | SiteNew.svelte | Dedicated create-site form |
| `/sites/:id` | SiteSettings.svelte | Settings: name, timezone, domains, tracking guide link, danger zone |
| `/sites/:id/analytics` | Analytics.svelte | Overview — 11 scrollable sections |
| `/sites/:id/analytics/realtime` | Realtime.svelte | Live visitors with 4 sections (pages, sources, countries, devices) |
| `/sites/:id/analytics/pages` | Pages.svelte | Sortable table with search, entry/exit pages |
| `/sites/:id/analytics/sources` | Sources.svelte | Donut chart for channels + full source list with favicons |
| `/sites/:id/analytics/devices` | Devices.svelte | Device type cards + browser bars + OS bars |
| `/sites/:id/analytics/geography` | Geography.svelte | Country flag grid + full list + top cities |
| `/sites/:id/analytics/campaigns` | Campaigns.svelte | Gradient hero + campaign cards + UTM breakdown |
| `/sites/:id/analytics/conversions` | Conversions.svelte | Conversion funnel + event detail cards |
| `/sites/:id/analytics/tracking` | Tracking.svelte | Installation guide + event tracking + UTM docs |
| `/settings/keys` | ApiKeys.svelte | API key management |
| `/settings/profile` | Profile.svelte | User profile (name, email, password, avatar) |
| `/admin/users` | admin/Users.svelte | Admin-only user management |

### Components

| Component | Purpose |
|-----------|---------|
| Layout.svelte | Sidebar nav + site switcher + profile dropdown |
| Brand.svelte | Selasar logo (5-bar arch, cyan on dark) |
| SiteSwitcher.svelte | Dropdown to switch between sites + create new |
| MetricCard.svelte | Number + delta badge, clickable to switch chart metric |
| TrafficChart.svelte | Line chart (visitors/pageviews over time) |
| BreakdownTable.svelte | Sortable table with percentage bars |
| DateRangePicker.svelte | 12 Plausible-matching date ranges |
| LiveBadge.svelte | Realtime visitor count (polling) |
| DeltaBadge.svelte | +12.5% ↑ green / -3% ↓ red |
| Sparkline.svelte | Mini chart for metric cards |
| EmptyState.svelte | Reusable empty state: icon + title + message + hint + action link |

### Empty states

Every analytics page has a polished empty state when no data:
- Overview: icon + "No data yet" + tracker snippet with copy button + tracking guide link
- Sources/Geography/Devices/Campaigns: EmptyState component with relevant icon + message + tracking guide link
- Campaigns: includes UTM example hint
- Realtime: 4 compact inline empty states with lightning icon
- Pages: icon + "No pages found" in table
- Conversions: icon + "No custom events tracked yet" + code hint

### Sidebar navigation

```
┌──────────────────────────────────────┐
│  [Selasar logo]                      │
│                                      │
│  [Site: My Company ▾]               │
│                                      │
│  📊 Overview                         │
│  ⚡ Realtime                         │
│  📄 Pages                            │
│  🔗 Sources                          │
│  📱 Devices                          │
│  🌍 Geography                        │
│  🎯 Conversions                      │
│  💻 Tracking                         │
│  ⚙️ Settings                         │
│  ─────────                           │
│  🌐 Sites                            │
│  🔑 API Keys                         │
│  👤 Profile                          │
│  ─────────                           │
│  👥 Users (admin)                    │
│                                      │
│  [user@email.com ▾]                  │
└──────────────────────────────────────┘
```

### Design decisions

- **No shadcn-svelte CLI** — project uses Bun.build (not Vite/SvelteKit), components hand-made
- **Unique UI per page** — each page has distinct visual identity (donut, gradient hero, flag grid, cards, funnel)
- **Scroll over tabs** — all data visible by scrolling, not hidden behind tabs
- **Silent fetching** — tab/metric/range changes use `silent=true` to prevent flicker
- **All metric cards clickable** — each switches the chart metric
- **Show ALL data** — not just top N, scroll-based overview

---

## Phase 4: API Endpoints ✅

### Analytics API (ClickHouse queries)

`src/server/routes/analytics.routes.ts`

| Endpoint | Description |
|----------|-------------|
| `GET /api/analytics/overview` | Metric cards + previous period comparison |
| `GET /api/analytics/traffic` | Line chart data (visitors/pageviews per day) |
| `GET /api/analytics/pages` | Top pages + entry/exit pages |
| `GET /api/analytics/sources` | Source/medium breakdown |
| `GET /api/analytics/devices` | Device + browser + OS breakdown |
| `GET /api/analytics/geography` | Country + city breakdown |
| `GET /api/analytics/campaigns` | UTM campaign breakdown |
| `GET /api/analytics/campaigns/detail` | UTM content/term/source/medium detail |
| `GET /api/analytics/conversions` | Custom event conversion rates |
| `GET /api/analytics/visitor-types` | New vs returning visitors |
| `GET /api/analytics/realtime` | Live visitor count (last 5 min) |

All endpoints: auth required, return JSON, support `range` param (12 options).

### Site management API

| Endpoint | Action |
|----------|--------|
| `GET /api/sites` | List all sites |
| `POST /api/sites` | Create site (auto-generate tracking_id) |
| `GET /api/sites/:id` | Site detail + domains |
| `PATCH /api/sites/:id` | Update name/timezone |
| `DELETE /api/sites/:id` | Delete site + ClickHouse cleanup |
| `POST /api/sites/:id/domains` | Add domain |
| `DELETE /api/sites/:id/domains/:domainId` | Remove domain |
| `PATCH /api/sites/:id/primary-domain` | Set primary domain |

### API keys

| Endpoint | Action |
|----------|--------|
| `GET /api/keys` | List current user's keys |
| `POST /api/keys` | Create key (plaintext shown once) |
| `DELETE /api/keys/:id` | Revoke key |

### Admin

| Endpoint | Action |
|----------|--------|
| `GET /admin/users` | List users (admin only) |
| `POST /admin/users` | Create user (admin only) |
| `DELETE /admin/users/:id` | Delete user (admin only) |
| `PATCH /admin/users/:id` | Update role (admin only) |

---

## Phase 5: Multi-Domain ✅

- 1 site_id = many domains, traffic aggregated
- Domain validation: normalize (lowercase, strip https://, www., trailing /)
- Domain must be registered before tracking works
- Removing domain stops new events; historical data stays
- SiteSwitcher dropdown for switching between sites

---

## Phase 6: Polish ✅

- **Rebranded as Selasar** — Indonesian for "corridor", bridge between data and insight
- **Logo** — 5 bar chart bars forming arch shape (analytics + corridor), cyan (#06B6D4) on dark
- **Empty states** — polished empty states on all pages with icons, messages, and action links
- **Tracking guide page** — dedicated `/sites/:id/analytics/tracking` with installation, auto-tracking, custom events, UTM docs
- **Dedicated create-site page** — `/sites/new` separate from Sites list
- **README** — full project documentation
- **GitHub repo** — https://github.com/maulanashalihin/selasar

---

## Tests ✅

78 tests across 6 test files:
- `app.test.ts` — server setup, middleware, routing
- `sites.test.ts` — site CRUD, domain management
- `ingestion.test.ts` — event ingestion, tracking_id resolution
- `analytics.test.ts` — ClickHouse query endpoints
- `admin.test.ts` — admin user management
- `multi-domain.test.ts` — multi-domain aggregation

---

## Key Decisions

- **Internal tool** — no public registration, admin creates accounts
- **All users access all sites** — sites.created_by = audit only
- **site_id, not domain** — multi-domain sites aggregate under 1 entity
- **visitor_id = hash(IP + UA + site_id)** — prevents cross-site correlation
- **session_id = hash(visitor_id + floor(ts/1800))** — 30min window, stateless
- **ClickHouse MVs** — pre-aggregate on insert, dashboard queries <1ms
- **crypto.randomUUID()** — native Bun, zero-dependency tracking_id
- **Custom UA parser** — 10-line regex, zero dependency
- **No shadcn-svelte** — Bun.build incompatible, components hand-made
- **Unique UI per page** — distinct visual identity, not generic tables
- **Scroll over tabs** — all data visible by scrolling
- **Privacy-first** — no cookies, anonymous visitor_id, no PII
- **Project name "Selasar"** — Indonesian for "corridor"
- **Logo** — 5 bars forming arch (analytics + corridor concept)
- **Tracker format** — `data-tracking-id` (not `data-site-id`), `async defer`
