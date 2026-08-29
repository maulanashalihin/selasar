/**
 * Event ingestion end-to-end tests — tracker payload → resolve → domain check.
 * ClickHouse insert is mocked (not available in test env).
 */
import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";

let app: Awaited<ReturnType<typeof import("../src/server/app")["createApp"]>>;
let userCookie: string;
let siteId: number;
let trackingId: string;
// Mock ClickHouse insert — capture rows for verification.
// Use object wrapper so mock closure and tests share the same array reference.
const capture = { rows: [] as Record<string, unknown>[] };
mock.module("../src/server/clickhouse", () => ({
	chQuery: async () => [],
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
});
