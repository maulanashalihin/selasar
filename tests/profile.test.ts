/**
 * Profile routes unit tests — page render, profile info update, password
 * change, and avatar upload (multipart/form-data). Uses in-memory SQLite +
 * app.request() (same pattern as app.test.ts / sites.test.ts).
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";

let app: Awaited<ReturnType<typeof import("../src/server/app")["createApp"]>>;
let userCookie: string;

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

/** Minimal 1x1 PNG (valid, decodable by Bun.image). */
const pngBytes = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
  ),
  (c) => c.charCodeAt(0),
);

describe("profile routes", () => {
  it("rejects unauthenticated profile access", async () => {
    const res = await app.request(`${BASE}/profile`, { headers: xhr });
    expect(res.status).toBe(302);
  });

  it("renders profile page", async () => {
    const res = await app.request(`${BASE}/profile`, {
      headers: { ...xhr, cookie: userCookie },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.component).toBe("Profile");
  });

  it("updates profile info", async () => {
    const res = await app.request(`${BASE}/profile`, {
      method: "PATCH",
      headers: { ...xhr, cookie: userCookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "New Name", email: "user@test.com" }),
    });
    // Inertia redirect-after-write → 303 (or 302).
    expect([302, 303]).toContain(res.status);
    expect(res.headers.get("location")).toBeTruthy();
  });

  it("rejects name too short", async () => {
    const res = await app.request(`${BASE}/profile`, {
      method: "PATCH",
      headers: { ...xhr, cookie: userCookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "A", email: "user@test.com" }),
    });
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.props.errors.name).toBeTruthy();
  });

  it("rejects invalid email", async () => {
    const res = await app.request(`${BASE}/profile`, {
      method: "PATCH",
      headers: { ...xhr, cookie: userCookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "Test User", email: "not-an-email" }),
    });
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.props.errors.email).toBeTruthy();
  });

  it("rejects email taken by another user", async () => {
    // Create a second user with a distinct email.
    const { hashPassword } = await import("../src/server/auth");
    const { createUserWithRole } = await import("../src/server/db");
    createUserWithRole.get("Other", "other@test.com", await hashPassword("password123"), "user");

    const res = await app.request(`${BASE}/profile`, {
      method: "PATCH",
      headers: { ...xhr, cookie: userCookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "New Name", email: "other@test.com" }),
    });
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.props.errors.email).toBeTruthy();
  });

  it("changes password with correct current", async () => {
    const res = await app.request(`${BASE}/profile/password`, {
      method: "POST",
      headers: { ...xhr, cookie: userCookie, "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: "password123",
        password: "newpass456",
        passwordConfirmation: "newpass456",
      }),
    });
    expect([302, 303]).toContain(res.status);
    expect(res.headers.get("location")).toBeTruthy();
  });

  it("rejects wrong current password", async () => {
    const res = await app.request(`${BASE}/profile/password`, {
      method: "POST",
      headers: { ...xhr, cookie: userCookie, "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: "wrong",
        password: "newpass456",
        passwordConfirmation: "newpass456",
      }),
    });
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.props.errors.currentPassword).toBeTruthy();
  });

  it("rejects password confirmation mismatch", async () => {
    const res = await app.request(`${BASE}/profile/password`, {
      method: "POST",
      headers: { ...xhr, cookie: userCookie, "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: "newpass456",
        password: "newpass456",
        passwordConfirmation: "different",
      }),
    });
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.props.errors.password).toBeTruthy();
  });

  it("rejects short new password", async () => {
    const res = await app.request(`${BASE}/profile/password`, {
      method: "POST",
      headers: { ...xhr, cookie: userCookie, "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: "newpass456",
        password: "short",
        passwordConfirmation: "short",
      }),
    });
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.props.errors.password).toBeTruthy();
  });

  it("uploads avatar successfully", async () => {
    const formData = new FormData();
    formData.append("avatar", new Blob([pngBytes], { type: "image/png" }));

    const res = await app.request(`${BASE}/profile/avatar`, {
      method: "POST",
      headers: { cookie: userCookie },
      body: formData,
    });
    expect(res.status).toBe(204);

    // Verify the user's avatarUrl was updated.
    const session = await app.request(`${BASE}/api/session`, {
      headers: { cookie: userCookie },
    });
    const sessionData = await session.json();
    expect(sessionData.user.avatarUrl).toMatch(/^\/uploads\//);
  });

  it("rejects non-image file", async () => {
    const formData = new FormData();
    formData.append("avatar", new Blob([new TextEncoder().encode("not an image")], { type: "text/plain" }));

    const res = await app.request(`${BASE}/profile/avatar`, {
      method: "POST",
      headers: { cookie: userCookie },
      body: formData,
    });
    expect(res.status).toBe(422);
  });

  it("rejects missing file", async () => {
    const formData = new FormData();

    const res = await app.request(`${BASE}/profile/avatar`, {
      method: "POST",
      headers: { cookie: userCookie },
      body: formData,
    });
    expect(res.status).toBe(422);
  });
});
