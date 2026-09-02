/**
 * Analytics API routes — ClickHouse query endpoints.
 * Per-site access control: users see only assigned sites; admins see all.
 * Returns JSON for Inertia SPA navigation + client-side refetch.
 */
import { Hono } from "hono";
import { requireAuth } from "../auth";
import { chQuery } from "../clickhouse";
import { accessibleSite, canAccessSite } from "../db";
import { config } from "../config";
import type { AppEnv } from "../inertia-middleware";

/** Parse range param into SQL date filter. */
function rangeFilter(range: string, from?: string, to?: string): string {
	if (from && to) {
		return `event_date >= '${from}' AND event_date <= '${to}'`;
	}
	const now = "today()";
	switch (range) {
		case "today":
			return `event_date = ${now}`;
		case "yesterday":
			return `event_date = ${now} - 1`;
		case "realtime":
			return `event_time >= now() - INTERVAL 5 MINUTE`;
		case "24h":
			return `event_time >= now() - INTERVAL 24 HOUR`;
		case "7d":
			return `event_date >= ${now} - 7`;
		case "28d":
			return `event_date >= ${now} - 28`;
		case "91d":
			return `event_date >= ${now} - 91`;
		case "mtd":
			return `event_date >= toStartOfMonth(${now})`;
		case "last_month":
			return `event_date >= toStartOfMonth(${now} - INTERVAL 1 MONTH) AND event_date < toStartOfMonth(${now})`;
		case "ytd":
			return `event_date >= toStartOfYear(${now})`;
		case "12mo":
			return `event_date >= ${now} - 365`;
		case "all":
			return `1=1`;
	}
	return `1=1`;
}

/** Previous period filter for trend comparison. */
function rangeFilterPrev(range: string): string {
	const now = "today()";
	switch (range) {
		case "today":
			return `event_date = ${now} - 1`;
		case "yesterday":
			return `event_date = ${now} - 2`;
		case "realtime":
			return `event_time >= now() - INTERVAL 10 MINUTE AND event_time < now() - INTERVAL 5 MINUTE`;
		case "24h":
			return `event_time >= now() - INTERVAL 48 HOUR AND event_time < now() - INTERVAL 24 HOUR`;
		case "7d":
			return `event_date >= ${now} - 14 AND event_date < ${now} - 7`;
		case "28d":
			return `event_date >= ${now} - 56 AND event_date < ${now} - 28`;
		case "91d":
			return `event_date >= ${now} - 182 AND event_date < ${now} - 91`;
		case "mtd":
			return `event_date >= toStartOfMonth(${now} - INTERVAL 1 MONTH) AND event_date < toStartOfMonth(${now})`;
		case "last_month":
			return `event_date >= toStartOfMonth(${now} - INTERVAL 2 MONTH) AND event_date < toStartOfMonth(${now} - INTERVAL 1 MONTH)`;
		case "ytd":
			return `event_date >= toStartOfYear(${now} - INTERVAL 1 YEAR) AND event_date < toStartOfYear(${now})`;
		case "12mo":
			return `event_date >= ${now} - 730 AND event_date < ${now} - 365`;
		case "all":
			return `1=1`;
	}
	return `1=1`;
}

export const analyticsRoutes = () => {
	const app = new Hono<AppEnv>();

	// --- Inertia pages (analytics sub-pages) ---

	app.get("/sites/:id/analytics/realtime", requireAuth, (c) => {
		const id = Number(c.req.param("id"));
		const site = accessibleSite(id, c.var.user!);
		if (!site) return c.var.inertia.render("NotFound", {}, { status: 404 });
		return c.var.inertia.render("analytics/Realtime", { site });
	});

	app.get("/sites/:id/analytics/pages", requireAuth, (c) => {
		const id = Number(c.req.param("id"));
		const site = accessibleSite(id, c.var.user!);
		if (!site) return c.var.inertia.render("NotFound", {}, { status: 404 });
		return c.var.inertia.render("analytics/Pages", { site });
	});

	app.get("/sites/:id/analytics/sources", requireAuth, (c) => {
		const id = Number(c.req.param("id"));
		const site = accessibleSite(id, c.var.user!);
		if (!site) return c.var.inertia.render("NotFound", {}, { status: 404 });
		return c.var.inertia.render("analytics/Sources", { site });
	});

	app.get("/sites/:id/analytics/devices", requireAuth, (c) => {
		const id = Number(c.req.param("id"));
		const site = accessibleSite(id, c.var.user!);
		if (!site) return c.var.inertia.render("NotFound", {}, { status: 404 });
		return c.var.inertia.render("analytics/Devices", { site });
	});

	app.get("/sites/:id/analytics/geography", requireAuth, (c) => {
		const id = Number(c.req.param("id"));
		const site = accessibleSite(id, c.var.user!);
		if (!site) return c.var.inertia.render("NotFound", {}, { status: 404 });
		return c.var.inertia.render("analytics/Geography", { site });
	});

	app.get("/sites/:id/analytics/conversions", requireAuth, (c) => {
		const id = Number(c.req.param("id"));
		const site = accessibleSite(id, c.var.user!);
		if (!site) return c.var.inertia.render("NotFound", {}, { status: 404 });
		return c.var.inertia.render("analytics/Conversions", { site });
	});

	app.get("/sites/:id/analytics/campaigns", requireAuth, (c) => {
		const id = Number(c.req.param("id"));
		const site = accessibleSite(id, c.var.user!);
		if (!site) return c.var.inertia.render("NotFound", {}, { status: 404 });
		return c.var.inertia.render("analytics/Campaigns", { site });
	});

	app.get("/sites/:id/analytics/tracking", requireAuth, (c) => {
		const id = Number(c.req.param("id"));
		const site = accessibleSite(id, c.var.user!);
		if (!site) return c.var.inertia.render("NotFound", {}, { status: 404 });
		return c.var.inertia.render("analytics/Tracking", { site, appUrl: config.appUrl });
	});

	// --- JSON API ---

	// GET /api/analytics/overview?site_id=1&range=7d
	// Metric cards: visitors, visits, pageviews, bounce rate, avg duration.
	app.get("/api/analytics/overview", requireAuth, async (c) => {
		const siteId = Number(c.req.query("site_id"));
		if (!siteId) return c.json({ error: "site_id required" }, 400);
if (!canAccessSite(siteId, c.var.user!)) return c.json({ error: "Site not found" }, 404);
		const range = c.req.query("range") ?? "7d";
		const from = c.req.query("from");
		const to = c.req.query("to");
		const rf = rangeFilter(range, from, to);

	const rows = await chQuery<{
		visitors: number;
		visits: number;
		pageviews: number;
		bounces: number;
		total_duration: number;
	}>(
		`SELECT
		uniq(visitor_id) AS visitors,
		uniqIf(session_id, event_name = 'pageview') AS visits,
		countIf(event_name = 'pageview') AS pageviews,
		(SELECT count() FROM (SELECT session_id FROM events WHERE site_id = ${siteId} AND ${rf} AND event_name = 'pageview' GROUP BY session_id HAVING count() = 1)) AS bounces,
			sum(duration_ms) AS total_duration
		FROM events
		WHERE site_id = ${siteId} AND ${rf}`,
	);

	// Previous period for trend comparison
	const prevRf = rangeFilterPrev(range);
	const prevRows = await chQuery<{
		visitors: number;
		visits: number;
		pageviews: number;
		bounces: number;
		total_duration: number;
	}>(
		`SELECT
		uniq(visitor_id) AS visitors,
		uniqIf(session_id, event_name = 'pageview') AS visits,
			countIf(event_name = 'pageview') AS pageviews,
		(SELECT count() FROM (SELECT session_id FROM events WHERE site_id = ${siteId} AND ${prevRf} AND event_name = 'pageview' GROUP BY session_id HAVING count() = 1)) AS bounces,
			sum(duration_ms) AS total_duration
		FROM events
		WHERE site_id = ${siteId} AND ${prevRf}`,
	);

	const r = rows[0] ?? { visitors: 0, visits: 0, pageviews: 0, bounces: 0, total_duration: 0 };
	const p = prevRows[0] ?? { visitors: 0, visits: 0, pageviews: 0, bounces: 0, total_duration: 0 };
	const bounceRate = r.visits > 0 ? (r.bounces / r.visits) * 100 : 0;
	const avgDuration = r.visits > 0 ? r.total_duration / r.visits : 0;
	const prevBounceRate = p.visits > 0 ? (p.bounces / p.visits) * 100 : 0;
	const prevAvgDuration = p.visits > 0 ? p.total_duration / p.visits : 0;

	function change(curr: number, prev: number): number | null {
		if (prev === 0) return null;
		return Math.round(((curr - prev) / prev) * 1000) / 10;
	}

	return c.json({
		visitors: r.visitors,
		visits: r.visits,
		pageviews: r.pageviews,
		bounceRate: Math.round(bounceRate * 10) / 10,
		avgDuration: Math.round(avgDuration),
		changes: {
			visitors: change(r.visitors, p.visitors),
			visits: change(r.visits, p.visits),
			pageviews: change(r.pageviews, p.pageviews),
			bounceRate: change(bounceRate, prevBounceRate),
			avgDuration: change(avgDuration, prevAvgDuration),
		},
	});
	});

	// GET /api/analytics/traffic?site_id=1&range=7d&metric=visitors
	// Line chart data — granularity depends on range, metric selectable.
	app.get("/api/analytics/traffic", requireAuth, async (c) => {
		const siteId = Number(c.req.query("site_id"));
		if (!siteId) return c.json({ error: "site_id required" }, 400);
if (!canAccessSite(siteId, c.var.user!)) return c.json({ error: "Site not found" }, 404);
		const range = c.req.query("range") ?? "7d";
		const metric = c.req.query("metric") ?? "visitors";
		const from = c.req.query("from");
		const to = c.req.query("to");
		const rf = rangeFilter(range, from, to);

		// Determine granularity
		let dateExpr: string;
		if (range === "today" || range === "yesterday" || range === "24h" || range === "realtime") {
			// Hourly for short views
			dateExpr = "formatDateTime(event_time, '%Y-%m-%d %H:00')";
		} else if (range === "12mo" || range === "all") {
			// Monthly for long ranges
			dateExpr = "formatDateTime(event_date, '%Y-%m')";
		} else {
			// Daily for 7d/28d/91d/mtd/last_month/ytd
			dateExpr = "toString(event_date)";
		}

		// Build metric expression
		let metricExpr: string;
		switch (metric) {
			case "visits":
			metricExpr = "uniqIf(session_id, event_name = 'pageview')";
				break;
			case "pageviews":
				metricExpr = "countIf(event_name = 'pageview')";
				break;
			case "bounce_rate":
				metricExpr = "if(count() > 0, round(sum(is_bounce) / count() * 100, 1), 0)";
				break;
			case "duration":
				metricExpr = "if(uniq(visitor_id) > 0, round(avg(duration_ms)), 0)";
				break;
			case "views_per_visit":
				metricExpr = "if(uniq(visitor_id) > 0, round(countIf(event_name = 'pageview') / uniq(visitor_id), 2), 0)";
				break;
			default:
				metricExpr = "uniq(visitor_id)";
		}

		const rows = await chQuery<{ date: string; visitors: number; pageviews: number }>(
			`SELECT
				${dateExpr} AS date,
				${metricExpr} AS visitors,
				countIf(event_name = 'pageview') AS pageviews
			FROM events
			WHERE site_id = ${siteId} AND ${rf}
			GROUP BY date
			ORDER BY date`,
		);

		return c.json({ data: rows, metric });
	});

	// GET /api/analytics/pages?site_id=1&range=7d&type=top|entry|exit
	app.get("/api/analytics/pages", requireAuth, async (c) => {
		const siteId = Number(c.req.query("site_id"));
		if (!siteId) return c.json({ error: "site_id required" }, 400);
if (!canAccessSite(siteId, c.var.user!)) return c.json({ error: "Site not found" }, 404);
		const range = c.req.query("range") ?? "7d";
		const type = c.req.query("type") ?? "top";
		const from = c.req.query("from");
		const to = c.req.query("to");
		const rf = rangeFilter(range, from, to);

		let filterSql = "";
		if (type === "entry") {
			// First pageview per session
			filterSql = `AND (visitor_id, session_id, event_time) IN (SELECT visitor_id, session_id, min(event_time) FROM events WHERE site_id = ${siteId} AND ${rf} AND event_name = 'pageview' GROUP BY visitor_id, session_id)`;
		} else if (type === "exit") {
			// Last pageview per session
			filterSql = `AND (visitor_id, session_id, event_time) IN (SELECT visitor_id, session_id, max(event_time) FROM events WHERE site_id = ${siteId} AND ${rf} AND event_name = 'pageview' GROUP BY visitor_id, session_id)`;
		}

		const [totalRow, rows] = await Promise.all([
			chQuery<{ total: number }>(
				`SELECT uniq(visitor_id) AS total FROM events WHERE site_id = ${siteId} AND ${rf} AND event_name = 'pageview'`,
			),
			chQuery<{
				page_path: string;
				page_title: string;
				views: number;
				unique_visitors: number;
				avg_duration: number;
			}>(
			`SELECT
				page_path,
				any(page_title) AS page_title,
				count() AS views,
				uniq(visitor_id) AS unique_visitors,
				avg(duration_ms) AS avg_duration
			FROM events
			WHERE site_id = ${siteId} AND ${rf} AND event_name = 'pageview'${filterSql ? ' ' + filterSql : ''}
			GROUP BY page_path
			ORDER BY views DESC
			LIMIT 100`,
			),
		]);

		return c.json({ totalVisitors: totalRow[0]?.total ?? 0, pages: rows });
	});

	// GET /api/analytics/sources?site_id=1&range=7d&type=sources|channels
	app.get("/api/analytics/sources", requireAuth, async (c) => {
		const siteId = Number(c.req.query("site_id"));
		if (!siteId) return c.json({ error: "site_id required" }, 400);
if (!canAccessSite(siteId, c.var.user!)) return c.json({ error: "Site not found" }, 404);
		const range = c.req.query("range") ?? "7d";
		const type = c.req.query("type") ?? "sources";
		const from = c.req.query("from");
		const to = c.req.query("to");
		const rf = rangeFilter(range, from, to);

		if (type === "channels") {
			// Group by medium (channel)
			const [rows, totalRows] = await Promise.all([
				chQuery<{ source: string; medium: string; visitors: number; pageviews: number }>(
					`SELECT
						medium AS source,
						medium,
						uniq(visitor_id) AS visitors,
						countIf(event_name = 'pageview') AS pageviews
					FROM events
					WHERE site_id = ${siteId} AND ${rf}
					GROUP BY medium
					ORDER BY visitors DESC`,
				),
				chQuery<{ total: number }>(
					`SELECT uniq(visitor_id) AS total FROM events WHERE site_id = ${siteId} AND ${rf} AND event_name = 'pageview'`,
				),
			]);
			const totalRow = totalRows[0];
			return c.json({ totalVisitors: totalRow?.total ?? 0, sources: rows });
		}

		// Default: group by source
		const [rows, totalRows] = await Promise.all([
			chQuery<{ source: string; medium: string; visitors: number; pageviews: number }>(
				`SELECT
					source,
					medium,
					uniq(visitor_id) AS visitors,
					countIf(event_name = 'pageview') AS pageviews
				FROM events
				WHERE site_id = ${siteId} AND ${rf}
				GROUP BY source, medium
				ORDER BY visitors DESC`,
			),
			chQuery<{ total: number }>(
				`SELECT uniq(visitor_id) AS total FROM events WHERE site_id = ${siteId} AND ${rf} AND event_name = 'pageview'`,
			),
		]);
		const totalRow = totalRows[0];
		return c.json({ totalVisitors: totalRow?.total ?? 0, sources: rows });
	});

	// GET /api/analytics/devices?site_id=1&range=7d&type=devices|browsers|os
	app.get("/api/analytics/devices", requireAuth, async (c) => {
		const siteId = Number(c.req.query("site_id"));
		if (!siteId) return c.json({ error: "site_id required" }, 400);
if (!canAccessSite(siteId, c.var.user!)) return c.json({ error: "Site not found" }, 404);
		const range = c.req.query("range") ?? "7d";
		const type = c.req.query("type") ?? "devices";
		const from = c.req.query("from");
		const to = c.req.query("to");
		const rf = rangeFilter(range, from, to);

		const groupExpr = type === "browsers" ? "browser" : type === "os" ? "os" : "device";

		const [rows, totalRow] = await Promise.all([
			chQuery<{ device: string; browser: string; visitors: number }>(
				`SELECT
					${groupExpr} AS device,
					${groupExpr} AS browser,
					uniq(visitor_id) AS visitors
				FROM events
				WHERE site_id = ${siteId} AND ${rf}
				GROUP BY ${groupExpr}
				ORDER BY visitors DESC`,
			),
			chQuery<{ total: number }>(
				`SELECT uniq(visitor_id) AS total FROM events WHERE site_id = ${siteId} AND ${rf} AND event_name = 'pageview'`,
			),
		]);

		return c.json({ totalVisitors: totalRow[0]?.total ?? 0, devices: rows });
	});

	// GET /api/analytics/geography?site_id=1&range=7d&type=countries|cities
	app.get("/api/analytics/geography", requireAuth, async (c) => {
		const siteId = Number(c.req.query("site_id"));
		if (!siteId) return c.json({ error: "site_id required" }, 400);
if (!canAccessSite(siteId, c.var.user!)) return c.json({ error: "Site not found" }, 404);
		const range = c.req.query("range") ?? "7d";
		const type = c.req.query("type") ?? "countries";
		const from = c.req.query("from");
		const to = c.req.query("to");
		const rf = rangeFilter(range, from, to);

		const groupExpr = type === "cities" ? "city" : "country";

		const [rows, totalRow] = await Promise.all([
			chQuery<{ country: string; visitors: number; pageviews: number }>(
				`SELECT
					${groupExpr} AS country,
					uniq(visitor_id) AS visitors,
					countIf(event_name = 'pageview') AS pageviews
				FROM events
				WHERE site_id = ${siteId} AND ${rf}
				GROUP BY ${groupExpr}
				ORDER BY visitors DESC`,
			),
			chQuery<{ total: number }>(
				`SELECT uniq(visitor_id) AS total FROM events WHERE site_id = ${siteId} AND ${rf} AND event_name = 'pageview'`,
			),
		]);

		return c.json({ totalVisitors: totalRow[0]?.total ?? 0, countries: rows });
	});

	// GET /api/analytics/realtime?site_id=1
	// Live visitor count (last 5 min) + breakdowns.
	app.get("/api/analytics/realtime", requireAuth, async (c) => {
		const siteId = Number(c.req.query("site_id"));
		if (!siteId) return c.json({ error: "site_id required" }, 400);
if (!canAccessSite(siteId, c.var.user!)) return c.json({ error: "Site not found" }, 404);

		const [visitorRows, pageRows, sourceRows, countryRows, deviceRows] = await Promise.all([
			chQuery<{ active_visitors: number }>(
				`SELECT uniq(visitor_id) AS active_visitors FROM events WHERE site_id = ${siteId} AND event_time >= now() - INTERVAL 5 MINUTE`,
			),
			chQuery<{ page_path: string; visitors: number }>(
				`SELECT page_path, uniq(visitor_id) AS visitors FROM events WHERE site_id = ${siteId} AND event_time >= now() - INTERVAL 5 MINUTE GROUP BY page_path ORDER BY visitors DESC LIMIT 7`,
			),
			chQuery<{ source: string; visitors: number }>(
				`SELECT source, uniq(visitor_id) AS visitors FROM events WHERE site_id = ${siteId} AND event_time >= now() - INTERVAL 5 MINUTE GROUP BY source ORDER BY visitors DESC LIMIT 7`,
			),
			chQuery<{ country: string; visitors: number }>(
				`SELECT country, uniq(visitor_id) AS visitors FROM events WHERE site_id = ${siteId} AND event_time >= now() - INTERVAL 5 MINUTE GROUP BY country ORDER BY visitors DESC LIMIT 7`,
			),
			chQuery<{ device: string; visitors: number }>(
				`SELECT device, uniq(visitor_id) AS visitors FROM events WHERE site_id = ${siteId} AND event_time >= now() - INTERVAL 5 MINUTE GROUP BY device ORDER BY visitors DESC LIMIT 7`,
			),
		]);

		return c.json({
			activeVisitors: visitorRows[0]?.active_visitors ?? 0,
			topPages: pageRows,
			topSources: sourceRows,
			topCountries: countryRows,
			topDevices: deviceRows,
		});
	});

	// GET /api/analytics/conversions?site_id=1&range=28d
	// Auto-calculated custom event conversion rate (no manual goals needed).
	app.get("/api/analytics/conversions", requireAuth, async (c) => {
		const siteId = Number(c.req.query("site_id"));
		if (!siteId) return c.json({ error: "site_id required" }, 400);
if (!canAccessSite(siteId, c.var.user!)) return c.json({ error: "Site not found" }, 404);
		const range = c.req.query("range") ?? "28d";
		const dateFilter = rangeFilter(range);

		const [totalRow, eventRows] = await Promise.all([
			chQuery<{ total: number }>(
				`SELECT uniq(visitor_id) AS total FROM events WHERE site_id = ${siteId} AND event_name = 'pageview' AND ${dateFilter}`,
			),
			chQuery<{ event_name: string; visitors: number; total: number }>(
				`SELECT event_name, uniq(visitor_id) AS visitors, count() AS total FROM events WHERE site_id = ${siteId} AND event_name != 'pageview' AND ${dateFilter} GROUP BY event_name ORDER BY visitors DESC`,
			),
		]);

		const totalVisitors = totalRow[0]?.total ?? 0;
		const events = eventRows.map((r) => ({
			event_name: r.event_name,
			visitors: r.visitors,
			total: r.total,
			conversion_rate: totalVisitors > 0 ? Number(((r.visitors / totalVisitors) * 100).toFixed(1)) : 0,
		}));

		return c.json({ totalVisitors, events });
	});

	// GET /api/analytics/campaigns?site_id=1&range=28d
	// UTM campaign breakdown — visitors + pageviews per campaign.
	app.get("/api/analytics/campaigns", requireAuth, async (c) => {
		const siteId = Number(c.req.query("site_id"));
		if (!siteId) return c.json({ error: "site_id required" }, 400);
if (!canAccessSite(siteId, c.var.user!)) return c.json({ error: "Site not found" }, 404);
		const range = c.req.query("range") ?? "28d";
		const dateFilter = rangeFilter(range);

		const rows = await chQuery<{ utm_campaign: string; visitors: number; pageviews: number }>(
			`SELECT utm_campaign, uniq(visitor_id) AS visitors, countIf(event_name = 'pageview') AS pageviews FROM events WHERE site_id = ${siteId} AND utm_campaign != '' AND ${dateFilter} GROUP BY utm_campaign ORDER BY visitors DESC`,
		);

		return c.json({ campaigns: rows });
	});

	// GET /api/analytics/visitor-types?site_id=1&range=28d
	// New vs returning visitors breakdown.
	app.get("/api/analytics/visitor-types", requireAuth, async (c) => {
		const siteId = Number(c.req.query("site_id"));
		if (!siteId) return c.json({ error: "site_id required" }, 400);
if (!canAccessSite(siteId, c.var.user!)) return c.json({ error: "Site not found" }, 404);
		const range = c.req.query("range") ?? "28d";
		const from = c.req.query("from");
		const to = c.req.query("to");
		const rf = rangeFilter(range, from, to);

		const rows = await chQuery<{ type: string; visitors: number; visits: number; pageviews: number }>(
			`SELECT
				if(is_new_visitor = 1, 'new', 'returning') AS type,
				uniq(visitor_id) AS visitors,
			uniqIf(session_id, event_name = 'pageview') AS visits,
				countIf(event_name = 'pageview') AS pageviews
			FROM events
			WHERE site_id = ${siteId} AND ${rf}
			GROUP BY type
			ORDER BY visitors DESC`,
		);

		return c.json({ visitorTypes: rows });
	});

	// GET /api/analytics/campaigns/detail?site_id=1&range=28d
	// Full UTM breakdown: campaign + content + term + source + medium.
	app.get("/api/analytics/campaigns/detail", requireAuth, async (c) => {
		const siteId = Number(c.req.query("site_id"));
		if (!siteId) return c.json({ error: "site_id required" }, 400);
if (!canAccessSite(siteId, c.var.user!)) return c.json({ error: "Site not found" }, 404);
		const range = c.req.query("range") ?? "28d";
		const from = c.req.query("from");
		const to = c.req.query("to");
		const rf = rangeFilter(range, from, to);

		const [campaigns, contents, terms, sources, mediums] = await Promise.all([
			chQuery<{ utm_campaign: string; visitors: number; pageviews: number }>(
				`SELECT utm_campaign, uniq(visitor_id) AS visitors, countIf(event_name = 'pageview') AS pageviews FROM events WHERE site_id = ${siteId} AND utm_campaign != '' AND ${rf} GROUP BY utm_campaign ORDER BY visitors DESC`,
			),
			chQuery<{ utm_content: string; visitors: number }>(
				`SELECT utm_content, uniq(visitor_id) AS visitors FROM events WHERE site_id = ${siteId} AND utm_content != '' AND ${rf} GROUP BY utm_content ORDER BY visitors DESC`,
			),
			chQuery<{ utm_term: string; visitors: number }>(
				`SELECT utm_term, uniq(visitor_id) AS visitors FROM events WHERE site_id = ${siteId} AND utm_term != '' AND ${rf} GROUP BY utm_term ORDER BY visitors DESC`,
			),
			chQuery<{ source: string; visitors: number }>(
				`SELECT source, uniq(visitor_id) AS visitors FROM events WHERE site_id = ${siteId} AND utm_campaign != '' AND ${rf} GROUP BY source ORDER BY visitors DESC`,
			),
			chQuery<{ medium: string; visitors: number }>(
				`SELECT medium, uniq(visitor_id) AS visitors FROM events WHERE site_id = ${siteId} AND utm_campaign != '' AND ${rf} GROUP BY medium ORDER BY visitors DESC`,
			),
		]);

		return c.json({ campaigns, contents, terms, sources, mediums });
	});

	return app;
};
