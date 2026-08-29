/**
 * Admin user management API tests — create, list, delete, update role.
 * Uses in-memory SQLite + app.request().
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";

let app: Awaited<ReturnType<typeof import("../src/server/app")["createApp"]>>;
let userCookie: string;
let adminCookie: string;
let adminId: number;

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
	createUserWithRole.get("Regular", "user@admintest.com", await hashPassword("password123"), "user");
	const adminResult = createUserWithRole.get("Admin", "admin@admintest.com", await hashPassword("password123"), "admin");
	adminId = adminResult.id;

	const xhr = { "x-inertia": "true" };
	const userLogin = await app.request("http://localhost:3000/login", {
		method: "POST",
		headers: { ...xhr, "content-type": "application/json" },
		body: JSON.stringify({ email: "user@admintest.com", password: "password123" }),
	});
	userCookie = (userLogin.headers as Headers & { getSetCookie?: () => string[] })
		.getSetCookie?.().find((c) => c.startsWith("session="))?.split(";")[0] ?? "";

	const adminLogin = await app.request("http://localhost:3000/login", {
		method: "POST",
		headers: { ...xhr, "content-type": "application/json" },
		body: JSON.stringify({ email: "admin@admintest.com", password: "password123" }),
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

describe("admin user management", () => {
	it("blocks non-admin from admin API", async () => {
		const res = await api("/admin/api/users", { cookie: userCookie });
		expect(res.status).toBe(302);
	});

	it("lists users (admin only)", async () => {
		const res = await api("/admin/api/users", { cookie: adminCookie });
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.users.meta.total).toBeGreaterThanOrEqual(2);
		expect(data.users.data.length).toBeGreaterThanOrEqual(2);
	});

	it("creates a new user", async () => {
		const res = await api("/admin/api/users", {
			method: "POST",
			cookie: adminCookie,
			body: {
				name: "New User",
				email: "newuser@admintest.com",
				password: "password123",
				role: "user",
			},
		});
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.id).toBeGreaterThan(0);
	});

	it("rejects duplicate email on create", async () => {
		const res = await api("/admin/api/users", {
			method: "POST",
			cookie: adminCookie,
			body: {
				name: "Dup",
				email: "admin@admintest.com",
				password: "password123",
				role: "user",
			},
		});
		expect(res.status).toBe(422);
	});

	it("updates user role", async () => {
		// Create a user to update.
		const create = await api("/admin/api/users", {
			method: "POST",
			cookie: adminCookie,
			body: {
				name: "To Promote",
				email: "promote@admintest.com",
				password: "password123",
				role: "user",
			},
		});
		const userId = (await create.json()).id;

		const res = await api(`/admin/api/users/${userId}`, {
			method: "PATCH",
			cookie: adminCookie,
			body: { role: "admin" },
		});
		expect(res.status).toBe(200);
	});

	it("prevents admin from deleting self", async () => {
		const res = await api(`/admin/api/users/${adminId}`, {
			method: "DELETE",
			cookie: adminCookie,
		});
		expect(res.status).toBe(422);
		expect((await res.json()).error).toContain("own account");
	});

	it("deletes a user", async () => {
		// Create a user to delete.
		const create = await api("/admin/api/users", {
			method: "POST",
			cookie: adminCookie,
			body: {
				name: "To Delete",
				email: "delete@admintest.com",
				password: "password123",
				role: "user",
			},
		});
		const userId = (await create.json()).id;

		const res = await api(`/admin/api/users/${userId}`, {
			method: "DELETE",
			cookie: adminCookie,
		});
		expect(res.status).toBe(200);
	});

	it("returns 404 for non-existent user on delete", async () => {
		const res = await api("/admin/api/users/99999", {
			method: "DELETE",
			cookie: adminCookie,
		});
		expect(res.status).toBe(404);
	});

	it("returns 404 for non-existent user on role update", async () => {
		const res = await api("/admin/api/users/99999", {
			method: "PATCH",
			cookie: adminCookie,
			body: { role: "admin" },
		});
		expect(res.status).toBe(404);
	});
});
