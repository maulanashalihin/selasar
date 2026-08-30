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

## Deployment

Selasar runs on any Linux VPS with ≥1GB RAM. Two deployment methods:

### Option A: Docker (recommended)

Best for most users — ClickHouse, app, and healthchecks in one stack.

```bash
# 1. Clone
git clone https://github.com/maulanashalihin/selasar.git
cd selasar

# 2. Configure
cp .env.example .env
# Edit .env:
#   PORT=4000
#   NODE_ENV=production
#   APP_URL=https://your-domain.com

# 3. Build and start (app + ClickHouse)
docker compose up -d --build

# 4. Initialize ClickHouse schema + seed demo data
docker compose exec app bun run ch:init
docker compose exec app bun run db:seed
docker compose exec app bun run ch:seed

# 5. Verify
curl http://localhost:4000/health
docker compose ps   # both services should be "healthy"
```

The `docker-compose.yml` includes:
- **app** — Selasar built with Bun, runs as non-root user (UID 1000), healthcheck on `/health`
- **clickhouse** — ClickHouse 24.8 Alpine, persistent volume, healthcheck on `/ping`

Data persists in `./data/` (SQLite + uploads) and `./clickhouse-data/` (analytics).

### Option B: systemd (bare VPS)

For users who prefer native processes without Docker. You need ClickHouse running separately (native install or Docker).

```bash
# 1. Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# 2. Install ClickHouse (if not already running)
# Option 1: Docker
docker run -d --name clickhouse -p 8123:8123 \
  clickhouse/clickhouse-server:24.8-alpine
# Option 2: Native
# Follow https://clickhouse.com/docs/install

# 3. Clone and build
git clone https://github.com/maulanashalihin/selasar.git /opt/selasar
cd /opt/selasar
bun install
bun run build

# 4. Configure
cp .env.example .env
# Edit .env:
#   PORT=4000
#   NODE_ENV=production
#   APP_URL=https://your-domain.com
#   CLICKHOUSE_URL=http://localhost:8123
#   CLICKHOUSE_USER=     # set if your ClickHouse requires auth
#   CLICKHOUSE_PASSWORD= # set if your ClickHouse requires auth

# 5. Initialize ClickHouse schema + seed demo data
bun run ch:init
bun run db:seed
bun run ch:seed

# 6. Create systemd service
sudo tee /etc/systemd/system/selasar.service > /dev/null << 'EOF'
[Unit]
Description=Selasar — Self-hosted web analytics
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/selasar
Environment=NODE_ENV=production
ExecStart=/home/ubuntu/.bun/bin/bun run src/index.ts
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable selasar
sudo systemctl start selasar

# 7. Verify
curl http://localhost:4000/health
sudo systemctl status selasar
```

### HTTPS with Cloudflare

For production, put Cloudflare in front as reverse proxy:

1. **DNS**: Create an A record pointing your domain to the server IP (proxied/orange cloud)
2. **SSL/TLS**: Set mode to Flexible (Cloudflare terminates TLS, talks HTTP to origin)
3. **Origin Rule**: Route traffic to your app port — `(http.host eq "your-domain.com")` → port 4000
4. **Firewall**: Restrict the app port to Cloudflare IP ranges only

```bash
# Restrict UFW to Cloudflare IPs
sudo ufw allow OpenSSH
sudo ufw delete allow 4000/tcp  # remove open-to-all rule if exists
for ip in $(curl -s https://api.cloudflare.com/client/v4/ips | jq -r '.result.ipv4_cidrs[]'); do
  sudo ufw allow from $ip to any port 4000 proto tcp
done
echo "y" | sudo ufw enable
```

### HTTPS with Caddy (alternative)

If you prefer a self-hosted reverse proxy with automatic TLS:

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy

# Caddyfile (/etc/caddy/Caddyfile)
your-domain.com {
    reverse_proxy localhost:4000
}

sudo systemctl restart caddy
```

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
