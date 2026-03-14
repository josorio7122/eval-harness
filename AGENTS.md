# mini-skills — Eval Harness

TypeScript monorepo (Turbo + pnpm) for running LLM-based evaluations.

## Commands

All checks run through pnpm scripts. **Always use these commands** — never run `tsc`, `eslint`, or `prettier` directly.

| Task             | Command                        | Notes                                             |
| ---------------- | ------------------------------ | ------------------------------------------------- |
| Typecheck        | `pnpm run typecheck`           | Runs `tsc --noEmit` across all packages via Turbo |
| Lint             | `pnpm run lint`                | Runs ESLint across all packages via Turbo         |
| Format           | `pnpm run format`              | Runs Prettier on all `.ts`, `.tsx`, `.md` files   |
| Test all         | `pnpm run test`                | Runs Vitest across all packages via Turbo         |
| Test one package | `pnpm --filter <pkg> run test` | e.g. `pnpm --filter api run test`                 |
| Dev              | `pnpm run dev`                 | Starts API + web concurrently                     |
| Build            | `pnpm run build`               | Builds all packages                               |

## Pre-commit checks

Before every commit, run **all three** in this order:

```bash
pnpm run typecheck
pnpm run lint
pnpm run format
```

Fix any errors or warnings before committing. Zero warnings policy — treat warnings as errors.

## Running the app

**Never start services with `pnpm --filter` or direct commands.** Always use root-level scripts or Docker.

| Task | Command | Notes |
| ---- | ------- | ----- |
| Start dev (API + web) | `pnpm run dev` | Runs both from root via Turbo |
| Start DB | `docker compose up -d` | PostgreSQL 17 in Docker |
| Push schema | `pnpm --filter db exec prisma db push` | Syncs schema to DB |
| Seed data | `./test-data/seed.sh` | Seeds demo data via Docker |
| Reset DB | `docker compose down -v && docker compose up -d` | Wipes volumes and restarts |

**Rules:**
- Always start the dev server from the **root** with `pnpm run dev` — never `cd` into a package and run it individually
- Database always runs in Docker — never install PostgreSQL on the host
- Use `docker exec eval-harness-db psql ...` for direct DB access

## Project structure

```
apps/api/          — Hono REST API (datasets, graders, experiments)
apps/web/          — React 19 + Vite frontend (shadcn/ui, TanStack Query)
packages/db/       — Prisma schema + migrations
packages/shared/   — Result type, tryCatch utility
test-data/         — Seed script + sample CSV for manual testing
```

## Architecture

- **API layers**: validator → repository → service → router (see global AGENTS.md for patterns)
- **Result pattern**: All repo/service methods return `Result<T>`. Errors propagate via `tryCatch`.
- **Dataset versioning**: Every mutation creates a new `DatasetRevision`. Experiments pin to a specific revision.
- **Frontend**: Uses Base UI (not Radix) for primitives via shadcn/ui v4.
