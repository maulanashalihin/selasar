/**
 * Analytics API unit tests — tests route structure, auth, param validation.
 * ClickHouse is mocked via mock.module since it's not available in test env.
 */
import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";

let app: Awaited<ReturnType<typeof import("../src/server/app")["createApp"]>>;
let userCookie: string;

// Type for the mock chQuery function.
type ChQueryFn = <T = Record<string, unknown>>(sql: string) => Promise<T[]>;

// The mock implementation — tests override this per-test.
let mockImpl: ChQueryFn = async () => [];

// Mock the clickhouse module before any imports that use it.
mock.module("../src/server/clickhouse", () => ({
	chQuery: ((sql: string) => mockImpl(sql)) as ChQueryFn,
	chInsert: async () => {},
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
	createUserWithRole.get("User", "user@analtest.com", await hashPassword("password123"), "user");

	const xhr = { "x-inertia": "true" };
	const login = await app.request("http://localhost:3000/login", {
		method: "POST",
		headers: { ...xhr, "content-type": "application/json" },
		body: JSON.stringify({ email: "user@analtest.com", password: "password123" }),
	});
	userCookie = (login.headers as Headers & { getSetCookie?: () => string[] })
		.getSetCookie?.().find((c) => c.startsWith("session="))?.split(";")[0] ?? "";
});

afterAll(async () => {
	const { db } = await import("../src/server/db");
	db.close();
});

const BASE = "http://localhost:3000";
const xhr = { "x-inertia": "true" };

async function api(path: string, cookie?: string): Promise<Response> {
	const headers = new Headers({ ...xhr });
	if (cookie) headers.set("cookie", cookie);
	return app.request(`${BASE}${path}`, { headers });
}

describe("analytics API", () => {
	it("rejects unauthenticated requests", async () => {
		const res = await api("/api/analytics/overview?site_id=1");
		expect(res.status).toBe(302);
	});

	it("rejects missing site_id param", async () => {
		mockImpl = async () => [];
		const res = await api("/api/analytics/overview", userCookie);
		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.error).toContain("site_id");
	});

	it("returns overview metrics", async () => {
		mockImpl = async () => [
			{ visitors: 100, pageviews: 300, bounces: 60, total_duration: 120000 },
		];
		const res = await api("/api/analytics/overview?site_id=1&range=7d", userCookie);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.visitors).toBe(100);
		expect(data.pageviews).toBe(300);
		expect(data.bounceRate).toBe(20);
		expect(data.avgDuration).toBe(1200);
	});

	it("returns traffic chart data", async () => {
		mockImpl = async () => [
			{ date: "2026-08-28", visitors: 50, pageviews: 120 },
			{ date: "2026-08-29", visitors: 60, pageviews: 150 },
		];
		const res = await api("/api/analytics/traffic?site_id=1&range=7d", userCookie);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.data.length).toBe(2);
		expect(data.data[0].visitors).toBe(50);
	});

	it("returns top pages", async () => {
		mockImpl = async () => [
			{ page_path: "/", views: 200, unique_visitors: 80, avg_duration: 5000 },
			{ page_path: "/about", views: 100, unique_visitors: 40, avg_duration: 3000 },
		];
		const res = await api("/api/analytics/pages?site_id=1&range=7d", userCookie);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.pages.length).toBe(2);
		expect(data.pages[0].page_path).toBe("/");
	});

	it("returns sources breakdown", async () => {
		mockImpl = async () => [
			{ source: "google", medium: "organic", visitors: 70, pageviews: 200 },
			{ source: "(direct)", medium: "(none)", visitors: 30, pageviews: 100 },
		];
		const res = await api("/api/analytics/sources?site_id=1&range=7d", userCookie);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.sources.length).toBe(2);
		expect(data.sources[0].source).toBe("google");
	});

	it("returns devices breakdown", async () => {
		mockImpl = async () => [
			{ device: "desktop", browser: "chrome", visitors: 60 },
			{ device: "mobile", browser: "safari", visitors: 40 },
		];
		const res = await api("/api/analytics/devices?site_id=1&range=7d", userCookie);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.devices.length).toBe(2);
		expect(data.devices[0].device).toBe("desktop");
	});

	it("returns geography breakdown", async () => {
		mockImpl = async () => [
			{ country: "US", visitors: 50, pageviews: 120 },
			{ country: "ID", visitors: 30, pageviews: 80 },
		];
		const res = await api("/api/analytics/geography?site_id=1&range=7d", userCookie);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.countries.length).toBe(2);
		expect(data.countries[0].country).toBe("US");
	});

	it("returns realtime visitor count", async () => {
		mockImpl = async () => [
			{ active_visitors: 5, top_pages: '["/","/about"]' },
		];
		const res = await api("/api/analytics/realtime?site_id=1", userCookie);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.activeVisitors).toBe(5);
		expect(data.topPages).toBe('["/","/about"]');
	});

	it("handles empty ClickHouse results gracefully", async () => {
		mockImpl = async () => [];
		const res = await api("/api/analytics/overview?site_id=1&range=7d", userCookie);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.visitors).toBe(0);
		expect(data.pageviews).toBe(0);
		expect(data.bounceRate).toBe(0);
	});
});
