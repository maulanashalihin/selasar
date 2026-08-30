# Selasar

> The corridor between data and insight.

Self-hosted, open-source web analytics with ClickHouse, multi-domain support, and a beautiful dashboard. Built with Hono + Bun + Svelte 5 + Inertia v3.

**Live demo:** [selasar.maulanabuilds.com](https://selasar.maulanabuilds.com) — login with `demo@example.com` / `password123`

[![CI](https://github.com/maulanashalihin/selasar/actions/workflows/ci.yml/badge.svg)](https://github.com/maulanashalihin/selasar/actions/workflows/ci.yml)
![License](https://img.shields.io/badge/license-MIT-blue)
![Bun](https://img.shields.io/badge/Bun-%3E%3D1.4-f9f1e1)
![ClickHouse](https://img.shields.io/badge/ClickHouse-engine-yellow)
![Demo](https://img.shields.io/badge/demo-selasar.maulanabuilds.com-success)

## Features

- **Multi-domain support** — Track unlimited sites, each with multiple domains
- **ClickHouse engine** — Blazing fast analytics queries on millions of events
- **Lightweight tracker** — Single `<script>` tag, no cookies, privacy-friendly
- **Real-time visitors** — See who's on your site right now
- **Full breakdown** — Sources, pages (top/entry/exit), devices, browsers, OS, geography (countries + cities), campaigns (UTM), conversions, new vs returning visitors
- **Beautiful dashboard** — Unique UI per page, not generic tables everywhere
- **Polished empty states** — Every page has a designed empty state with icons and guidance
- **Tracking guide page** — Dedicated installation + event tracking documentation in-dashboard
- **API keys** — Programmatic access for integrations
- **12 date ranges** — Today, yesterday, 24h, 7d, 28d, 91d, 12mo, MTD, last month, YTD, all, realtime

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Server | Hono |
| Database | bun:sqlite (metadata) + ClickHouse (analytics) |
| Frontend | Svelte 5 (runes) |
| Integration | Inertia v3 |
| Styling | Tailwind v4 |
| Testing | Buntest (156 tests) |

## Prerequisites

- **Bun >= 1.4** — install with `curl -fsSL https://bun.sh/install | bash` (Bun 1.4+ required for `Bun.image` API used in avatar processing)
- **ClickHouse** — any recent version (24.x+). Run via Docker or native install

## Quick Start

```bash
# Clone
git clone https://github.com/maulanashalihin/selasar.git
cd selasar

# Install
bun install

# Start ClickHouse (pick one)
clickhouse server --daemon          # native install
# docker compose up clickhouse -d   # OR via Docker

# Configure
cp .env.example .env

# Initialize ClickHouse schema
bun run ch:init

# Seed demo user (SQLite migrations run automatically on server startup)
bun run db:seed

bun run ch:seed

# Run (dev mode with auto-reload)
bun run dev
```

Open `http://localhost:4000` and login with `demo@example.com` / `password123`.

## Tracker Installation

Add this to the `<head>` of every page you want to track:

```html
<script async defer src="https://your-selasar-instance.com/tracker.js" data-tracking-id="your-tracking-id"></script>
```

That's it. No cookies, no consent banner needed. The tracker auto-collects pageviews, engagement duration, referrers, UTM params, device/browser/OS, and geography.

### Custom Events

```js
// Track any custom event
analytics.track('signup_click', { plan: 'pro' });
analytics.track('purchase', { amount: 99, currency: 'USD' });
analytics.track('newsletter_signup', { source: 'footer' });
```

### UTM Campaign Tracking

Add UTM parameters to your marketing URLs:

```
https://yoursite.com/landing?utm_source=google&utm_medium=cpc&utm_campaign=summer_sale&utm_content=banner_a&utm_term=running+shoes
```

The tracker automatically parses these and they appear in the Campaigns dashboard.

See the in-dashboard **Tracking** page (`/sites/:id/analytics/tracking`) for full documentation.

## Dashboard Pages

| Page | What you see |
|------|-------------|
| **Overview** | All data at a glance — 11 scrollable sections with metric cards, traffic chart, sources, pages, devices, OS, geography, visitor types, campaigns, conversions |
| **Sources** | Donut chart for channels + full source list with favicons |
| **Pages** | Searchable sortable table with page titles, pageviews, visitors, avg duration + entry/exit pages |
| **Devices** | Device type cards + browser breakdown bars + OS breakdown bars |
| **Geography** | Country flag grid + full country list + top cities |
| **Campaigns** | Gradient hero card + campaign performance cards + 4-column UTM breakdown (content, term, source, medium) |
| **Conversions** | Conversion funnel + event detail cards with rates |
| **Realtime** | Live visitor count with auto-refresh — 4 sections (pages, sources, countries, devices) |
| **Tracking** | Installation guide, auto-tracked events, custom event examples, UTM reference, data collection details |

## Site Management

| Page | What you see |
|------|-------------|
| **Sites** (`/sites`) | Grid of site cards with name, domain, tracking ID, creation date |
| **New Site** (`/sites/new`) | Dedicated create-site form with name, domain, timezone |
| **Settings** (`/sites/:id`) | Edit name/timezone, manage domains, link to tracking guide, danger zone |

## Project Structure

```
src/
├── client/
│   ├── components/
│   │   ├── Layout.svelte          # Sidebar nav + site switcher
│   │   ├── Brand.svelte           # Selasar logo (5-bar arch)
│   │   ├── SiteSwitcher.svelte    # Dropdown site selector
│   │   └── analytics/
│   │       ├── MetricCard.svelte  # Clickable metric with delta
│   │       ├── TrafficChart.svelte
│   │       ├── BreakdownTable.svelte
│   │       ├── DateRangePicker.svelte
│   │       ├── LiveBadge.svelte
│   │       ├── DeltaBadge.svelte
│   │       ├── Sparkline.svelte
│   │       └── EmptyState.svelte  # Reusable empty state
│   ├── pages/
│   │   ├── Analytics.svelte       # Overview (11 sections)
│   │   ├── Sites.svelte           # Site list
│   │   ├── SiteNew.svelte         # Create site form
│   │   ├── SiteSettings.svelte    # Site settings + domains
│   │   ├── Home.svelte            # Landing page
│   │   ├── analytics/
│   │   │   ├── Realtime.svelte
│   │   │   ├── Pages.svelte
│   │   │   ├── Sources.svelte
│   │   │   ├── Devices.svelte
│   │   │   ├── Geography.svelte
│   │   │   ├── Campaigns.svelte
│   │   │   ├── Conversions.svelte
│   │   │   └── Tracking.svelte    # Tracking guide
│   │   └── admin/
│   │       └── Users.svelte
│   └── lib/
│       ├── date-ranges.ts         # 12 Plausible-matching ranges
│       └── cn.ts
├── server/
│   ├── routes/
│   │   ├── analytics.routes.ts    # ClickHouse query endpoints
│   │   ├── sites.routes.ts        # Site CRUD + pages
│   │   ├── event.routes.ts        # Event ingestion
│   │   ├── api-keys.routes.ts
│   │   └── admin.routes.ts
│   ├── clickhouse.ts              # ClickHouse HTTP client
│   ├── db.ts                      # SQLite queries
│   └── auth.ts
└── shared/
    └── types.ts

scripts/
├── init-clickhouse.ts             # Schema initialization
├── seed-clickhouse.ts             # Generate 250k+ demo events
└── build.ts                       # Bun.build client assets

public/
└── tracker.js                     # Event tracker

tests/                              # 156 tests
├── app.test.ts                # server setup, middleware, routing, auth
├── sites.test.ts              # site CRUD, domain management, ClickHouse cleanup
├── ingestion.test.ts          # event ingestion, visitor/bounce detection, UTM
├── analytics.test.ts          # ClickHouse query endpoints (all 11)
├── admin.test.ts              # admin user management
├── multi-domain.test.ts       # multi-domain aggregation
├── api-keys.test.ts           # API key CRUD
├── profile.test.ts            # profile info, password, avatar upload
├── uploads.test.ts            # tus protocol (create/patch/head/delete/get)
└── pages.test.ts              # page renders, verify-email, tracker.js, OAuth
```

## ClickHouse Schema

```sql
CREATE TABLE analytics.events (
  site_id        UInt32,
  domain         LowCardinality(String),
  event_time     DateTime,
  event_date     Date,
  event_name     LowCardinality(String),
  visitor_id     String,
  session_id     String,
  page_path      String,
  page_title     String,
  source         LowCardinality(String),
  medium         LowCardinality(String),
  device         LowCardinality(String),
  browser        LowCardinality(String),
  country        LowCardinality(String),
  city           LowCardinality(String),
  duration_ms    UInt32,
  is_new_visitor UInt8,
  is_bounce      UInt8,
  os             LowCardinality(String),
  utm_campaign   LowCardinality(String),
  utm_content    LowCardinality(String),
  utm_term       LowCardinality(String)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (site_id, event_date, event_name);
```

Materialized views: `daily_stats` (SummingMergeTree), `page_stats` (SummingMergeTree).

## Development

```bash
# Dev server with auto-reload
bun run dev

# Build client assets
bun run build

# Run tests (must use --isolate for process isolation)
bun run test

# Lint
bun run lint
```

## License

MIT
