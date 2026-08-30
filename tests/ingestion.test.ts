/**
 * Event ingestion end-to-end tests — tracker payload → resolve → domain check.
 * ClickHouse insert is mocked (not available in test env).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, mock } from "bun:test";

let app: Awaited<ReturnType<typeof import("../src/server/app")["createApp"]>>;
let userCookie: string;
let siteId: number;
let trackingId: string;
// Mock ClickHouse insert — capture rows for verification.
// Use object wrapper so mock closure and tests share the same array reference.
const capture = { rows: [] as Record<string, unknown>[] };
let chQueryMockImpl: (sql: string) => Promise<Record<string, unknown>[]> = async () => [];
mock.module("../src/server/clickhouse", () => ({
	chQuery: (sql: string) => chQueryMockImpl(sql),
	chInsert: async (_table: string, rows: Record<string, unknown>[]) => {
		capture.rows.push(...rows);
	},
	chPing: async () => true,
}));

beforeAll(async () => {
	process.env.DATABASE_PATH = ":memory:";
	process.env.APP_URL = "http://localhost:3000";
	process.env.RATE_LIMIT_AUTH_MAX = "1000";
	process.env.RATE_LIMIT_GLOBAL_MAX = "10000";
	const { buildClientAssets } = await import("../src/server/assets");
	await buildClientAssets();
	const { createApp } = await import("../src/server/app");
	app = createApp({ version: "test-version", js: "app.js", css: "app.css" });

	const { hashPassword } = await import("../src/server/auth");
	const { createUserWithRole } = await import("../src/server/db");
	createUserWithRole.get("User", "user@ingesttest.com", await hashPassword("password123"), "user");

	const xhr = { "x-inertia": "true" };
	const login = await app.request("http://localhost:3000/login", {
		method: "POST",
		headers: { ...xhr, "content-type": "application/json" },
		body: JSON.stringify({ email: "user@ingesttest.com", password: "password123" }),
	});
	userCookie = (login.headers as Headers & { getSetCookie?: () => string[] })
		.getSetCookie?.().find((c) => c.startsWith("session="))?.split(";")[0] ?? "";

	// Create a site with a registered domain.
	const createResp = await app.request("http://localhost:3000/api/sites", {
		method: "POST",
		headers: { ...xhr, "content-type": "application/json", cookie: userCookie },
		body: JSON.stringify({ name: "Ingest Test", timezone: "UTC", domains: ["test.com"] }),
	});
	const createData = await createResp.json();
	siteId = createData.id;
	trackingId = createData.trackingId;
});

afterAll(async () => {
	const { db } = await import("../src/server/db");
	db.close();
});

const BASE = "http://localhost:3000";

async function postEvent(payload: Record<string, unknown>, headers: Record<string, string> = {}): Promise<Response> {
	return app.request(`${BASE}/api/event`, {
		method: "POST",
		headers: { "content-type": "application/json", origin: "https://test.com", ...headers },
		body: JSON.stringify(payload),
	});
}

describe("event ingestion", () => {
	it("rejects missing tracking_id", async () => {
		const res = await postEvent({ type: "pageview" });
		expect(res.status).toBe(400);
	});

	it("rejects invalid tracking_id", async () => {
		const res = await postEvent({ tracking_id: "invalid-uuid", type: "pageview" });
		expect(res.status).toBe(404);
	});

	it("rejects unregistered domain", async () => {
		const res = await postEvent(
			{ tracking_id: trackingId, type: "pageview" },
			{ origin: "https://evil.com" },
		);
		expect(res.status).toBe(403);
	});

	it("accepts registered domain and inserts to ClickHouse", async () => {
		capture.rows.length = 0;
		const res = await postEvent({
			tracking_id: trackingId,
			type: "pageview",
			path: "/home",
			title: "Home Page",
			referrer: "https://google.com/search?q=test",
		});
		expect(res.status).toBe(204);
		expect(capture.rows.length).toBe(1);
		const row = capture.rows[0]!;
		expect(row.site_id).toBe(siteId);
		expect(row.event_name).toBe("pageview");
		expect(row.page_path).toBe("/home");
		expect(row.source).toBe("google.com");
		expect(row.medium).toBe("organic");
	});

	it("handles heartbeat events", async () => {
		capture.rows.length = 0;
		const res = await postEvent({
			tracking_id: trackingId,
			type: "heartbeat",
			path: "/home",
		});
		expect(res.status).toBe(204);
		expect(capture.rows[0]!.event_name).toBe("heartbeat");
	});

	it("handles exit events with duration", async () => {
		capture.rows.length = 0;
		const res = await postEvent({
			tracking_id: trackingId,
			type: "exit",
			path: "/home",
			duration_ms: 45000,
		});
		expect(res.status).toBe(204);
		expect(capture.rows[0]!.event_name).toBe("exit");
		expect(capture.rows[0]!.duration_ms).toBe(45000);
	});

	it("handles custom events", async () => {
		capture.rows.length = 0;
		const res = await postEvent({
			tracking_id: trackingId,
			type: "custom",
			event_name: "signup_click",
			path: "/signup",
		});
		expect(res.status).toBe(204);
		expect(capture.rows[0]!.event_name).toBe("signup_click");
	});

	it("parses device from User-Agent", async () => {
		capture.rows.length = 0;
		await postEvent(
			{ tracking_id: trackingId, type: "pageview", path: "/" },
			{ "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" },
		);
		expect(capture.rows[0]!.device).toBe("mobile");
		expect(capture.rows[0]!.browser).toBe("safari");
	});

	it("parses direct traffic (no referrer)", async () => {
		capture.rows.length = 0;
		await postEvent({
			tracking_id: trackingId,
			type: "pageview",
			path: "/",
			referrer: "",
		});
		expect(capture.rows[0]!.source).toBe("(direct)");
		expect(capture.rows[0]!.medium).toBe("(none)");
	});

	it("resolve endpoint returns site info", async () => {
		const res = await app.request(`${BASE}/api/resolve?tracking_id=${trackingId}`);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.id).toBe(siteId);
		expect(data.autoAcceptDomains).toBe(false);
	});

	it("resolve-domain endpoint validates registered domain", async () => {
		const ok = await app.request(`${BASE}/api/resolve-domain?site_id=${siteId}&domain=test.com`);
		expect(ok.status).toBe(200);

		const bad = await app.request(`${BASE}/api/resolve-domain?site_id=${siteId}&domain=evil.com`);
		expect(bad.status).toBe(403);
	});

	it("CORS preflight returns correct headers", async () => {
		const res = await app.request(`${BASE}/api/event`, { method: "OPTIONS" });
		expect(res.status).toBe(204);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
		expect(res.headers.get("Access-Control-Allow-Methods")).toBe("POST");
	});
	afterEach(() => {
		chQueryMockImpl = async () => [];
	});

	it("sets is_new_visitor=1 for first-time visitor", async () => {
		capture.rows.length = 0;
		chQueryMockImpl = async () => [];
		await postEvent({ tracking_id: trackingId, type: "pageview", path: "/" });
		expect(capture.rows[0]!.is_new_visitor).toBe(1);
	});

	it("sets is_new_visitor=0 for returning visitor", async () => {
		capture.rows.length = 0;
		chQueryMockImpl = async () => [{ visitor_exists: 1, session_pv_exists: 0 }];
		await postEvent({ tracking_id: trackingId, type: "pageview", path: "/" });
		expect(capture.rows[0]!.is_new_visitor).toBe(0);
	});

	it("sets is_bounce=1 for first pageview in session", async () => {
		capture.rows.length = 0;
		chQueryMockImpl = async () => [];
		await postEvent({ tracking_id: trackingId, type: "pageview", path: "/" });
		expect(capture.rows[0]!.is_bounce).toBe(1);
	});

	it("sets is_bounce=0 when session already has pageview", async () => {
		capture.rows.length = 0;
		chQueryMockImpl = async () => [{ visitor_exists: 1, session_pv_exists: 1 }];
		await postEvent({ tracking_id: trackingId, type: "pageview", path: "/" });
		expect(capture.rows[0]!.is_bounce).toBe(0);
	});

	it("sets is_bounce=0 for non-pageview events", async () => {
		capture.rows.length = 0;
		chQueryMockImpl = async () => [];
		await postEvent({ tracking_id: trackingId, type: "heartbeat", path: "/" });
		expect(capture.rows[0]!.is_bounce).toBe(0);
	});

	it("auto_accept_domains registers unknown domain", async () => {
		const xhr = { "x-inertia": "true" };
		const createResp = await app.request(`${BASE}/api/sites`, {
			method: "POST",
			headers: { ...xhr, "content-type": "application/json", cookie: userCookie },
			body: JSON.stringify({ name: "Auto Accept", timezone: "UTC", domains: ["auto-test.com"] }),
		});
		const createData = await createResp.json();
		const autoSiteId = createData.id;
		const autoTrackingId = createData.trackingId;

		await app.request(`${BASE}/api/sites/${autoSiteId}`, {
			method: "PATCH",
			headers: { ...xhr, "content-type": "application/json", cookie: userCookie },
			body: JSON.stringify({ name: "Auto Accept", timezone: "UTC", auto_accept_domains: 1 }),
		});

		capture.rows.length = 0;
		const res = await app.request(`${BASE}/api/event`, {
			method: "POST",
			headers: { "content-type": "application/json", origin: "https://newdomain.com" },
			body: JSON.stringify({ tracking_id: autoTrackingId, type: "pageview", path: "/" }),
		});
		expect(res.status).toBe(204);

		const resolveRes = await app.request(
			`${BASE}/api/resolve-domain?site_id=${autoSiteId}&domain=newdomain.com`,
		);
		expect(resolveRes.status).toBe(200);
	});

	it("passes UTM params through to ClickHouse", async () => {
		capture.rows.length = 0;
		await postEvent({
			tracking_id: trackingId,
			type: "pageview",
			path: "/landing",
			utm_source: "newsletter",
			utm_medium: "email",
			utm_campaign: "summer_sale",
			utm_content: "hero_banner",
			utm_term: "shoes",
		});
		const row = capture.rows[0]!;
		expect(row.source).toBe("newsletter");
		expect(row.medium).toBe("email");
		expect(row.utm_campaign).toBe("summer_sale");
		expect(row.utm_content).toBe("hero_banner");
		expect(row.utm_term).toBe("shoes");
	});

	it("UTM params override referrer-based source/medium", async () => {
		capture.rows.length = 0;
		await postEvent({
			tracking_id: trackingId,
			type: "pageview",
			path: "/",
			referrer: "https://google.com/search?q=test",
			utm_source: "facebook",
		});
		expect(capture.rows[0]!.source).toBe("facebook");
	});

	it("captures city from cf-ipcity header", async () => {
		capture.rows.length = 0;
		await postEvent(
			{ tracking_id: trackingId, type: "pageview", path: "/" },
			{ "cf-ipcity": "Jakarta" },
		);
		expect(capture.rows[0]!.city).toBe("Jakarta");
	});

	it("captures country from cf-ipcountry header", async () => {
		capture.rows.length = 0;
		await postEvent(
			{ tracking_id: trackingId, type: "pageview", path: "/" },
			{ "cf-ipcountry": "ID" },
		);
		expect(capture.rows[0]!.country).toBe("ID");
	});

	it("passes OS from tracker payload", async () => {
		capture.rows.length = 0;
		await postEvent({
			tracking_id: trackingId,
			type: "pageview",
			path: "/",
			os: "Android",
		});
		expect(capture.rows[0]!.os).toBe("Android");
	});
});
