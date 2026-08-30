/**
 * API key management unit tests — key creation, listing, revocation.
 * Uses in-memory SQLite + app.request() (same pattern as sites.test.ts).
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";

let app: Awaited<ReturnType<typeof import("../src/server/app")["createApp"]>>;
let userCookie: string;

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
});

afterAll(async () => {
  const { db } = await import("../src/server/db");
  db.close();
});

const BASE = "http://localhost:3000";
const xhr = { "x-inertia": "true" };

// Revoke all existing keys so count-sensitive tests start from a clean slate.
async function revokeAllKeys(): Promise<void> {
  const res = await app.request(`${BASE}/settings/keys`, {
    headers: { ...xhr, cookie: userCookie },
  });
  const data = await res.json();
  for (const k of data.props.apiKeys) {
    await app.request(`${BASE}/api/keys/${k.id}`, {
      method: "DELETE",
      headers: { cookie: userCookie },
    });
  }
}

describe("API keys", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await app.request(`${BASE}/settings/keys`, {
      headers: { ...xhr },
    });
    expect(res.status).toBe(302);
  });

  it("rejects unauthenticated key creation", async () => {
    const res = await app.request(`${BASE}/api/keys`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "Test key" }),
    });
    expect(res.status).toBe(302);
  });

  it("renders API keys page", async () => {
    const res = await app.request(`${BASE}/settings/keys`, {
      headers: { ...xhr, cookie: userCookie },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.component).toBe("ApiKeys");
    expect(Array.isArray(data.props.apiKeys)).toBe(true);
  });

  it("creates a new API key", async () => {
    const res = await app.request(`${BASE}/api/keys`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: userCookie },
      body: JSON.stringify({ label: "Test key" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.id).toBe("number");
    expect(typeof data.key).toBe("string");
    expect(data.key.startsWith("ga_")).toBe(true);
    expect(data.label).toBe("Test key");
  });

  it("rejects missing label", async () => {
    const res = await app.request(`${BASE}/api/keys`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: userCookie },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
  });

  it("rejects empty label", async () => {
    const res = await app.request(`${BASE}/api/keys`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: userCookie },
      body: JSON.stringify({ label: "" }),
    });
    expect(res.status).toBe(422);
  });

  it("lists created keys", async () => {
    await revokeAllKeys();
    await app.request(`${BASE}/api/keys`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: userCookie },
      body: JSON.stringify({ label: "Listed key" }),
    });

    const res = await app.request(`${BASE}/settings/keys`, {
      headers: { ...xhr, cookie: userCookie },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.props.apiKeys).toHaveLength(1);
    expect(data.props.apiKeys[0].label).toBe("Listed key");
  });

  it("revokes a key", async () => {
    await revokeAllKeys();
    const create = await app.request(`${BASE}/api/keys`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: userCookie },
      body: JSON.stringify({ label: "Revoke me" }),
    });
    const created = await create.json();

    const del = await app.request(`${BASE}/api/keys/${created.id}`, {
      method: "DELETE",
      headers: { cookie: userCookie },
    });
    expect(del.status).toBe(200);
    const delData = await del.json();
    expect(delData).toEqual({ ok: true });

    const list = await app.request(`${BASE}/settings/keys`, {
      headers: { ...xhr, cookie: userCookie },
    });
    const listData = await list.json();
    expect(listData.props.apiKeys).toHaveLength(0);
  });

  it("revoking non-existent key returns ok", async () => {
    const res = await app.request(`${BASE}/api/keys/99999`, {
      method: "DELETE",
      headers: { cookie: userCookie },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true });
  });
});
