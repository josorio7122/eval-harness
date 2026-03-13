# Eval Harness

A lightweight evaluation harness for running LLM graders against test datasets. Build datasets of test cases, define grading rubrics, run experiments, and review results in a dense, scannable interface.

## What it does

- Create datasets with custom attributes (input, expected_output, plus any custom fields)
- Define graders with natural-language rubrics for LLM-based evaluation
- Run experiments that evaluate every test case against selected graders
- Review results in a dense table — rows are items, columns are graders, cells show pass/fail verdicts
- Dataset versioning via immutable revisions — experiments pin to a snapshot, so results are reproducible

## Tech Stack

| Layer | Tech |
|-------|------|
| Monorepo | Turborepo + pnpm |
| Backend | Hono + Node.js |
| Database | PostgreSQL 17 + Prisma ORM |
| Frontend | React 19 + Vite |
| UI | shadcn/ui + Tailwind CSS |
| State | TanStack Query |
| LLM | Vercel AI SDK + OpenRouter |
| Validation | Zod |
| Testing | Vitest |

## Project Structure

```
├── apps/
│   ├── api/          # Hono REST API
│   └── web/          # React + Vite frontend
├── packages/
│   ├── db/           # Prisma schema + migrations
│   ├── shared/       # Result<T> type utilities
│   ├── eslint-config/
│   └── typescript-config/
├── docs/             # Spec, architecture, requirements
└── scripts/          # E2E smoke tests
```

## Getting Started

Prerequisites: Node.js 18+, pnpm 9+, Docker

```bash
# 1. Install dependencies
pnpm install

# 2. Start PostgreSQL
docker compose up -d

# 3. Set up environment
cp .env.example .env
# Edit .env with your OPENROUTER_API_KEY

# 4. Run database migrations
pnpm --filter @eval-harness/db exec prisma migrate dev

# 5. Start development servers
pnpm dev
```

API runs on http://localhost:3001, frontend on http://localhost:5173

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start API + web in dev mode |
| `pnpm build` | Build all packages |
| `pnpm test` | Run unit tests |
| `pnpm test:integration` | Run integration tests (needs DB) |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm format` | Format with Prettier |

## Documentation

- [Architecture](docs/architecture.md) — data model, backend layers, frontend structure
- [Specification](docs/spec.md) — detailed behavior spec
- [Implementation](docs/implementation.md) — API contracts and data model details
- [Requirements](docs/requirements.md) — problem statement

## What I'd Improve

**Queue system** — Replace the in-process p-queue with a proper job queue (BullMQ + Redis or SQS). The current promise-based queue loses jobs on server restart and can't distribute work across multiple API instances.

**Revision storage** — The current system copies all items into every new revision. At scale (10k+ items), this creates significant storage overhead and slow writes. A log-based approach (similar to Braintrust's transaction log) would store only deltas — each mutation is an append-only log entry, and the current state is reconstructed by replaying the log. This gives you versioning, diffs, and efficient storage.

**Results storage** — Move experiment results to ClickHouse (or a similar columnar store). PostgreSQL works fine for thousands of results, but evaluation platforms can generate millions of rows. ClickHouse handles analytical queries (aggregations, filtering by verdict, time-range scans) orders of magnitude faster than row-oriented databases.

**Prompt management & playground** — Expand the platform to include prompt versioning and an interactive playground. Users would create prompt templates, pair them with datasets, and generate experiments directly — comparing actual LLM output against expected output. This closes the loop: instead of evaluating external outputs, the platform becomes the place where you iterate on prompts, run them, and evaluate results in one workflow.

**Diff between revisions** — Show what changed between two dataset revisions (added/removed/modified items, schema changes). Currently revisions are append-only with no comparison view.

**Evaluation model comparison** — Run the same experiment with different LLM judges to measure grader consistency. Show agreement rates and highlight cases where judges disagree.

**Batch operations** — Support bulk item editing (paste from spreadsheet), bulk delete, and bulk re-evaluation of failed cells.

**Webhook notifications** — Notify external systems (Slack, CI/CD) when experiments complete or pass rates drop below a threshold.

## License

MIT
