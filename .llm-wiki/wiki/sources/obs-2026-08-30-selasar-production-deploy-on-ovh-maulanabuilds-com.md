---
type: source
title: "Observation: Selasar production deploy on ovh.maulanabuilds.com"
slug: obs-2026-08-30-selasar-production-deploy-on-ovh-maulanabuilds-com
status: observation
created: 2026-08-30
updated: 2026-08-30
relevance: critical
observed_at: 2026-08-30T03:50:41.420Z
tags: ["deploy", "production", "selasar", "systemd", "cloudflare"]
source_context: "First production deploy of Selasar analytics platform"
---
# 🔴 Observation: Selasar production deploy on ovh.maulanabuilds.com
Selasar deployed via systemd on ubuntu@ovh.maulanabuilds.com (51.79.159.231). Install path /opt/selasar, port 4000, systemd service 'selasar'. ClickHouse runs in Docker container 'plausible-ps-clickhouse' on port 8124 with credentials default:plausible. Database 'analytics' created for Selasar. Cloudflare: A record selasar.maulanabuilds.com proxied, SSL Flexible, Origin Rule routes to port 4000. UFW restricts port 4000 to 15 Cloudflare IP ranges. Demo user demo@example.com/password123 with Demo Site (test.com, site_id=1, 250k ClickHouse events). deploy.env saved locally. Update procedure: git pull, bun run build, systemctl restart selasar.
*Relevance: critical*

*Context: First production deploy of Selasar analytics platform*

*Tags: deploy production selasar systemd cloudflare*
---
*Observed: 2026-08-30T03:50:41.420Z*