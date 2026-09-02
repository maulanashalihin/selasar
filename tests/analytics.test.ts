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
		{ visitors: 100, visits: 50, pageviews: 300, bounces: 10, total_duration: 120000 },
	];
	const res = await api("/api/analytics/overview?site_id=1&range=7d", userCookie);
	expect(res.status).toBe(200);
	const data = await res.json();
	expect(data.visitors).toBe(100);
	expect(data.pageviews).toBe(300);
	expect(data.bounceRate).toBe(20);
	expect(data.avgDuration).toBe(2400);
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
		mockImpl = async (sql: string) => {
			if (sql.includes("active_visitors")) {
				return [{ active_visitors: 5 }];
			}
			if (sql.includes("page_path")) {
				return [{ page_path: "/", visitors: 3 }, { page_path: "/about", visitors: 2 }];
			}
			if (sql.includes("source")) {
				return [{ source: "google", visitors: 4 }];
			}
			if (sql.includes("country")) {
				return [{ country: "US", visitors: 3 }];
			}
			if (sql.includes("device")) {
				return [{ device: "desktop", visitors: 4 }];
			}
			return [];
		};
		const res = await api("/api/analytics/realtime?site_id=1", userCookie);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.activeVisitors).toBe(5);
		expect(data.topPages.length).toBe(2);
		expect(data.topPages[0].page_path).toBe("/");
		expect(data.topSources.length).toBe(1);
		expect(data.topCountries.length).toBe(1);
		expect(data.topDevices.length).toBe(1);
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

	it("returns conversions breakdown", async () => {
		mockImpl = async (sql: string) => {
			if (sql.includes("event_name = 'pageview'") && sql.includes("uniq(visitor_id) AS total"))
				return [{ total: 100 }];
			if (sql.includes("GROUP BY event_name"))
				return [{ event_name: "signup", visitors: 30, total: 50 }];
			return [];
		};
		const res = await api("/api/analytics/conversions?site_id=1&range=28d", userCookie);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.totalVisitors).toBe(100);
		expect(data.events.length).toBe(1);
		expect(data.events[0].conversion_rate).toBe(30);
	});

	it("returns campaigns breakdown", async () => {
		mockImpl = async () => [
			{ utm_campaign: "summer", visitors: 50, pageviews: 120 },
		];
		const res = await api("/api/analytics/campaigns?site_id=1&range=28d", userCookie);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.campaigns.length).toBe(1);
		expect(data.campaigns[0].utm_campaign).toBe("summer");
	});

	it("returns visitor types breakdown", async () => {
		mockImpl = async () => [
			{ type: "new", visitors: 60, visits: 70, pageviews: 150 },
			{ type: "returning", visitors: 40, visits: 50, pageviews: 100 },
		];
		const res = await api("/api/analytics/visitor-types?site_id=1&range=28d", userCookie);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.visitorTypes.length).toBe(2);
		expect(data.visitorTypes[0].type).toBe("new");
	});

	it("returns campaigns detail breakdown", async () => {
		mockImpl = async (sql: string) => {
			if (sql.includes("GROUP BY utm_campaign"))
				return [{ utm_campaign: "summer", visitors: 50, pageviews: 120 }];
			if (sql.includes("utm_content"))
				return [{ utm_content: "banner", visitors: 20 }];
			if (sql.includes("utm_term"))
				return [{ utm_term: "shoes", visitors: 10 }];
			if (sql.includes("GROUP BY source"))
				return [{ source: "google", visitors: 40 }];
			if (sql.includes("GROUP BY medium"))
				return [{ medium: "cpc", visitors: 40 }];
			return [];
		};
		const res = await api("/api/analytics/campaigns/detail?site_id=1&range=28d", userCookie);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.campaigns.length).toBe(1);
		expect(data.contents.length).toBe(1);
		expect(data.terms.length).toBe(1);
		expect(data.sources.length).toBe(1);
		expect(data.mediums.length).toBe(1);
	});

	it("conversions handles empty results", async () => {
		mockImpl = async () => [];
		const res = await api("/api/analytics/conversions?site_id=1&range=28d", userCookie);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.totalVisitors).toBe(0);
		expect(data.events.length).toBe(0);
	});

	it("campaigns handles empty results", async () => {
		mockImpl = async () => [];
		const res = await api("/api/analytics/campaigns?site_id=1&range=28d", userCookie);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.campaigns.length).toBe(0);
	});

	it("visitor-types handles empty results", async () => {
		mockImpl = async () => [];
		const res = await api("/api/analytics/visitor-types?site_id=1&range=28d", userCookie);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.visitorTypes.length).toBe(0);
	});

	it("rejects missing site_id on conversions", async () => {
		mockImpl = async () => [];
		const res = await api("/api/analytics/conversions", userCookie);
		expect(res.status).toBe(400);
	});

	it("rejects missing site_id on campaigns", async () => {
		mockImpl = async () => [];
		const res = await api("/api/analytics/campaigns", userCookie);
		expect(res.status).toBe(400);
	});

	it("rejects missing site_id on visitor-types", async () => {
		mockImpl = async () => [];
		const res = await api("/api/analytics/visitor-types", userCookie);
		expect(res.status).toBe(400);
	});

	it("rejects unauthenticated on conversions", async () => {
		mockImpl = async () => [];
		const res = await api("/api/analytics/conversions?site_id=1");
		expect(res.status).toBe(302);
	});
});
