/**
 * Initialize ClickHouse schema: database, events table, materialized views.
 * Run once on first setup: `bun run scripts/init-clickhouse.ts`
 */

import { chPing } from "../src/server/clickhouse";

const CH_URL = process.env.CLICKHOUSE_URL ?? "http://localhost:8123";
const CH_DB = process.env.CLICKHOUSE_DB ?? "analytics";
const CH_USER = process.env.CLICKHOUSE_USER ?? "";
const CH_PASSWORD = process.env.CLICKHOUSE_PASSWORD ?? "";
const CH_HEADERS: Record<string, string> = CH_USER
	? { Authorization: `Basic ${btoa(`${CH_USER}:${CH_PASSWORD}`)}` }
	: {};

async function chExec(sql: string): Promise<void> {
	const url = `${CH_URL}/?query=${encodeURIComponent(sql)}`;
	const resp = await fetch(url, { method: "POST", headers: CH_HEADERS });
	if (!resp.ok) {
		const body = await resp.text();
		throw new Error(`ClickHouse error: ${body}`);
	}
}

const SCHEMA = [
	`CREATE DATABASE IF NOT EXISTS ${CH_DB}`,

	`CREATE TABLE IF NOT EXISTS ${CH_DB}.events (
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
    is_bounce     UInt8,
    os            LowCardinality(String),
    utm_campaign  LowCardinality(String),
    utm_content   LowCardinality(String),
    utm_term      LowCardinality(String)
  )
  ENGINE = MergeTree()
  PARTITION BY toYYYYMM(event_date)
  ORDER BY (site_id, event_date, event_name)
  SETTINGS index_granularity = 8192`,

	`CREATE MATERIALIZED VIEW IF NOT EXISTS ${CH_DB}.daily_stats
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
  FROM ${CH_DB}.events
  GROUP BY site_id, event_date, source, medium, device, country`,

	`CREATE MATERIALIZED VIEW IF NOT EXISTS ${CH_DB}.page_stats
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
  FROM ${CH_DB}.events
  WHERE event_name = 'pageview'
  GROUP BY site_id, event_date, page_path`,
];

async function main() {
	console.log("Checking ClickHouse connection...");
	const alive = await chPing();
	if (!alive) {
		console.error(
			`✗ ClickHouse not reachable at ${CH_URL}. Start it first.`,
		);
		process.exit(1);
	}
	console.log("✓ ClickHouse reachable");

	for (const sql of SCHEMA) {
		await chExec(sql);
		const label = sql.match(/CREATE\s+(?:DATABASE|MATERIALIZED VIEW|TABLE)\s+(?:IF NOT EXISTS\s+)?(\S+)/i);
		console.log(`✓ ${label?.[1] ?? "schema created"}`);
	}

	console.log(`\nClickHouse schema initialized (database: ${CH_DB})`);
}

await main();
