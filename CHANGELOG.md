# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-08-30

### Added

- `is_new_visitor` detection — queries ClickHouse history before insert (was hardcoded 0)
- `is_bounce` computation — 1 for first pageview in session, 0 otherwise (was not set)
- `auto_accept_domains` — auto-registers unknown domains via `addDomain.run()` (was no-op stub)
- `city` from `cf-ipcity` Cloudflare header (was hardcoded empty string)
- ClickHouse cleanup on site delete — `ALTER TABLE events DELETE WHERE site_id = ?`
- Session-based bounce rate subquery in overview (replaces unreliable `is_bounce` column sum)
- Profile avatar upload migrated from tus protocol to simple multipart/form-data
- `Bun.image` decode → resize 256×256 → WebP re-encode for avatar storage
- CSP nonce tightening — `style-src` from `'unsafe-inline'` to `'nonce-${nonce}'`
- Client-side CSP nonce reading from `<meta name="csp-nonce">` for Inertia inline styles
- 78 new tests (78 → 156 total across 10 files):
  - `tests/api-keys.test.ts` — API key CRUD + validation (9 tests)
  - `tests/profile.test.ts` — profile info, password change, avatar upload (13 tests)
  - `tests/uploads.test.ts` — tus protocol end-to-end (15 tests)
  - `tests/pages.test.ts` — page renders, verify-email, tracker.js, OAuth (15 tests)
  - `tests/analytics.test.ts` — conversions, campaigns, visitor-types, campaigns/detail (11 tests)
  - `tests/ingestion.test.ts` — is_new_visitor, is_bounce, auto_accept, UTM, city (11 tests)
  - `tests/sites.test.ts` — ClickHouse cleanup verification, auto_accept toggle (4 tests)
- CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, CHANGELOG.md
- GitHub issue templates (bug report, feature request)
- GitHub pull request template
- `.editorconfig` for cross-editor consistency
- ClickHouse service in docker-compose.yml
- ClickHouse service container in CI workflow
- CI status badge in README

### Fixed

- `rangeFilter` missing default return — caused typecheck error
- 16 typecheck errors across 9 Svelte components (NavItem union, BreakdownTable props, TrafficChart undefined, Analytics.svelte missing import, Sources/Campaigns .style casts)
- `profileRoutes` imported but never mounted in `app.ts` — all `/profile` routes returned 404
- README Quick Start referenced non-existent `bun run migrate` script
- README Development section used bare `bun test` instead of `bun run test` (requires `--isolate`)

### Changed

- README test count updated: 78 → 156
- Dockerfile entrypoint renamed: `dulak-entrypoint.sh` → `selasar-entrypoint.sh`
- Dependabot: removed stale React dependency group (project uses Svelte, not React)
- Prompts: replaced all "Dulak" references with "Selasar"

## [0.1.0] - 2026-08-29

### Added

- Multi-domain support — track unlimited sites, each with multiple domains
- ClickHouse analytics engine — events table + materialized views
- Lightweight tracker (`tracker.js`) — single `<script>` tag, no cookies, privacy-friendly
- Real-time visitors dashboard
- Full breakdown: sources, pages (top/entry/exit), devices, browsers, OS, geography, campaigns (UTM), conversions, new vs returning
- 9 analytics pages with unique UI per page
- Polished empty states on all pages
- Tracking guide page with installation + event tracking documentation
- API keys for programmatic access
- 12 date ranges (Today, yesterday, 24h, 7d, 28d, 91d, 12mo, MTD, last month, YTD, all, realtime)
- Admin user management
- Google OAuth login
- Password reset flow with email
- Profile management with avatar upload
- tus protocol for resumable uploads
- Docker + docker-compose deployment
- systemd deployment scripts
- Caddy + Cloudflare reverse proxy setup guides
- GitHub Actions CI (typecheck, lint, test, build)
- Dependabot for npm + GitHub Actions
- 78 tests across 6 test files

[Unreleased]: https://github.com/maulanashalihin/selasar/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/maulanashalihin/selasar/releases/tag/v0.2.0
[0.1.0]: https://github.com/maulanashalihin/selasar/releases/tag/v0.1.0
