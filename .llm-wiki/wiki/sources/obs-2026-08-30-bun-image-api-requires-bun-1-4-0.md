---
type: source
title: "Observation: Bun.image API requires Bun >=1.4.0"
slug: obs-2026-08-30-bun-image-api-requires-bun-1-4-0
status: observation
created: 2026-08-30
updated: 2026-08-30
relevance: high
observed_at: 2026-08-30T03:50:45.147Z
tags: ["bun", "version", "dependency", "clickhouse", "auth"]
source_context: "Production deploy revealed missing is_bounce column and ClickHouse auth requirement"
---
# ⭐ Observation: Bun.image API requires Bun >=1.4.0
Bun.image (import { Image } from 'bun') used in src/server/routes/profile.routes.ts for avatar decode/resize/WebP encode was introduced in Bun 1.4. Package.json engines field was incorrectly set to >=1.3.0. Fixed to >=1.4.0. Dockerfile also updated from oven/bun:1.3-alpine to 1.4-alpine. ClickHouse HTTP client also needed auth support (CLICKHOUSE_USER/PASSWORD env vars) for production instances that require Basic auth.
*Relevance: high*

*Context: Production deploy revealed missing is_bounce column and ClickHouse auth requirement*

*Tags: bun version dependency clickhouse auth*
---
*Observed: 2026-08-30T03:50:45.147Z*