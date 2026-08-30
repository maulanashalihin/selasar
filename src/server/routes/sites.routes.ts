/**
 * Site management routes — Inertia pages + JSON API.
 * Internal tool: all authenticated users see all sites.
 */
import { Type as t, type Static } from "@sinclair/typebox";
import { Hono } from "hono";
import { requireAuth } from "../auth";
import { config } from "../config";
import { chQuery } from "../clickhouse";
import {
	addDomain,
	createSite,
	deleteSite,
	findSiteById,
	findSiteByTrackingId,
	isDomainRegistered,
	listDomains,
	listSites,
	removeDomain,
	setPrimaryDomain,
	updateSite,
} from "../db";
import type { AppEnv } from "../inertia-middleware";
import { validateJson } from "../validation";

const createSiteBody = t.Object(
	{
		name: t.String({ minLength: 1, maxLength: 100 }),
		timezone: t.String({ minLength: 1, maxLength: 50 }),
		domains: t.Array(t.String({ minLength: 1, maxLength: 255 }), {
			maxItems: 20,
		}),
	},
	{ additionalProperties: false },
);

type CreateSiteBody = Static<typeof createSiteBody>;

const updateSiteBody = t.Object(
	{
		name: t.String({ minLength: 1, maxLength: 100 }),
		timezone: t.String({ minLength: 1, maxLength: 50 }),
		auto_accept_domains: t.Integer({ minimum: 0, maximum: 1 }),
	},
	{ additionalProperties: false },
);

const addDomainBody = t.Object(
	{ domain: t.String({ minLength: 1, maxLength: 255 }) },
	{ additionalProperties: false },
);

const setPrimaryBody = t.Object(
	{ domain: t.String({ minLength: 1, maxLength: 255 }) },
	{ additionalProperties: false },
);

/** Normalize a domain: lowercase, strip protocol/www/trailing slash. */
function normalizeDomain(raw: string): string {
	return raw
		.toLowerCase()
		.replace(/^https?:\/\//, "")
		.replace(/^www\./, "")
		.replace(/\/+$/, "")
		.trim();
}

/** Generate a public tracking_id (RFC 4122 v4 UUID). */
function generateTrackingId(): string {
	return crypto.randomUUID();
}

/** Serialize a site + its domains for the client. */
function siteWithDomains(siteId: number) {
	const site = findSiteById.get(siteId);
	if (!site) return null;
	const domains = listDomains.all(siteId);
	return { ...site, domains };
}

export const siteRoutes = () => {
	const app = new Hono<AppEnv>();

	// --- Inertia pages ---

	app.get("/sites", requireAuth, (c) => {
		const sites = listSites.all();
		return c.var.inertia.render("Sites", { sites });
	});

	app.get("/sites/new", requireAuth, (c) => {
		return c.var.inertia.render("SiteNew", {});
	});

	app.get("/sites/:id", requireAuth, (c) => {
		const id = Number(c.req.param("id"));
		const site = siteWithDomains(id);
		if (!site) return c.var.inertia.render("NotFound", {}, { status: 404 });
		return c.var.inertia.render("SiteSettings", { site, appUrl: config.appUrl });
	});

	app.get("/sites/:id/analytics", requireAuth, (c) => {
		const id = Number(c.req.param("id"));
		const site = findSiteById.get(id);
		if (!site) return c.var.inertia.render("NotFound", {}, { status: 404 });
		return c.var.inertia.render("Analytics", { site, appUrl: config.appUrl });
	});

	// --- JSON API ---

	app.get("/api/sites", requireAuth, (c) => {
		const sites = listSites.all();
		return c.json({ sites });
	});

	app.post("/api/sites", requireAuth, validateJson(createSiteBody), (c) => {
		const body = c.req.valid("json") as CreateSiteBody;
		const user = c.var.user!;
		const trackingId = generateTrackingId();

		const result = createSite.get(user.id, body.name, trackingId, body.timezone);
		if (!result) return c.json({ error: "Failed to create site" }, 500);
		const siteId = result.id;

		// Add domains — first domain becomes primary.
		const domains = body.domains.map(normalizeDomain).filter(Boolean);
		for (const domain of domains) {
			addDomain.get(siteId, domain);
		}
		if (domains.length > 0) {
			setPrimaryDomain.get(domains[0]!, siteId);
		}
		return c.json({ id: siteId, trackingId });
	});

	app.get("/api/sites/:id", requireAuth, (c) => {
		const id = Number(c.req.param("id"));
		const site = siteWithDomains(id);
		if (!site) return c.json({ error: "Site not found" }, 404);
		return c.json({ site });
	});

	app.patch(
		"/api/sites/:id",
		requireAuth,
		validateJson(updateSiteBody),
		(c) => {
			const id = Number(c.req.param("id"));
			const body = c.req.valid("json") as Static<typeof updateSiteBody>;
			updateSite.run(body.name, body.timezone, body.auto_accept_domains, id);
			return c.json({ ok: true });
		},
	);

	app.delete("/api/sites/:id", requireAuth, async (c) => {
		const id = Number(c.req.param("id"));
		deleteSite.run(id);
		// Clean up ClickHouse events for this site.
		try {
			await chQuery(`ALTER TABLE events DELETE WHERE site_id = ${id}`);
		} catch (err) {
			console.error("[sites] ClickHouse cleanup failed:", err);
		}
		return c.json({ ok: true });
	});

	app.post(
		"/api/sites/:id/domains",
		requireAuth,
		validateJson(addDomainBody),
		(c) => {
			const id = Number(c.req.param("id"));
			const domain = normalizeDomain(c.req.valid("json").domain);
			if (!domain) return c.json({ error: "Invalid domain" }, 422);
			try {
				addDomain.get(id, domain);
			} catch {
				return c.json({ error: "Domain already exists" }, 422);
			}
			return c.json({ ok: true });
		},
	);

	app.delete("/api/sites/:id/domains/:domainId", requireAuth, (c) => {
		const siteId = Number(c.req.param("id"));
		const domainId = Number(c.req.param("domainId"));
		removeDomain.run(domainId, siteId);
		return c.json({ ok: true });
	});

	app.patch(
		"/api/sites/:id/primary-domain",
		requireAuth,
		validateJson(setPrimaryBody),
		(c) => {
			const id = Number(c.req.param("id"));
			const domain = normalizeDomain(c.req.valid("json").domain);
			setPrimaryDomain.get(domain, id);
			return c.json({ ok: true });
		},
	);


	// --- Resolve endpoints (for CF Pages Function ingestion) ---

	app.get("/api/resolve", (c) => {
		const trackingId = c.req.query("tracking_id");
		if (!trackingId) return c.json({ error: "tracking_id required" }, 400);
		const site = findSiteByTrackingId.get(trackingId);
		if (!site) return c.json({ error: "Invalid tracking_id" }, 404);
		return c.json({ id: site.id, autoAcceptDomains: Number(site.autoAcceptDomains) === 1 });
	});

	app.get("/api/resolve-domain", (c) => {
		const siteId = Number(c.req.query("site_id"));
		const domain = normalizeDomain(c.req.query("domain") ?? "");
		if (!siteId || !domain) return c.json({ error: "site_id and domain required" }, 400);
		const result = isDomainRegistered.get(siteId, domain);
		if (!result) return c.json({ error: "Domain not registered" }, 403);
		return c.json({ ok: true });
	});

	return app;
};
