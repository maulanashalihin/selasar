/**
 * Multi-domain tests — domain resolution, validation, aggregation.
 * Tests that events from different domains under the same site are accepted,
 * and that unregistered domains are rejected.
 */
import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";

let app: Awaited<ReturnType<typeof import("../src/server/app")["createApp"]>>;
let userCookie: string;
let siteId: number;
let trackingId: string;

// Mock ClickHouse — capture inserted rows.
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
	createUserWithRole.get("User", "user@multitest.com", await hashPassword("password123"), "user");

	const xhr = { "x-inertia": "true" };
	const login = await app.request("http://localhost:3000/login", {
		method: "POST",
		headers: { ...xhr, "content-type": "application/json" },
		body: JSON.stringify({ email: "user@multitest.com", password: "password123" }),
	});
	userCookie = (login.headers as Headers & { getSetCookie?: () => string[] })
		.getSetCookie?.().find((c) => c.startsWith("session="))?.split(";")[0] ?? "";

	// Create site with 3 domains.
	const createResp = await app.request("http://localhost:3000/api/sites", {
		method: "POST",
		headers: { ...xhr, "content-type": "application/json", cookie: userCookie },
		body: JSON.stringify({
			name: "Multi Domain Site",
			timezone: "UTC",
			domains: ["primary.com", "secondary.com", "tertiary.com"],
		}),
	});
	const data = await createResp.json();
	siteId = data.id;
	trackingId = data.trackingId;
});

afterAll(async () => {
	const { db } = await import("../src/server/db");
	db.close();
});

const BASE = "http://localhost:3000";

async function postEvent(
	payload: Record<string, unknown>,
	origin: string,
): Promise<Response> {
	return app.request(`${BASE}/api/event`, {
		method: "POST",
		headers: { "content-type": "application/json", origin },
		body: JSON.stringify(payload),
	});
}

describe("multi-domain", () => {
	it("accepts events from all registered domains", async () => {
		capture.rows.length = 0;
		const domains = ["primary.com", "secondary.com", "tertiary.com"];
		for (const domain of domains) {
			const res = await postEvent(
				{ tracking_id: trackingId, type: "pageview", path: "/" },
				`https://${domain}`,
			);
			expect(res.status).toBe(204);
		}
		expect(capture.rows.length).toBe(3);
		expect(capture.rows.map((r) => r.domain)).toEqual(domains);
	});

	it("rejects events from unregistered domain", async () => {
		capture.rows.length = 0;
		const res = await postEvent(
			{ tracking_id: trackingId, type: "pageview", path: "/" },
			"https://evil.com",
		);
		expect(res.status).toBe(403);
		expect(capture.rows.length).toBe(0);
	});

	it("all domains share the same site_id", async () => {
		capture.rows.length = 0;
		await postEvent(
			{ tracking_id: trackingId, type: "pageview", path: "/" },
			"https://primary.com",
		);
		await postEvent(
			{ tracking_id: trackingId, type: "pageview", path: "/about" },
			"https://secondary.com",
		);
		expect(capture.rows.length).toBe(2);
		expect(capture.rows[0]!.site_id).toBe(siteId);
		expect(capture.rows[1]!.site_id).toBe(siteId);
	});

	it("domain normalization strips www. and protocol", async () => {
		capture.rows.length = 0;
		const res = await postEvent(
			{ tracking_id: trackingId, type: "pageview", path: "/" },
			"https://www.primary.com",
		);
		expect(res.status).toBe(204);
		expect(capture.rows[0]!.domain).toBe("primary.com");
	});

	it("adding a new domain allows events from it", async () => {
		// Add new domain via API.
		const xhr = { "x-inertia": "true" };
		await app.request(`${BASE}/api/sites/${siteId}/domains`, {
			method: "POST",
			headers: { ...xhr, "content-type": "application/json", cookie: userCookie },
			body: JSON.stringify({ domain: "newdomain.com" }),
		});

		capture.rows.length = 0;
		const res = await postEvent(
			{ tracking_id: trackingId, type: "pageview", path: "/" },
			"https://newdomain.com",
		);
		expect(res.status).toBe(204);
		expect(capture.rows[0]!.domain).toBe("newdomain.com");
	});

	it("removing a domain blocks events from it", async () => {
		// Get domain list to find tertiary.com's ID.
		const xhr = { "x-inertia": "true" };
		const detailResp = await app.request(`${BASE}/api/sites/${siteId}`, {
			headers: { ...xhr, cookie: userCookie },
		});
		const detail = await detailResp.json();
		const tertiaryDomain = detail.site.domains.find(
			(d: { domain: string }) => d.domain === "tertiary.com",
		);

		// Remove it.
		await app.request(`${BASE}/api/sites/${siteId}/domains/${tertiaryDomain.id}`, {
			method: "DELETE",
			headers: { ...xhr, cookie: userCookie },
		});

		capture.rows.length = 0;
		const res = await postEvent(
			{ tracking_id: trackingId, type: "pageview", path: "/" },
			"https://tertiary.com",
		);
		expect(res.status).toBe(403);
		expect(capture.rows.length).toBe(0);
	});

	it("resolve-domain endpoint works for all registered domains", async () => {
		for (const domain of ["primary.com", "secondary.com"]) {
			const res = await app.request(
				`${BASE}/api/resolve-domain?site_id=${siteId}&domain=${domain}`,
			);
			expect(res.status).toBe(200);
		}

		const res = await app.request(
			`${BASE}/api/resolve-domain?site_id=${siteId}&domain=unregistered.com`,
		);
		expect(res.status).toBe(403);
	});
});
