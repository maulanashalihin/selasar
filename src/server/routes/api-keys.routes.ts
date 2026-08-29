/**
 * API key management routes — Inertia page + JSON API.
 * Users create/revoke their own API keys for programmatic analytics access.
 */
import { Type as t, type Static } from "@sinclair/typebox";
import { Hono } from "hono";
import { requireAuth } from "../auth";
import { createApiKey, listApiKeysByUser, revokeApiKey } from "../db";
import type { AppEnv } from "../inertia-middleware";
import { validateJson } from "../validation";

const createKeyBody = t.Object(
	{
		label: t.String({ minLength: 1, maxLength: 100 }),
	},
	{ additionalProperties: false },
);

export const apiKeyRoutes = () => {
	const app = new Hono<AppEnv>();

	// Inertia page
	app.get("/settings/keys", requireAuth, (c) => {
		const keys = listApiKeysByUser.all(c.var.user!.id).map((k) => ({
			id: k.id,
			label: k.label,
			createdAt: k.createdAt,
			lastUsedAt: k.lastUsedAt,
		}));
		return c.var.inertia.render("ApiKeys", { apiKeys: keys });
	});

	// Create key — returns plaintext key ONCE
	app.post("/api/keys", requireAuth, validateJson(createKeyBody), async (c) => {
		const body = c.req.valid("json") as Static<typeof createKeyBody>;

		const raw = `ga_${crypto.randomUUID().replace(/-/g, "")}`;
		const hash = await crypto.subtle.digest(
			"SHA-256",
			new TextEncoder().encode(raw),
		);
		const keyHash = Array.from(new Uint8Array(hash))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");

		const { id } = createApiKey.get(c.var.user!.id, keyHash, body.label)!;

		return c.json({ id, key: raw, label: body.label });
	});

	// Revoke key
	app.delete("/api/keys/:id", requireAuth, (c) => {
		const id = Number(c.req.param("id"));
		revokeApiKey.run(id, c.var.user!.id);
		return c.json({ ok: true });
	});

	return app;
};
