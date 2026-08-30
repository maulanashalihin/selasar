/**
 * Uploads (tus protocol) unit tests — /uploads endpoints.
 * Uses in-memory SQLite + app.request() (same pattern as app.test.ts).
 * The tus-storage module writes real files to ./data/uploads on disk.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";

let app: Awaited<ReturnType<typeof import("../src/server/app")["createApp"]>>;
let userCookie: string;
let user2Cookie: string;

beforeAll(async () => {
  process.env.DATABASE_PATH = ":memory:";
  process.env.APP_URL = "http://localhost:3000";
  process.env.RATE_LIMIT_AUTH_MAX = "1000";
  process.env.RATE_LIMIT_GLOBAL_MAX = "10000";
  process.env.UPLOAD_DIR = "./data/uploads";
  const { buildClientAssets } = await import("../src/server/assets");
  await buildClientAssets();
  const { createApp } = await import("../src/server/app");
  app = createApp({ version: "test-version", js: "app.js", css: "app.css" });

  const { hashPassword } = await import("../src/server/auth");
  const { createUserWithRole } = await import("../src/server/db");
  createUserWithRole.get("User", "user@test.com", await hashPassword("password123"), "user");
  createUserWithRole.get("User2", "user2@test.com", await hashPassword("password123"), "user");

  const xhr = { "x-inertia": "true" };
  const login = await app.request("http://localhost:3000/login", {
    method: "POST",
    headers: { ...xhr, "content-type": "application/json" },
    body: JSON.stringify({ email: "user@test.com", password: "password123" }),
  });
  userCookie = (login.headers as Headers & { getSetCookie?: () => string[] })
    .getSetCookie?.().find((c) => c.startsWith("session="))?.split(";")[0] ?? "";

  const login2 = await app.request("http://localhost:3000/login", {
    method: "POST",
    headers: { ...xhr, "content-type": "application/json" },
    body: JSON.stringify({ email: "user2@test.com", password: "password123" }),
  });
  user2Cookie = (login2.headers as Headers & { getSetCookie?: () => string[] })
    .getSetCookie?.().find((c) => c.startsWith("session="))?.split(";")[0] ?? "";
});

afterAll(async () => {
  const { db } = await import("../src/server/db");
  db.close();
});

const BASE = "http://localhost:3000";
const TUS = "1.0.0";

/** Create an upload as the given user; return the upload id from Location. */
async function createUpload(cookie: string, length: number): Promise<string> {
  const res = await app.request(`${BASE}/uploads`, {
    method: "POST",
    headers: {
      "Tus-Resumable": TUS,
      "Upload-Length": String(length),
      cookie,
    },
  });
  expect(res.status).toBe(201);
  const location = res.headers.get("location") ?? "";
  expect(location.startsWith("/uploads/")).toBe(true);
  return location.slice("/uploads/".length);
}

describe("uploads (tus protocol)", () => {
  it("OPTIONS returns tus capabilities", async () => {
    const res = await app.request(`${BASE}/uploads`, { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("Tus-Resumable")).toBe(TUS);
    expect(res.headers.get("Tus-Version")).toBeTruthy();
  });

  it("POST rejects missing Tus-Resumable", async () => {
    const res = await app.request(`${BASE}/uploads`, {
      method: "POST",
      headers: { "Upload-Length": "100", cookie: userCookie },
    });
    expect(res.status).toBe(412);
  });

  it("POST rejects unauthenticated", async () => {
    const res = await app.request(`${BASE}/uploads`, {
      method: "POST",
      headers: { "Tus-Resumable": TUS, "Upload-Length": "100" },
    });
    expect(res.status).toBe(401);
  });

  it("POST creates upload", async () => {
    const res = await app.request(`${BASE}/uploads`, {
      method: "POST",
      headers: {
        "Tus-Resumable": TUS,
        "Upload-Length": "100",
        cookie: userCookie,
      },
    });
    expect(res.status).toBe(201);
    const location = res.headers.get("location") ?? "";
    expect(location.startsWith("/uploads/")).toBe(true);
    expect(res.headers.get("Upload-Offset")).toBe("0");
  });

  it("POST rejects missing Upload-Length", async () => {
    const res = await app.request(`${BASE}/uploads`, {
      method: "POST",
      headers: { "Tus-Resumable": TUS, cookie: userCookie },
    });
    expect(res.status).toBe(400);
  });

  it("HEAD returns upload offset", async () => {
    const id = await createUpload(userCookie, 100);
    const res = await app.request(`${BASE}/uploads/${id}`, {
      method: "HEAD",
      headers: { "Tus-Resumable": TUS, cookie: userCookie },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Upload-Offset")).toBe("0");
    expect(res.headers.get("Upload-Length")).toBe("100");
  });

  it("HEAD rejects wrong user", async () => {
    const id = await createUpload(userCookie, 100);
    const res = await app.request(`${BASE}/uploads/${id}`, {
      method: "HEAD",
      headers: { "Tus-Resumable": TUS, cookie: user2Cookie },
    });
    expect(res.status).toBe(404);
  });

  it("PATCH appends bytes", async () => {
    const id = await createUpload(userCookie, 10);
    const patch = await app.request(`${BASE}/uploads/${id}`, {
      method: "PATCH",
      headers: {
        "Tus-Resumable": TUS,
        "Content-Type": "application/offset+octet-stream",
        "Upload-Offset": "0",
        cookie: userCookie,
      },
      body: new Uint8Array([1, 2, 3, 4, 5]),
    });
    expect(patch.status).toBe(204);
    expect(patch.headers.get("Upload-Offset")).toBe("5");

    const head = await app.request(`${BASE}/uploads/${id}`, {
      method: "HEAD",
      headers: { "Tus-Resumable": TUS, cookie: userCookie },
    });
    expect(head.status).toBe(200);
    expect(head.headers.get("Upload-Offset")).toBe("5");
  });

  it("PATCH rejects wrong Content-Type", async () => {
    const id = await createUpload(userCookie, 10);
    const res = await app.request(`${BASE}/uploads/${id}`, {
      method: "PATCH",
      headers: {
        "Tus-Resumable": TUS,
        "Content-Type": "text/plain",
        "Upload-Offset": "0",
        cookie: userCookie,
      },
      body: "hello",
    });
    expect(res.status).toBe(415);
  });

  it("PATCH rejects offset mismatch", async () => {
    const id = await createUpload(userCookie, 10);
    const res = await app.request(`${BASE}/uploads/${id}`, {
      method: "PATCH",
      headers: {
        "Tus-Resumable": TUS,
        "Content-Type": "application/offset+octet-stream",
        "Upload-Offset": "99",
        cookie: userCookie,
      },
      body: new Uint8Array([1, 2, 3]),
    });
    expect(res.status).toBe(409);
  });

  it("PATCH rejects chunk exceeding length", async () => {
    const id = await createUpload(userCookie, 5);
    const res = await app.request(`${BASE}/uploads/${id}`, {
      method: "PATCH",
      headers: {
        "Tus-Resumable": TUS,
        "Content-Type": "application/offset+octet-stream",
        "Upload-Offset": "0",
        cookie: userCookie,
      },
      body: new Uint8Array(10),
    });
    expect(res.status).toBe(413);
  });

  it("DELETE removes upload", async () => {
    const id = await createUpload(userCookie, 10);
    const del = await app.request(`${BASE}/uploads/${id}`, {
      method: "DELETE",
      headers: { "Tus-Resumable": TUS, cookie: userCookie },
    });
    expect(del.status).toBe(204);

    const head = await app.request(`${BASE}/uploads/${id}`, {
      method: "HEAD",
      headers: { "Tus-Resumable": TUS, cookie: userCookie },
    });
    expect(head.status).toBe(404);
  });

  it("GET serves stored bytes", async () => {
    const id = await createUpload(userCookie, 5);
    await app.request(`${BASE}/uploads/${id}`, {
      method: "PATCH",
      headers: {
        "Tus-Resumable": TUS,
        "Content-Type": "application/offset+octet-stream",
        "Upload-Offset": "0",
        cookie: userCookie,
      },
      body: new Uint8Array([72, 101, 108, 108, 111]),
    });
    const res = await app.request(`${BASE}/uploads/${id}`, { method: "GET" });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toBe("Hello");
  });

  it("X-HTTP-Method-Override: DELETE", async () => {
    const id = await createUpload(userCookie, 10);
    const res = await app.request(`${BASE}/uploads/${id}`, {
      method: "POST",
      headers: {
        "Tus-Resumable": TUS,
        "X-HTTP-Method-Override": "DELETE",
        cookie: userCookie,
      },
    });
    expect(res.status).toBe(204);

    const head = await app.request(`${BASE}/uploads/${id}`, {
      method: "HEAD",
      headers: { "Tus-Resumable": TUS, cookie: userCookie },
    });
    expect(head.status).toBe(404);
  });

  it("rejects method not allowed", async () => {
    const id = await createUpload(userCookie, 10);
    const res = await app.request(`${BASE}/uploads/${id}`, {
      method: "POST",
      headers: {
        "Tus-Resumable": TUS,
        "X-HTTP-Method-Override": "PUT",
        cookie: userCookie,
      },
    });
    expect(res.status).toBe(405);
  });
});
