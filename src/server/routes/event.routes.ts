/**
 * Event ingestion — Bun server fallback for dev/local.
 * Same logic as CF Pages Function, but runs on Bun server.
 * Resolves tracking_id → site_id, validates domain, inserts to ClickHouse.
 */
import { Hono } from "hono";
import { addDomain, findSiteByTrackingId, isDomainRegistered } from "../db";
import { chInsert } from "../clickhouse";
import type { AppEnv } from "../inertia-middleware";

/** Parse User-Agent into device + browser (zero-dependency, 10 lines). */
function parseUA(ua: string): { device: string; browser: string } {
	const device = /iPad|Tablet|PlayBook|Silk/.test(ua)
		? "tablet"
		: /Mobile|Android|iPhone|iPod/.test(ua)
			? "mobile"
			: "desktop";
	const browser = /Edg\//.test(ua)
		? "edge"
		: /Firefox\//.test(ua)
			? "firefox"
			: /Chrome\//.test(ua)
				? "chrome"
				: /Safari\//.test(ua)
					? "safari"
					: "other";
	return { device, browser };
}

/** Parse referrer into source + medium. */
function parseReferrer(referrer: string, currentDomain: string): { source: string; medium: string } {
	if (!referrer) return { source: "(direct)", medium: "(none)" };
	try {
		const url = new URL(referrer);
		const refDomain = url.hostname.replace(/^www\./, "");
		if (refDomain === currentDomain) return { source: refDomain, medium: "referral" };
		const searchEngines = ["google", "bing", "duckduckgo", "yandex", "baidu"];
		const social = ["twitter", "x.com", "facebook", "linkedin", "instagram", "reddit", "youtube"];
		if (searchEngines.some((e) => refDomain.includes(e))) return { source: refDomain, medium: "organic" };
		if (social.some((s) => refDomain.includes(s))) return { source: refDomain, medium: "social" };
		return { source: refDomain, medium: "referral" };
	} catch {
		return { source: "(direct)", medium: "(none)" };
	}
}

/** Hash IP + UA + site_id → anonymous visitor_id (prevents cross-site correlation). */
async function hashVisitorId(ip: string, ua: string, siteId: number): Promise<string> {
	const data = new TextEncoder().encode(`${ip}|${ua}|${siteId}`);
	const hash = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/** Session ID = hash(visitor_id + floor(ts/1800)) — 30min window, stateless. */
async function hashSessionId(visitorId: string, ts: number): Promise<string> {
	const bucket = Math.floor(ts / 1800);
	const data = new TextEncoder().encode(`${visitorId}|${bucket}`);
	const hash = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/**
 * In-memory cache for visitor/session existence checks.
 * Replaces a ClickHouse SELECT per event with O(1) Map lookup.
 * TTL: 30min (matches session window). After restart, visitors are
 * re-counted as "new" once — acceptable for analytics.
 */
const VISITOR_TTL_MS = 30 * 60 * 1000;
const seenVisitors = new Map<string, number>(); // visitor_id → first-seen timestamp
const seenSessions = new Map<string, number>(); // session_id → first-pageview timestamp

function checkVisitor(visitorId: string): boolean {
	const now = Date.now();
	const seen = seenVisitors.get(visitorId);
	if (seen !== undefined) return false; // not new
	seenVisitors.set(visitorId, now);
	return true; // new
}

function checkSession(sessionId: string, isPageview: boolean): boolean {
	if (!isPageview) return false;
	const seen = seenSessions.get(sessionId);
	if (seen !== undefined) return false; // already had pageview → not bounce
	seenSessions.set(sessionId, Date.now());
	return true; // first pageview → bounce
}

/** Reset cache (for tests). */
export function resetIngestionCache(): void {
	seenVisitors.clear();
	seenSessions.clear();
}

// Periodic cleanup of expired entries (every 5 min).
setInterval(() => {
	const now = Date.now();
	for (const [key, ts] of seenVisitors) if (now - ts > VISITOR_TTL_MS) seenVisitors.delete(key);
	for (const [key, ts] of seenSessions) if (now - ts > VISITOR_TTL_MS) seenSessions.delete(key);
}, 5 * 60 * 1000);

function getDomainFromReferer(referrer: string): string {
	if (!referrer) return "";
	try {
		return new URL(referrer).hostname.replace(/^www\./, "");
	} catch {
		return "";
	}
}

interface EventPayload {
	tracking_id: string;
	type: string;
	path?: string;
	title?: string;
	referrer?: string;
	ts?: number;
	duration_ms?: number;
	event_name?: string;
	os?: string;
	utm_source?: string;
	utm_medium?: string;
	utm_campaign?: string;
	utm_content?: string;
	utm_term?: string;
}

export const eventRoutes = () => {
	const app = new Hono<AppEnv>();

	// CORS: tracker.js from any domain, no credentials.
	app.options("/api/event", (c) =>
		c.body(null, 204, {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "POST",
			"Access-Control-Allow-Headers": "Content-Type",
		}),
	);

	app.post("/api/event", async (c) => {
		const body = await c.req.json<EventPayload>();
		if (!body.tracking_id) return c.json({ error: "tracking_id required" }, 400);

		// Resolve tracking_id → site_id.
		const site = findSiteByTrackingId.get(body.tracking_id);
		if (!site) return c.json({ error: "Invalid tracking_id" }, 404);

		// Get domain from referrer or Origin header.
		const origin = c.req.header("origin") || "";
		const domain = getDomainFromReferer(origin) || getDomainFromReferer(body.referrer || "");

		// Domain validation (unless auto_accept_domains is on).
		if (domain) {
			const registered = isDomainRegistered.get(site.id, domain);
			if (!registered) {
				if (Number(site.autoAcceptDomains) !== 1) {
					return c.json({ error: "Domain not registered" }, 403);
				}
				addDomain.run(site.id, domain);
			}
		}

		const ua = c.req.header("user-agent") || "";
		const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
		const country = c.req.header("cf-ipcountry") || "";
		const { device, browser } = parseUA(ua);
		const { source: refSource, medium: refMedium } = parseReferrer(body.referrer || "", domain);
		// UTM params override referrer-based source/medium detection.
		const source = body.utm_source || refSource;
		const medium = body.utm_medium || refMedium;
		const ts = body.ts ?? Date.now();
		const eventDate = new Date(ts).toISOString().slice(0, 10);
		const eventTime = new Date(ts).toISOString().slice(0, 19).replace("T", " ");

	const visitorId = await hashVisitorId(ip, ua, site.id);
	const sessionId = await hashSessionId(visitorId, ts);
	const eventName = body.type === "pageview" ? "pageview" : body.type === "custom" ? (body.event_name || "custom") : body.type;
	// O(1) in-memory cache — no ClickHouse round-trip per event.
	const isNewVisitor = checkVisitor(visitorId) ? 1 : 0;
	const isBounce = checkSession(sessionId, eventName === "pageview") ? 1 : 0;


		const row = {
			site_id: site.id,
			domain,
			event_time: eventTime,
			event_date: eventDate,
			event_name: eventName,
			visitor_id: visitorId,
			session_id: sessionId,
			page_path: body.path || "/",
			page_title: body.title || "",
			source,
			medium,
			device,
			browser,
			country,
			city: c.req.header("cf-ipcity") || "",
			duration_ms: body.duration_ms ?? 0,
			is_new_visitor: isNewVisitor,
			is_bounce: isBounce,
			os: body.os || "Unknown",
			utm_campaign: body.utm_campaign || "",
			utm_content: body.utm_content || "",
			utm_term: body.utm_term || "",
		};

	chInsert("events", [row]).catch((err) => {
		console.error("[ingestion] ClickHouse insert failed:", err);
	});

	return c.body(null, 204, { "Access-Control-Allow-Origin": "*" });
	});

	return app;
};
