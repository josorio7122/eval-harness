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
