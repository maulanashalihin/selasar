# Contributing to Selasar

Thanks for your interest in contributing! Selasar is a self-hosted web analytics platform built with Hono + Bun + Svelte 5 + Inertia v3 + ClickHouse.

## Quick Start

```bash
git clone https://github.com/maulanashalihin/selasar.git
cd selasar
bun install
clickhouse server --daemon
cp .env.example .env
bun run ch:init
bun run db:seed
bun run scripts/seed-clickhouse.ts
bun run dev
```

Open `http://localhost:4000` and login with `demo@example.com` / `password123`.

## Prerequisites

- **Bun >= 1.3** — runtime, bundler, test runner
- **ClickHouse** — analytics engine (local or remote)
- **Node 20+** — only if using the browser tooling

## Development Workflow

```bash
bun run dev          # dev server with auto-reload
bun run dev:css      # tailwind watch (separate terminal)
bun run typecheck    # svelte-check (must pass)
bun run lint         # biome lint (must pass)
bun run test         # bun test --isolate (must pass)
bun run build        # bun.build client assets
```

### Before You Commit

1. `bun run typecheck` — 0 errors
2. `bun run lint` — 0 errors
3. `bun run test` — all tests pass
4. `bun run build` — assets build successfully

A pre-commit hook checks for LLM Wiki files with missing slugs. If you use the wiki tools, ensure all pages have valid kebab-case slugs.

## Architecture Guidelines

Read [AGENTS.md](./AGENTS.md) before writing, moving, or restructuring code. It documents:

- **Route conventions** — one file per URL namespace in `src/server/routes/`
- **Flat server layout** — no feature subfolders except `routes/`
- **All SQL in `db.ts`** — prepared statements at module load
- **Env read once in `config.ts`** — never read `process.env` elsewhere
- **TypeBox validation** at the route level
- **TypeScript strict** — `noUncheckedIndexedAccess` + `verbatimModuleSyntax`
- **Tailwind utility classes** in components — no component CSS in `styles.css`
- **Design system** — reuse tokens from `styles.css` / `tailwind.css`

## Testing

- Run `bun run test` (NOT bare `bun test`) — each suite needs process isolation (`--isolate`).
- New test files must set env (`DATABASE_PATH=:memory:`, `UPLOAD_DIR`, ...) in `beforeAll` BEFORE importing the app module.
- Mock ClickHouse via `mock.module("../src/server/clickhouse", ...)` — it's not available in CI.
- Test behavior, not implementation details: status codes, response shapes, side effects.

## Pull Request Process

1. Fork the repo and create a branch from `main`.
2. Write tests for new features or bug fixes.
3. Ensure all checks pass (typecheck, lint, test, build).
4. Keep changes minimal and conventional — match existing style.
5. Use [conventional commit messages](https://www.conventionalcommits.org/):
   - `feat:` new feature
   - `fix:` bug fix
   - `docs:` documentation only
   - `refactor:` code change that neither fixes a bug nor adds a feature
   - `test:` adding or correcting tests
   - `chore:` tooling, deps, config
6. Reference issues in the PR description (e.g., "Fixes #123").

## Code Style

- 2-space indent, double quotes, semicolons
- Biome handles linting (recommended rules + `noNonNullAssertion: off`)
- Svelte components: Svelte 5 runes (`$state`, `$derived`, `$props`, `$effect`)
- No ORM — parameterized SQL queries via `bun:sqlite`
- No `any` — use TypeBox schemas for validation and shared types

## Reporting Bugs

Use the GitHub issue tracker. Include:

- Selasar version (or commit hash)
- Bun version
- ClickHouse version
- Steps to reproduce
- Expected vs actual behavior
- Console output / screenshots if applicable

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
