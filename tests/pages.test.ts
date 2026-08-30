/**
 * Page render + utility endpoint unit tests — Inertia page components,
 * guest/requireAuth middleware, tracker.js, Google OAuth, verify-email.
 * Uses in-memory SQLite + app.request() (same pattern as app.test.ts).
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";

let app: Awaited<ReturnType<typeof import("../src/server/app")["createApp"]>>;
let userCookie: string;
let siteId: number;

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
  createUserWithRole.get("User", "user@test.com", await hashPassword("password123"), "user");

  const xhr = { "x-inertia": "true" };
  const login = await app.request("http://localhost:3000/login", {
    method: "POST",
    headers: { ...xhr, "content-type": "application/json" },
    body: JSON.stringify({ email: "user@test.com", password: "password123" }),
  });
  userCookie = (login.headers as Headers & { getSetCookie?: () => string[] })
    .getSetCookie?.().find((c) => c.startsWith("session="))?.split(";")[0] ?? "";

  // Create a site for the analytics page-render tests.
  const create = await app.request("http://localhost:3000/api/sites", {
    method: "POST",
    headers: { cookie: userCookie, "content-type": "application/json" },
    body: JSON.stringify({
      name: "Test Site",
      timezone: "UTC",
      domains: ["example.com"],
    }),
  });
  siteId = (await create.json()).id;
});

afterAll(async () => {
  const { db } = await import("../src/server/db");
  db.close();
});

const BASE = "http://localhost:3000";
const xhr = { "x-inertia": "true" };

describe("page renders", () => {
  it("renders /sites/new page", async () => {
    const res = await app.request(`${BASE}/sites/new`, {
      headers: { ...xhr, cookie: userCookie },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).component).toBe("SiteNew");
  });

  it("renders /settings/profile page", async () => {
    const res = await app.request(`${BASE}/settings/profile`, {
      headers: { ...xhr, cookie: userCookie },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).component).toBe("Profile");
  });

  it("rejects /sites/new without auth", async () => {
    const res = await app.request(`${BASE}/sites/new`, {
      headers: xhr,
    });
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("renders /login page for guests", async () => {
    const res = await app.request(`${BASE}/login`, { headers: xhr });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.component).toBe("Login");
    expect(typeof data.props.googleEnabled).toBe("boolean");
  });

  it("redirects /login for authenticated users", async () => {
    const res = await app.request(`${BASE}/login`, {
      headers: { cookie: userCookie },
    });
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/sites");
  });

  it("renders /forgot-password page", async () => {
    const res = await app.request(`${BASE}/forgot-password`, {
      headers: xhr,
    });
    expect(res.status).toBe(200);
    expect((await res.json()).component).toBe("ForgotPassword");
  });

  it("renders /reset-password page with query params", async () => {
    const res = await app.request(
      `${BASE}/reset-password?email=test@example.com&token=abc`,
      { headers: xhr },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.component).toBe("ResetPassword");
    expect(data.props.email).toBe("test@example.com");
    expect(data.props.token).toBe("abc");
  });

  it("verify-email redirects with invalid token", async () => {
    const res = await app.request(`${BASE}/verify-email?token=invalid`);
    expect([302, 303]).toContain(res.status);
    expect(res.headers.get("location")).toContain("notice=invalid_verification");
  });

  it("serves tracker.js", async () => {
    const res = await app.request(`${BASE}/tracker.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("javascript");
    const body = await res.text();
    expect(body.length).toBeGreaterThan(0);
    expect(/analytics|tracking/i.test(body)).toBe(true);
  });

  it("Google OAuth returns 400 when not configured", async () => {
    const res = await app.request(`${BASE}/auth/google`);
    expect(res.status).toBe(400);
  });

  it("Google OAuth callback redirects to login on failure", async () => {
    const res = await app.request(
      `${BASE}/auth/google/callback?error=access_denied`,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("notice=google_failed");
  });
});

describe("analytics page renders", () => {
  it("renders analytics overview page", async () => {
    const res = await app.request(`${BASE}/sites/${siteId}/analytics`, {
      headers: { ...xhr, cookie: userCookie },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).component).toBe("Analytics");
  });

  it("renders analytics realtime page", async () => {
    const res = await app.request(
      `${BASE}/sites/${siteId}/analytics/realtime`,
      { headers: { ...xhr, cookie: userCookie } },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).component).toBe("analytics/Realtime");
  });

  it("renders analytics tracking page", async () => {
    const res = await app.request(
      `${BASE}/sites/${siteId}/analytics/tracking`,
      { headers: { ...xhr, cookie: userCookie } },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).component).toBe("analytics/Tracking");
  });

  it("renders 404 for non-existent site analytics", async () => {
    const res = await app.request(`${BASE}/sites/99999/analytics`, {
      headers: { ...xhr, cookie: userCookie },
    });
    expect(res.status).toBe(404);
    expect((await res.json()).component).toBe("NotFound");
  });
});
