/**
 * End-to-end test suite: boots the full app (Hono + bun:sqlite + Inertia)
 * against an in-memory database and drives it via app.request().
 * Run with: bun test --isolate (each file gets fresh globals — the env
 * setup in beforeAll must not leak across files).
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";

let app: Awaited<ReturnType<typeof import("../src/server/app")["createApp"]>>;

beforeAll(async () => {
	// Must be set before any app module is imported (config/db read env at import).
	process.env.DATABASE_PATH = ":memory:";
	process.env.APP_URL = "http://localhost:3000";
	process.env.RATE_LIMIT_AUTH_MAX = "1000";
	// Build dist/ssr.js so the lazy-loaded SSR renderer resolves. The test
	// bypasses src/index.ts (which calls buildClientAssets() in production),
	// so the SSR path would fail with "Cannot find module '../../dist/ssr.js'".
	const { buildClientAssets } = await import("../src/server/assets");
	await buildClientAssets();
	process.env.RATE_LIMIT_GLOBAL_MAX = "10000";
	const { createApp } = await import("../src/server/app");
	app = createApp({ version: "test-version", js: "app.js", css: "app.css" });
});

afterAll(async () => {
	const { db } = await import("../src/server/db");
	db.close();
});

const BASE = "http://localhost:3000";

interface CallOptions {
	method?: string;
	headers?: Record<string, string>;
	body?: Record<string, unknown>;
	cookie?: string;
}

async function call(
	path: string,
	options: CallOptions = {},
): Promise<Response> {
	const headers = new Headers(options.headers);
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

const xhr = { "x-inertia": "true" };

/** Collect every Set-Cookie header (Bun/undici exposes getSetCookie). */
function allSetCookies(res: Response): string[] {
	const headers = res.headers as Headers & { getSetCookie?: () => string[] };
	return typeof headers.getSetCookie === "function"
		? headers.getSetCookie()
		: [res.headers.get("set-cookie") ?? ""].filter(Boolean);
}

function sessionCookie(res: Response): string {
	const cookie = allSetCookies(res).find((c) => c.startsWith("session="));
	return cookie ? cookie.split(";")[0]! : "";
}

async function page(res: Response): Promise<any> {
	return res.json();
}

async function createUser(
	email: string,
	password = "password123",
	name = "Test User",
	role: "user" | "admin" = "user",
): Promise<string> {
	const { hashPassword } = await import("../src/server/auth");
	const { createUserWithRole } = await import("../src/server/db");
	const hash = await hashPassword(password);
	createUserWithRole.get(name, email, hash, role);
	const res = await call("/login", {
		method: "POST",
		headers: xhr,
		body: { email, password },
	});
	expect(res.status).toBe(303);
	const cookie = sessionCookie(res);
	expect(cookie).not.toBe("");
	return cookie;
}

describe("auth basics", () => {
	it("renders / as a public page for guests (CDN-cacheable)", async () => {
		const res = await call("/");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
		expect(res.headers.get("cache-control")).toContain("public");
		expect(res.headers.get("cache-control")).toContain("s-maxage");
	});

	it("rejects wrong password on login", async () => {
		await createUser("wrongpw@example.com");
		const res = await call("/login", {
			method: "POST",
			headers: xhr,
			body: { email: "wrongpw@example.com", password: "nope-nope-123" },
		});
		expect(res.status).toBe(422);
		expect((await page(res)).props.errors.email).toContain("do not match");
	});

	it("logs in and redirects to /sites", async () => {
		await createUser("loginok@example.com");
		const res = await call("/login", {
			method: "POST",
			headers: xhr,
			body: { email: "loginok@example.com", password: "password123" },
		});
		expect(res.status).toBe(303);
		const cookie = sessionCookie(res);
		expect(cookie).not.toBe("");
	});

	it("protects /sites without a session", async () => {
		const res = await call("/sites");
		expect(res.status).toBe(302);
		expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
	});

	it("keeps guest pages off limits for logged-in users", async () => {
		const cookie = await createUser("guestguard@example.com");
		const res = await call("/login", { headers: { cookie } });
		expect(res.status).toBe(302);
		expect(new URL(res.headers.get("location")!).pathname).toBe("/sites");
	});

	it("logs out: session is destroyed server-side", async () => {
		const cookie = await createUser("logout@example.com");
		const res = await call("/logout", {
			method: "POST",
			headers: { ...xhr, cookie },
		});
		expect(res.status).toBe(303);
		expect(new URL(res.headers.get("location")!).pathname).toBe("/login");

		const after = await call("/sites", { headers: { cookie } });
		expect(after.status).toBe(302); // stale cookie no longer authenticates
	});

	it("GET /api/session returns user for authenticated request", async () => {
		const cookie = await createUser("session-api@example.com");
		const res = await call("/api/session", { headers: { cookie } });
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("application/json");
		expect(res.headers.get("cache-control")).toBe("private, no-store");
		const body = await res.json();
		expect(body.user).not.toBeNull();
		expect(body.user.email).toBe("session-api@example.com");
	});

	it("GET /api/session returns null user for guest", async () => {
		const res = await call("/api/session");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.user).toBeNull();
		expect(res.headers.get("cache-control")).toBe("private, no-store");
	});
});

describe("inertia protocol", () => {
	it("returns 409 + X-Inertia-Location on version mismatch", async () => {
		const cookie = await createUser("version@example.com");
		const res = await call("/sites", {
			headers: { ...xhr, cookie, "x-inertia-version": "stale" },
		});
		expect(res.status).toBe(409);
		expect(res.headers.get("x-inertia-location")).toBe(
			"http://localhost:3000/sites",
		);
	});

	it("renders NotFound page payload for unknown routes", async () => {
		const res = await call("/does-not-exist", { headers: xhr });
		expect(res.status).toBe(404);
		expect((await page(res)).component).toBe("NotFound");
	});
	it("returns a valid JSON payload for XHR with gzip accept-encoding", async () => {
		// Browsers always send Accept-Encoding: gzip; the compress middleware
		// must not consume the (small) JSON body below its threshold.
		const res = await call("/login", {
			headers: { ...xhr, "accept-encoding": "gzip" },
		});
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.component).toBe("Login");
		expect(data.url).toBe("/login");
	});

	it("returns plain 404 for .well-known DevTools probes", async () => {
		const res = await call(
			"/.well-known/appspecific/com.chrome.devtools.json",
			{
				headers: xhr,
			},
		);
		expect(res.status).toBe(404);
		const body = await res.text();
		expect(body).toBe("");
	});

	it("serves full SSR HTML with security headers for browsers", async () => {
		const res = await call("/login");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain('data-server-rendered="true"');
		expect(html).toContain("<title");
		expect(res.headers.get("x-content-type-options")).toBe("nosniff");
		expect(res.headers.get("content-security-policy")).toContain(
			"default-src 'self'",
		);
		expect(res.headers.get("x-request-id")).toBeTruthy();
	});
	it("skips SSR for authenticated routes (client-only render)", async () => {
		const cookie = await createUser("nossr@example.com");
		// /dashboard now redirects to /sites — test SSR skip on the redirect target
		const res = await call("/dashboard", { headers: { cookie } });
		expect(res.status).toBe(303);
		expect(new URL(res.headers.get("location")!).pathname).toBe("/sites");
	});

	it("rejects cross-origin unsafe requests", async () => {
		const cookie = await createUser("csrf@example.com");
		const res = await call("/logout", {
			method: "POST",
			headers: { ...xhr, cookie, origin: "https://evil.example" },
		});
		expect(res.status).toBe(403);
	});
});

describe("roles & admin", () => {
	it("blocks non-admins from /admin (redirects to /sites)", async () => {
		const cookie = await createUser("normal@example.com");
		const res = await call("/admin", { headers: { cookie } });
		expect(res.status).toBe(302);
		expect(new URL(res.headers.get("location")!).pathname).toBe("/sites");
	});

	it("admin can access /admin (redirects to /admin/users)", async () => {
		const { createUserWithRole } = await import("../src/server/db");
		const { hashPassword } = await import("../src/server/auth");
		const hash = await hashPassword("password123");
		createUserWithRole.get("Boss", "boss@example.com", hash, "admin");
		const cookie = await createUser("filler@example.com");

		const login = await call("/login", {
			method: "POST",
			headers: xhr,
			body: { email: "boss@example.com", password: "password123" },
		});
		const adminCookie = sessionCookie(login);

		const res = await call("/admin", {
			headers: { cookie: adminCookie },
		});
		expect(res.status).toBe(303);
		expect(new URL(res.headers.get("location")!).pathname).toBe("/admin/users");

		// non-admin cookie is still bounced
		const blocked = await call("/admin", { headers: { cookie } });
		expect(blocked.status).toBe(302);
	});
});

describe("per-site access control", () => {
	async function createSiteViaApi(cookie: string, name: string): Promise<number> {
		const res = await call("/api/sites", {
			method: "POST",
			headers: xhr,
			cookie,
			body: { name, timezone: "UTC", domains: ["example.com"] },
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		return body.id;
	}

	interface ApiSite { id: number; name: string }
	function hasSite(sites: ApiSite[], siteId: number): boolean {
		return sites.some((s) => s.id === siteId)
	}

	async function assignSite(adminCookie: string, userId: number, siteId: number): Promise<void> {
		const res = await call(`/admin/api/users/${userId}/sites/${siteId}`, {
			method: "POST",
			headers: xhr,
			cookie: adminCookie,
		});
		expect(res.status).toBe(200);
	}

	async function login(email: string): Promise<string> {
		const res = await call("/login", {
			method: "POST",
			headers: xhr,
			body: { email, password: "password123" },
		});
		return sessionCookie(res);
	}

	it("creator is auto-assigned to their site", async () => {
		const cookie = await createUser("creator@example.com");
		const siteId = await createSiteViaApi(cookie, "My Site");

		// Creator can see the site in their list
		const res = await call("/api/sites", { headers: xhr, cookie });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(hasSite(body.sites as ApiSite[], siteId)).toBe(true);
	});

	it("user without assignment cannot see site", async () => {
		const ownerCookie = await createUser("owner2@example.com");
		const otherCookie = await createUser("other2@example.com");
		const siteId = await createSiteViaApi(ownerCookie, "Owner Site");

		// Other user should NOT see the site
		const res = await call("/api/sites", { headers: xhr, cookie: otherCookie });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(hasSite(body.sites as ApiSite[], siteId)).toBe(false);

		// Other user gets 404 on site detail
		const detail = await call(`/api/sites/${siteId}`, { headers: xhr, cookie: otherCookie });
		expect(detail.status).toBe(404);

		// Other user gets 404 on analytics page
		const analytics = await call(`/sites/${siteId}/analytics`, { headers: xhr, cookie: otherCookie });
		// Inertia XHR returns 404 page as JSON with 404 status
		expect(analytics.status).toBe(404);
	});

	it("admin can assign site to user and user gains access", async () => {
		const { createUserWithRole } = await import("../src/server/db");
		const { hashPassword } = await import("../src/server/auth");
		const hash = await hashPassword("password123");
		createUserWithRole.get("Admin", "admin-ac@example.com", hash, "admin");

		const ownerCookie = await createUser("owner3@example.com");
		const adminCookie = await login("admin-ac@example.com");
		const siteId = await createSiteViaApi(ownerCookie, "Assign Site");

		// Create a regular user to assign to
		const targetUserId = createUserWithRole.get("Target", "target@example.com", hash, "user")!.id;

		// Before assignment, target cannot see site
		const targetCookie = await login("target@example.com");
		const before = await call("/api/sites", { headers: xhr, cookie: targetCookie });
		const beforeBody = await before.json();
		expect(hasSite(beforeBody.sites as ApiSite[], siteId)).toBe(false);

		// Admin assigns site
		await assignSite(adminCookie, targetUserId, siteId);

		// After assignment, target can see site
		const after = await call("/api/sites", { headers: xhr, cookie: targetCookie });
		const afterBody = await after.json();
		expect(hasSite(afterBody.sites as ApiSite[], siteId)).toBe(true);
	});

	it("admin sees all sites regardless of assignment", async () => {
		const { createUserWithRole } = await import("../src/server/db");
		const { hashPassword } = await import("../src/server/auth");
		const hash = await hashPassword("password123");
		createUserWithRole.get("Admin2", "admin-all@example.com", hash, "admin");

		const ownerCookie = await createUser("owner4@example.com");
		const adminCookie = await login("admin-all@example.com");
		const siteId = await createSiteViaApi(ownerCookie, "Admin View Site");

		const res = await call("/api/sites", { headers: xhr, cookie: adminCookie });
		const body = await res.json();
		expect(hasSite(body.sites as ApiSite[], siteId)).toBe(true);
	});

	it("admin can list all sites for assignment", async () => {
		const { createUserWithRole } = await import("../src/server/db");
		const { hashPassword } = await import("../src/server/auth");
		const hash = await hashPassword("password123");
		createUserWithRole.get("Admin3", "admin-list@example.com", hash, "admin");

		const ownerCookie = await createUser("owner5@example.com");
		await createSiteViaApi(ownerCookie, "List Site");
		const adminCookie = await login("admin-list@example.com");

		const res = await call("/admin/api/sites", { headers: xhr, cookie: adminCookie });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.sites.length).toBeGreaterThan(0);
	});

	it("admin can remove site access from user", async () => {
		const { createUserWithRole } = await import("../src/server/db");
		const { hashPassword } = await import("../src/server/auth");
		const hash = await hashPassword("password123");
		createUserWithRole.get("Admin4", "admin-rm@example.com", hash, "admin");

		const ownerCookie = await createUser("owner6@example.com");
		const adminCookie = await login("admin-rm@example.com");
		const siteId = await createSiteViaApi(ownerCookie, "Remove Site");

		const targetUserId = createUserWithRole.get("Target2", "target2@example.com", hash, "user")!.id;
		await assignSite(adminCookie, targetUserId, siteId);

		const targetCookie = await login("target2@example.com");

		// Verify access granted
		const before = await call("/api/sites", { headers: xhr, cookie: targetCookie });
		const beforeBody = await before.json();
		expect(hasSite(beforeBody.sites as ApiSite[], siteId)).toBe(true);

		// Admin removes access
		const res = await call(`/admin/api/users/${targetUserId}/sites/${siteId}`, {
			method: "DELETE",
			headers: xhr,
			cookie: adminCookie,
		});
		expect(res.status).toBe(200);

		// Verify access removed — need fresh login to get new session
		const targetCookie2 = await login("target2@example.com");
		const after = await call("/api/sites", { headers: xhr, cookie: targetCookie2 });
		const afterBody = await after.json();
		expect(hasSite(afterBody.sites as ApiSite[], siteId)).toBe(false);
	});
});

describe("password reset", () => {
	it("answers identically for known and unknown emails (no enumeration)", async () => {
		await createUser("resetme@example.com");
		const known = await call("/forgot-password", {
			method: "POST",
			headers: xhr,
			body: { email: "resetme@example.com" },
		});
		const unknown = await call("/forgot-password", {
			method: "POST",
			headers: xhr,
			body: { email: "ghost@example.com" },
		});
		expect(known.status).toBe(200);
		expect(unknown.status).toBe(200);
		expect((await page(known)).props.status).toBe("sent");
		expect((await page(unknown)).props.status).toBe("sent");
	});

	it("resets a password end to end (log mail driver)", async () => {
		await createUser("resetflow@example.com");
		const { sentMails } = await import("../src/server/mailer");
		const before = sentMails.length;

		await call("/forgot-password", {
			method: "POST",
			headers: xhr,
			body: { email: "resetflow@example.com" },
		});
		const mail = sentMails[sentMails.length - 1]!;
		expect(sentMails.length).toBe(before + 1);
		expect(mail.subject).toBe("Reset your password");
		expect(mail.to).toBe("resetflow@example.com");

		const token = mail.text.match(/token=([0-9a-f]+)/)![1]!;
		expect(token).toBeTruthy();

		// wrong confirmation is rejected
		const badConfirm = await call("/reset-password", {
			method: "POST",
			headers: xhr,
			body: {
				email: "resetflow@example.com",
				token,
				password: "newpassword123",
				passwordConfirmation: "other",
			},
		});
		expect(badConfirm.status).toBe(422);
		expect((await page(badConfirm)).props.errors.password).toContain(
			"does not match",
		);

		const reset = await call("/reset-password", {
			method: "POST",
			headers: xhr,
			body: {
				email: "resetflow@example.com",
				token,
				password: "newpassword123",
				passwordConfirmation: "newpassword123",
			},
		});
		expect(reset.status).toBe(303);
		expect(
			new URL(reset.headers.get("location")!).searchParams.get("notice"),
		).toBe("password_reset");

		// old password no longer works, new one does
		const oldPw = await call("/login", {
			method: "POST",
			headers: xhr,
			body: { email: "resetflow@example.com", password: "password123" },
		});
		expect(oldPw.status).toBe(422);
		const newPw = await call("/login", {
			method: "POST",
			headers: xhr,
			body: { email: "resetflow@example.com", password: "newpassword123" },
		});
		expect(newPw.status).toBe(303);
	});

	it("rejects expired/invalid reset tokens", async () => {
		const res = await call("/reset-password", {
			method: "POST",
			headers: xhr,
			body: {
				email: "resetflow@example.com",
				token: "f".repeat(64),
				password: "newpassword123",
				passwordConfirmation: "newpassword123",
			},
		});
		expect(res.status).toBe(422);
		expect((await page(res)).props.errors.token).toContain(
			"invalid or has expired",
		);
	});
});

describe("infrastructure", () => {
	it("reports health", async () => {
		const res = await call("/health");
		expect(res.status).toBe(200);
		expect((await res.json()).status).toBe("ok");
	});

	it("serves /metrics from loopback when METRICS_TOKEN is unset", async () => {
		const res = await call("/metrics");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/plain");
	});

	it("rejects /metrics without a Bearer token when METRICS_TOKEN is set", async () => {
		const { config } = await import("../src/server/config");
		const saved = config.metricsToken;
		config.metricsToken = "secret-metrics-token";
		try {
			const res = await call("/metrics");
			expect(res.status).toBe(401);
		} finally {
			config.metricsToken = saved;
		}
	});

	it("rejects /metrics with a wrong Bearer token", async () => {
		const { config } = await import("../src/server/config");
		const saved = config.metricsToken;
		config.metricsToken = "secret-metrics-token";
		try {
			const res = await call("/metrics", {
				headers: { authorization: "Bearer wrong-token" },
			});
			expect(res.status).toBe(401);
		} finally {
			config.metricsToken = saved;
		}
	});

	it("serves /metrics with the correct Bearer token", async () => {
		const { config } = await import("../src/server/config");
		const saved = config.metricsToken;
		config.metricsToken = "secret-metrics-token";
		try {
			const res = await call("/metrics", {
				headers: { authorization: "Bearer secret-metrics-token" },
			});
			expect(res.status).toBe(200);
			expect(await res.text()).toContain("http_requests_total");
		} finally {
			config.metricsToken = saved;
		}
	});

	it("serves built asset files from /assets/*", async () => {
		const { mkdirSync, rmSync, writeFileSync } = await import("node:fs");
		mkdirSync("dist/assets", { recursive: true });
		const file = "dist/assets/__route_test__.css";
		writeFileSync(file, "body{}");
		try {
			const res = await call("/assets/__route_test__.css");
			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toBe("text/css; charset=utf-8");
			expect(await res.text()).toBe("body{}");
		} finally {
			rmSync(file, { force: true });
		}
	});

	it("returns 400 when Google OAuth is not configured", async () => {
		const { config } = await import("../src/server/config");
		const savedId = config.google.clientId;
		const savedSecret = config.google.clientSecret;
		config.google.clientId = null;
		config.google.clientSecret = null;
		try {
			const res = await call("/auth/google");
			expect(res.status).toBe(400);
		} finally {
			config.google.clientId = savedId;
			config.google.clientSecret = savedSecret;
		}
	});

	it("redirects to Google when OAuth is configured", async () => {
		const { config } = await import("../src/server/config");
		const savedId = config.google.clientId;
		const savedSecret = config.google.clientSecret;
		config.google.clientId = "test-client-id";
		config.google.clientSecret = "test-client-secret";
		try {
			const res = await call("/auth/google");
			expect(res.status).toBe(302);
			expect(res.headers.get("location")).toContain("accounts.google.com");
		} finally {
			config.google.clientId = savedId;
			config.google.clientSecret = savedSecret;
		}
	});
});
