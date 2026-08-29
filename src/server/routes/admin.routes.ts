/**
 * Admin routes — user management (create, list, delete, update role).
 * Internal tool: no public registration. Admin creates accounts here.
 * All endpoints require requireRole("admin").
 */
import { Type as t, type Static } from "@sinclair/typebox";
import { Hono } from "hono";
import { hashPassword, requireRole } from "../auth";
import {
	countUsers,
	createUserWithRole,
	deleteUser,
	findUserByEmail,
	findUserById,
	listUsers,
	toPublicUser,
	updateUserRole,
} from "../db";
import type { AppEnv } from "../inertia-middleware";
import type { Paginated, User } from "../../shared/types";
import { validateJson } from "../validation";

const createUserBody = t.Object(
	{
		name: t.String({ minLength: 2, maxLength: 80 }),
		email: t.String({ format: "email" }),
		password: t.String({ minLength: 8, maxLength: 72 }),
		role: t.Union([t.Literal("user"), t.Literal("admin")]),
	},
	{ additionalProperties: false },
);

type CreateUserBody = Static<typeof createUserBody>;

const updateRoleBody = t.Object(
	{
		role: t.Union([t.Literal("user"), t.Literal("admin")]),
	},
	{ additionalProperties: false },
);

export const adminRoutes = () => {
	const app = new Hono<AppEnv>();

	// --- Inertia page ---

	app.get("/admin/users", requireRole("admin"), (c) => {
		const page = Math.max(1, Number(c.req.query("page") ?? 1) || 1);
		const perPage = Math.min(
			100,
			Math.max(1, Number(c.req.query("perPage") ?? 10) || 10),
		);
		const total = countUsers.get()?.n ?? 0;
		const users: Paginated<User> = {
			data: listUsers.all(perPage, (page - 1) * perPage).map(toPublicUser),
			meta: {
				currentPage: page,
				perPage,
				lastPage: Math.max(1, Math.ceil(total / perPage)),
				total,
			},
		};
		return c.var.inertia.render("admin/Users", { users });
	});

	// --- JSON API ---

	app.get("/admin/api/users", requireRole("admin"), (c) => {
		const page = Math.max(1, Number(c.req.query("page") ?? 1) || 1);
		const perPage = Math.min(
			100,
			Math.max(1, Number(c.req.query("perPage") ?? 10) || 10),
		);
		const total = countUsers.get()?.n ?? 0;
		const users: Paginated<User> = {
			data: listUsers.all(perPage, (page - 1) * perPage).map(toPublicUser),
			meta: {
				currentPage: page,
				perPage,
				lastPage: Math.max(1, Math.ceil(total / perPage)),
				total,
			},
		};
		return c.json({ users });
	});

	app.post(
		"/admin/api/users",
		requireRole("admin"),
		validateJson(createUserBody),
		async (c) => {
			const body = c.req.valid("json") as CreateUserBody;

			if (findUserByEmail.get(body.email)) {
				return c.json({ error: "Email already registered" }, 422);
			}

			const passwordHash = await hashPassword(body.password);
			const result = createUserWithRole.get(
				body.name,
				body.email,
				passwordHash,
				body.role,
			);
			if (!result) return c.json({ error: "Failed to create user" }, 500);
			return c.json({ id: result.id });
		},
	);

	app.delete("/admin/api/users/:id", requireRole("admin"), (c) => {
		const id = Number(c.req.param("id"));
		const user = c.var.user!;

		// Cannot delete self.
		if (id === user.id) {
			return c.json({ error: "Cannot delete your own account" }, 422);
		}

		const target = findUserById.get(id);
		if (!target) return c.json({ error: "User not found" }, 404);

		deleteUser.run(id);
		return c.json({ ok: true });
	});

	app.patch(
		"/admin/api/users/:id",
		requireRole("admin"),
		validateJson(updateRoleBody),
		(c) => {
			const id = Number(c.req.param("id"));
			const body = c.req.valid("json") as Static<typeof updateRoleBody>;

			const target = findUserById.get(id);
			if (!target) return c.json({ error: "User not found" }, 404);

			updateUserRole.run(body.role, id);
			return c.json({ ok: true });
		},
	);

	return app;
};
