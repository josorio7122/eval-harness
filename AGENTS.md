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

| Task                  | Command                                          | Notes                               |
| --------------------- | ------------------------------------------------ | ----------------------------------- |
| Start dev (API + web) | `pnpm run dev`                                   | Runs both from root via Turbo       |
| Start DB              | `docker compose up -d`                           | PostgreSQL 17 in Docker             |
| Push schema           | `pnpm --filter db exec prisma migrate dev`       | Creates migration + applies locally |
| Seed data             | `./test-data/seed.sh`                            | Seeds demo data via Docker          |
| Reset DB              | `docker compose down -v && docker compose up -d` | Wipes volumes and restarts          |

**Rules:**

- Always start the dev server from the **root** with `pnpm run dev` — never `cd` into a package and run it individually
- Database always runs in Docker — never install PostgreSQL on the host
- Use `docker exec eval-harness-db psql ...` for direct DB access
- **Never use `prisma db push`** in production or CI — always use `prisma migrate dev` (local) or `prisma migrate deploy` (production/CI). `db push` has no migration history, can silently drop data, and is not idempotent.

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

## Code rules

### Functions with 3+ parameters must use an object parameter

Any function (or method) with **3 or more parameters** must accept a single object instead of positional args. This improves readability at call sites and makes parameter order irrelevant.

```typescript
// ❌ Wrong — positional args are ambiguous at call sites
function createExperiment(name: string, datasetId: string, graderId: string) { ... }

// ✅ Right — object param with named fields
function createExperiment(params: { name: string; datasetId: string; graderId: string }) { ... }
```

### Minimize type casting — avoid `as` unless absolutely necessary

Never use `as unknown as T` or `as T` to silence the compiler. If a cast is needed, it means the types are wrong — fix the types instead. The only acceptable uses of `as` are:

- `as const` for literal inference
- Narrowing after a runtime type guard when TypeScript can't infer it
- Third-party library gaps where no `@types` fix exists (add a `// CAST:` comment explaining why)

```typescript
// ❌ Wrong
const data = result as unknown as MyType

// ✅ Right — fix the generic or return type so no cast is needed
const data: MyType = await fetchTypedResult()
```

### Prisma queries: prefer `select` over `include`

Always use `select` to explicitly pick the fields you need. Never use `include` to pull in entire relations — it over-fetches and couples code to the full model shape.

```typescript
// ❌ Wrong — fetches all fields + entire relation
const dataset = await prisma.dataset.findUnique({
  where: { id },
  include: { revisions: true },
})

// ✅ Right — fetches only what's needed
const dataset = await prisma.dataset.findUnique({
  where: { id },
  select: {
    id: true,
    name: true,
    revisions: {
      select: { id: true, version: true },
    },
  },
})
```

Exception: when you genuinely need every field on the model and all fields on the relation (rare). In that case, add a `// SELECT-EXCEPTION:` comment explaining why `include` is justified.

### TDD — Non-Negotiable

Every feature, fix, and refactor follows this exact sequence. No exceptions.

1. **Write the failing test** — define the expected behavior in a test before touching implementation files. Tests are derived from `docs/spec.md` — the spec is the source of truth for what to test.
2. **Run it to confirm it fails** — you MUST see the red output before proceeding. Paste or summarize the failure output to prove it ran.
3. **Write the minimum code to make it pass** — no speculative logic, no extras
4. **Run tests to confirm they pass** — green before moving on. Paste or summarize the passing output.
5. **Commit** — test + implementation together

**The red-green proof is mandatory.** When dispatching executors:

- Write tests first (derived from spec)
- Run them and show they fail (red)
- Write implementation
- Run them and show they pass (green)
- Never combine "write tests + write implementation + run once" — that is not TDD, it's test-after

**Integration tests** live in `apps/api/src/__tests__/integration/` and run via:

```bash
pnpm --filter api exec vitest run --config vitest.integration.config.ts <test-file>
```

The default `pnpm run test` excludes integration tests (they need a running DB). Always run them explicitly.

### API Smoke Tests — Non-Negotiable

The project has `docs/test.yml` documenting every API endpoint with curl commands. Every new or modified endpoint MUST be verified with actual curl commands against a running server.

1. **Write the curl tests in `test.yml` first** — before implementation, define the endpoints, expected status codes, and expected response shapes
2. **Run them to confirm they fail** — start the server (`pnpm run dev`), execute the curls. They should return 404 or wrong responses.
3. **Implement the API**
4. **Run them again to confirm they pass** — every curl must return the expected status code and response shape
5. **Never skip this step** — integration tests against Hono's test client are not a substitute for actual HTTP verification. Curl tests catch wiring issues (routes not mounted, middleware not applied, serialization) that unit tests miss.

**Rules:**

- The executor must start the server, run curls, and show the output
- "I wrote the tests and they pass" without actual curl output is not acceptable
- If the server can't start (e.g., missing DB), document why and run the curls as soon as the blocker is resolved
