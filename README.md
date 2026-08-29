# Selasar

> The corridor between data and insight.

Self-hosted web analytics with ClickHouse, multi-domain support, and a beautiful dashboard. Built with Hono + Bun + Svelte 5 + Inertia v3.

![License](https://img.shields.io/badge/license-MIT-blue)
![Bun](https://img.shields.io/badge/Bun-%3E%3D1.3-f9f1e1)
![ClickHouse](https://img.shields.io/badge/ClickHouse-engine-yellow)

## Features

- **Multi-domain support** — Track unlimited sites, each with multiple domains
- **ClickHouse engine** — Blazing fast analytics queries on millions of events
- **Lightweight tracker** — Single `<script>` tag, no cookies, privacy-friendly
- **Real-time visitors** — See who's on your site right now
- **Full breakdown** — Sources, pages (top/entry/exit), devices, browsers, OS, geography (countries + cities), campaigns (UTM), conversions, new vs returning visitors
- **Beautiful dashboard** — Unique UI per page, not generic tables everywhere
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
| Testing | Bun test |

## Quick Start

```bash
# Clone
git clone https://github.com/maulanashalihin/selasar.git
cd selasar

# Install
bun install

# Start ClickHouse (Docker)
docker run -d --name clickhouse -p 8123:8123 -p 9000:9000 clickhouse/clickhouse-server

# Configure
cp .env.example .env

# Migrate + seed
bun run migrate
bun run scripts/seed-clickhouse.ts

# Run
bun run dev
```

Open `http://localhost:4000` and login with `demo@example.com` / `password123`.

## Tracker Installation

Add this to any page you want to track:

```html
<script defer src="https://your-selasar-instance.com/tracker.js" data-site-id="1"></script>
```

That's it. No cookies, no consent banner needed.

## Dashboard Pages

| Page | What you see |
|------|-------------|
| **Overview** | All data at a glance — scrollable sections for sources, pages, devices, OS, geography, visitor types, campaigns, conversions |
| **Sources** | Donut chart for channels + full source list with favicons |
| **Pages** | Searchable sortable table with page titles, pageviews, visitors, avg duration |
| **Devices** | Device type cards + browser breakdown + OS breakdown |
| **Geography** | Top country cards + full country list + top cities |
| **Campaigns** | Campaign performance cards + UTM breakdown (content, term, source, medium) |
| **Conversions** | Conversion funnel + event detail cards with rates |
| **Realtime** | Live visitor count with auto-refresh |

## Project Structure

```
src/
├── client/          # Svelte 5 components and pages
│   ├── components/  # Reusable UI (charts, cards, tables)
│   ├── pages/       # Analytics, Sites, Login, etc.
│   └── lib/         # Shared utilities
├── server/          # Hono server
│   ├── routes/      # Analytics API, site CRUD, auth, events
│   ├── clickhouse.ts
│   └── auth.ts
├── shared/          # Types shared between client/server
scripts/
├── seed-clickhouse.ts  # Generate 250k+ events for testing
└── build.ts            # Bun.build client assets
public/
└── tracker.js          # Event tracker (deploy on tracked sites)
```

## License

MIT
