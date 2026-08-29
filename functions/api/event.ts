/**
 * CF Pages Function — edge event ingestion.
 * Receives POST /api/event from tracker.js, resolves tracking_id → site_id,
 * inserts to ClickHouse. Fire-and-forget (returns 204).
 *
 * In production: CF handles CORS, bot filtering, geo headers.
 * In dev: Bun server fallback (src/server/routes/event.routes.ts) handles same logic.
 */

interface EventPayload {
	tracking_id: string;
	type: string;
	path?: string;
	title?: string;
	referrer?: string;
	ts?: number;
	duration_ms?: number;
	event_name?: string;
	props?: Record<string, unknown>;
}

const CH_URL = process.env.CLICKHOUSE_URL ?? "http://localhost:8123";
const CH_DB = process.env.CLICKHOUSE_DB ?? "analytics";
const API_BASE = process.env.API_BASE ?? "http://localhost:4000";

/** Parse User-Agent into device + browser. */
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
		if (searchEngines.some((e) => refDomain.includes(e)))
			return { source: refDomain, medium: "organic" };
		if (social.some((s) => refDomain.includes(s)))
			return { source: refDomain, medium: "social" };
		return { source: refDomain, medium: "referral" };
	} catch {
		return { source: "(direct)", medium: "(none)" };
	}
}

async function hashSHA256(input: string): Promise<string> {
	const data = new TextEncoder().encode(input);
	const hash = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export const onRequestPost: PagesFunction = async (context) => {
	const request = context.request as Request;

	// CORS preflight.
	if (request.method === "OPTIONS") {
		return new Response(null, {
			status: 204,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "POST",
				"Access-Control-Allow-Headers": "Content-Type",
			},
		});
	}

	const body = (await request.json()) as EventPayload;
	if (!body.tracking_id) {
		return new Response(JSON.stringify({ error: "tracking_id required" }), {
			status: 400,
			headers: { "Access-Control-Allow-Origin": "*" },
		});
	}

	// Resolve tracking_id → site_id via API.
	const resolveResp = await fetch(`${API_BASE}/api/resolve?tracking_id=${body.tracking_id}`);
	if (!resolveResp.ok) {
		return new Response(JSON.stringify({ error: "Invalid tracking_id" }), {
			status: 404,
			headers: { "Access-Control-Allow-Origin": "*" },
		});
	}
	const site = await resolveResp.json<{
		id: number;
		autoAcceptDomains: boolean;
	}>();

	// Get domain from Origin header.
	const origin = request.headers.get("origin") || "";
	let domain = "";
	try {
		if (origin) domain = new URL(origin).hostname.replace(/^www\./, "");
	} catch {
		/* ignore */
	}

	// Domain validation.
	if (domain && !site.autoAcceptDomains) {
		const checkResp = await fetch(
			`${API_BASE}/api/resolve-domain?site_id=${site.id}&domain=${encodeURIComponent(domain)}`,
		);
		if (!checkResp.ok) {
			return new Response(JSON.stringify({ error: "Domain not registered" }), {
				status: 403,
				headers: { "Access-Control-Allow-Origin": "*" },
			});
		}
	}

	const ua = request.headers.get("user-agent") || "";
	const ip = request.headers.get("cf-connecting-ip") || "0.0.0.0";
	const country = request.headers.get("cf-ipcountry") || "";
	const { device, browser } = parseUA(ua);
	const { source, medium } = parseReferrer(body.referrer || "", domain);
	const ts = body.ts ?? Date.now();
	const eventDate = new Date(ts).toISOString().slice(0, 10);
	const eventTime = new Date(ts).toISOString().slice(0, 19).replace("T", " ");

	const visitorId = await hashSHA256(`${ip}|${ua}|${site.id}`);
	const sessionId = await hashSHA256(`${visitorId}|${Math.floor(ts / 1800)}`);
	const eventName =
		body.type === "pageview"
			? "pageview"
			: body.type === "custom"
				? (body.event_name || "custom")
				: body.type;

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
		city: "",
		duration_ms: body.duration_ms ?? 0,
		is_new_visitor: 0,
		is_bounce: 0,
	};

	// Insert to ClickHouse.
	try {
		const chBody = JSON.stringify(row);
		await fetch(
			`${CH_URL}/?database=${CH_DB}&query=${encodeURIComponent("INSERT INTO events FORMAT JSONEachRow")}`,
			{ method: "POST", body: chBody },
		);
	} catch (err) {
		console.error("[cf-ingestion] ClickHouse insert failed:", err);
	}

	return new Response(null, {
		status: 204,
		headers: { "Access-Control-Allow-Origin": "*" },
	});
};
