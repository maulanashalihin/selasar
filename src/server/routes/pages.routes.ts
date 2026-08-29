/**
 * Page routes: the Inertia app-shell pages (/, /dashboard → /sites, /admin → /admin/users).
 * Feature pages get their own `<feature>.routes.ts` — see AGENTS.md
 * "Route conventions".
 *
 * `/` is a **public, CDN-cacheable** page: rendered with `{ public: true }`
 * so the HTML contains no user-specific data. Cloudflare caches the
 * response (s-maxage=300, SWR=600). The client fetches user identity via
 * `GET /api/session` after hydration.
 *
 * GA Analytics: /dashboard and /admin are legacy Dulak routes that now
 * redirect to their new locations (/sites and /admin/users respectively).
 */
import { Hono } from "hono";
import { requireAuth, requireRole } from "../auth";
import { cacheablePublic } from "../cache";
import type { AppEnv } from "../inertia-middleware";

export const pageRoutes = () => {
	const app = new Hono<AppEnv>();

	// Public landing page — CDN-cacheable (5 min TTL, 10 min SWR).
	app.use("/", cacheablePublic(300, 600));
	app.get("/", (c) =>
		c.var.inertia.render("Home", {}, { public: true }),
	);

	// Legacy Dulak routes → redirect to GA Analytics routes.
	app.get("/dashboard", requireAuth, (c) =>
		c.var.inertia.redirect("/sites"),
	);
	app.get("/admin", requireRole("admin"), (c) =>
		c.var.inertia.redirect("/admin/users"),
	);

	// Profile moved to /settings/profile (grouped with API keys).
	app.get("/settings/profile", requireAuth, (c) =>
		c.var.inertia.render("Profile", {}),
	);

	return app;
};
