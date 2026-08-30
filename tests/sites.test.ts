/**
 * Sites API unit tests — site CRUD, domain management, primary domain.
 * Uses in-memory SQLite + app.request() (same pattern as app.test.ts).
 */
import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";

const chQueryCalls: string[] = [];
let chQueryThrows = false;
mock.module("../src/server/clickhouse", () => ({
	chQuery: async (sql: string) => {
		if (chQueryThrows) throw new Error("ClickHouse unavailable");
		chQueryCalls.push(sql);
		return [];
	},
	chInsert: async () => {},
	chPing: async () => true,
}));

let app: Awaited<ReturnType<typeof import("../src/server/app")["createApp"]>>;
let userCookie: string;
let adminCookie: string;

beforeAll(async () => {
	process.env.DATABASE_PATH = ":memory:";
	process.env.APP_URL = "http://localhost:3000";
	process.env.RATE_LIMIT_AUTH_MAX = "1000";
	process.env.RATE_LIMIT_GLOBAL_MAX = "10000";
	const { buildClientAssets } = await import("../src/server/assets");
	await buildClientAssets();
	const { createApp } = await import("../src/server/app");
	app = createApp({ version: "test-version", js: "app.js", css: "app.css" });

	// Create a regular user + admin via DB, then login.
	const { hashPassword } = await import("../src/server/auth");
	const { createUserWithRole } = await import("../src/server/db");
	createUserWithRole.get("Test User", "user@test.com", await hashPassword("password123"), "user");
	createUserWithRole.get("Admin", "admin@test.com", await hashPassword("password123"), "admin");

	const xhr = { "x-inertia": "true" };
	const userLogin = await app.request("http://localhost:3000/login", {
		method: "POST",
		headers: { ...xhr, "content-type": "application/json" },
		body: JSON.stringify({ email: "user@test.com", password: "password123" }),
	});
	userCookie = (userLogin.headers as Headers & { getSetCookie?: () => string[] })
		.getSetCookie?.().find((c) => c.startsWith("session="))?.split(";")[0] ?? "";

	const adminLogin = await app.request("http://localhost:3000/login", {
		method: "POST",
		headers: { ...xhr, "content-type": "application/json" },
		body: JSON.stringify({ email: "admin@test.com", password: "password123" }),
	});
	adminCookie = (adminLogin.headers as Headers & { getSetCookie?: () => string[] })
		.getSetCookie?.().find((c) => c.startsWith("session="))?.split(";")[0] ?? "";
});

afterAll(async () => {
	const { db } = await import("../src/server/db");
	db.close();
});

const BASE = "http://localhost:3000";
const xhr = { "x-inertia": "true" };

async function api(
	path: string,
	options: { method?: string; body?: Record<string, unknown>; cookie?: string } = {},
): Promise<Response> {
	const headers = new Headers({ ...xhr });
	if (options.cookie) headers.set("cookie", options.cookie);
	let body: string | undefined;
	if (options.body) {
		headers.set("content-type", "application/json");
		body = JSON.stringify(options.body);
	}
	return app.request(`${BASE}${path}`, {
		method: options.method ?? "GET",
		headers,
		body,
	});
}

describe("sites API", () => {
	it("rejects unauthenticated requests", async () => {
		const res = await api("/api/sites");
		expect(res.status).toBe(302);
	});

	it("creates a site with domains (first = primary)", async () => {
		const res = await api("/api/sites", {
			method: "POST",
			cookie: userCookie,
			body: {
				name: "Test Site",
				timezone: "UTC",
				domains: ["example.com", "example.co.id"],
			},
		});
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.id).toBeGreaterThan(0);
		expect(data.trackingId).toMatch(/^[0-9a-f-]{36}$/);
	});

	it("lists all sites (any authenticated user)", async () => {
		const res = await api("/api/sites", { cookie: userCookie });
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.sites.length).toBeGreaterThanOrEqual(1);
		expect(data.sites[0].name).toBe("Test Site");
		expect(data.sites[0].primaryDomain).toBe("example.com");
	});

	it("gets site detail with domains", async () => {
		const list = await (await api("/api/sites", { cookie: userCookie })).json();
		const siteId = list.sites[0].id;

		const res = await api(`/api/sites/${siteId}`, { cookie: userCookie });
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.site.name).toBe("Test Site");
		expect(data.site.domains.length).toBe(2);
		expect(data.site.domains[0].domain).toBe("example.com");
	});

	it("updates site name and timezone", async () => {
		const list = await (await api("/api/sites", { cookie: userCookie })).json();
		const siteId = list.sites[0].id;

		const res = await api(`/api/sites/${siteId}`, {
			method: "PATCH",
			cookie: userCookie,
			body: { name: "Updated Site", timezone: "Asia/Jakarta", auto_accept_domains: 0 },
		});
		expect(res.status).toBe(200);

		const detail = await (await api(`/api/sites/${siteId}`, { cookie: userCookie })).json();
		expect(detail.site.name).toBe("Updated Site");
		expect(detail.site.timezone).toBe("Asia/Jakarta");
	});

	it("adds a domain", async () => {
		const list = await (await api("/api/sites", { cookie: userCookie })).json();
		const siteId = list.sites[0].id;

		const res = await api(`/api/sites/${siteId}/domains`, {
			method: "POST",
			cookie: userCookie,
			body: { domain: "example.io" },
		});
		expect(res.status).toBe(200);

		const detail = await (await api(`/api/sites/${siteId}`, { cookie: userCookie })).json();
		expect(detail.site.domains.some((d: any) => d.domain === "example.io")).toBe(true);
	});

	it("rejects duplicate domain", async () => {
		const list = await (await api("/api/sites", { cookie: userCookie })).json();
		const siteId = list.sites[0].id;

		const res = await api(`/api/sites/${siteId}/domains`, {
			method: "POST",
			cookie: userCookie,
			body: { domain: "example.com" },
		});
		expect(res.status).toBe(422);
	});

	it("normalizes domain (strip https://, www., trailing /)", async () => {
		const list = await (await api("/api/sites", { cookie: userCookie })).json();
		const siteId = list.sites[0].id;

		const res = await api(`/api/sites/${siteId}/domains`, {
			method: "POST",
			cookie: userCookie,
			body: { domain: "https://www.normalized.com/" },
		});
		expect(res.status).toBe(200);

		const detail = await (await api(`/api/sites/${siteId}`, { cookie: userCookie })).json();
		expect(detail.site.domains.some((d: any) => d.domain === "normalized.com")).toBe(true);
	});

	it("sets primary domain", async () => {
		const list = await (await api("/api/sites", { cookie: userCookie })).json();
		const siteId = list.sites[0].id;

		const res = await api(`/api/sites/${siteId}/primary-domain`, {
			method: "PATCH",
			cookie: userCookie,
			body: { domain: "example.co.id" },
		});
		expect(res.status).toBe(200);

		const detail = await (await api(`/api/sites/${siteId}`, { cookie: userCookie })).json();
		expect(detail.site.primaryDomain).toBe("example.co.id");
	});

	it("removes a domain", async () => {
		const list = await (await api("/api/sites", { cookie: userCookie })).json();
		const siteId = list.sites[0].id;
		const detail = await (await api(`/api/sites/${siteId}`, { cookie: userCookie })).json();
		const domainId = detail.site.domains.find((d: any) => d.domain === "example.io").id;

		const res = await api(`/api/sites/${siteId}/domains/${domainId}`, {
			method: "DELETE",
			cookie: userCookie,
		});
		expect(res.status).toBe(200);

		const after = await (await api(`/api/sites/${siteId}`, { cookie: userCookie })).json();
		expect(after.site.domains.some((d: any) => d.domain === "example.io")).toBe(false);
	});

	it("deletes a site (cascade)", async () => {
		// Create a second site to delete.
		const create = await api("/api/sites", {
			method: "POST",
			cookie: userCookie,
			body: { name: "Delete Me", timezone: "UTC", domains: ["deleteme.com"] },
		});
		const siteId = (await create.json()).id;

		const res = await api(`/api/sites/${siteId}`, {
			method: "DELETE",
			cookie: userCookie,
		});
		expect(res.status).toBe(200);

		const detail = await api(`/api/sites/${siteId}`, { cookie: userCookie });
		expect(detail.status).toBe(404);
	});

	it("admin can access all sites (not just own)", async () => {
		// Admin didn't create any sites, but should see user's sites.
		const res = await api("/api/sites", { cookie: adminCookie });
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.sites.length).toBeGreaterThanOrEqual(1);
	});
});

describe("sites API — ClickHouse cleanup on delete", () => {
	it("site delete triggers ClickHouse cleanup", async () => {
		const create = await api("/api/sites", {
			method: "POST",
			cookie: userCookie,
			body: { name: "CH Cleanup Site", timezone: "UTC", domains: ["ch-cleanup.com"] },
		});
		const siteId = (await create.json()).id;

		chQueryCalls.length = 0;
		const res = await api(`/api/sites/${siteId}`, {
			method: "DELETE",
			cookie: userCookie,
		});
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.ok).toBe(true);
		expect(
			chQueryCalls.some(
				(sql) =>
					sql.includes("ALTER TABLE events DELETE") &&
					sql.includes(`site_id = ${siteId}`),
			),
		).toBe(true);
	});

	it("site delete succeeds even if ClickHouse cleanup fails", async () => {
		chQueryThrows = true;
		try {
			const create = await api("/api/sites", {
				method: "POST",
				cookie: userCookie,
				body: { name: "CH Fail Site", timezone: "UTC", domains: ["ch-fail.com"] },
			});
			const siteId = (await create.json()).id;

			const res = await api(`/api/sites/${siteId}`, {
				method: "DELETE",
				cookie: userCookie,
			});
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.ok).toBe(true);
		} finally {
			chQueryThrows = false;
		}
	});
});

describe("sites API — auto_accept_domains toggle", () => {
	it("updates auto_accept_domains via PATCH", async () => {
		const create = await api("/api/sites", {
			method: "POST",
			cookie: userCookie,
			body: { name: "Auto Accept Site", timezone: "UTC", domains: ["auto-accept.com"] },
		});
		const siteId = (await create.json()).id;

		const res = await api(`/api/sites/${siteId}`, {
			method: "PATCH",
			cookie: userCookie,
			body: { name: "Auto Accept Site", timezone: "UTC", auto_accept_domains: 1 },
		});
		expect(res.status).toBe(200);

		const detail = await (await api(`/api/sites/${siteId}`, { cookie: userCookie })).json();
		expect(Number(detail.site.autoAcceptDomains)).toBe(1);
	});

	it("auto_accept_domains defaults to false", async () => {
		const create = await api("/api/sites", {
			method: "POST",
			cookie: userCookie,
			body: { name: "Default Toggle Site", timezone: "UTC", domains: ["default-toggle.com"] },
		});
		const siteId = (await create.json()).id;

		const detail = await (await api(`/api/sites/${siteId}`, { cookie: userCookie })).json();
		expect(Number(detail.site.autoAcceptDomains)).toBe(0);
	});
});
