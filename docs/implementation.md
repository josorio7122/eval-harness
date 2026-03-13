# Implementation Details

## Data Model

### Overview

This document defines the entity model for the lightweight eval harness. Data is persisted in PostgreSQL (latest version, running via Docker). All IDs are UUIDs, generated server-side.

---

### Entities

#### 1. `Dataset`

A named collection of structured test cases with a fixed schema.

```ts
type Dataset = {
  id: uuid                    // System-generated
  name: string                // User-provided. Non-empty, unique across all datasets
  attributes: string[]        // Managed. Ordered list of attribute names; always starts with ["input", "expected_output"]
}
```

**Constraints:**
- `name` must be non-empty
- `name` must be unique across all datasets
- `attributes` always contains at least `["input", "expected_output"]` from the moment of creation
- `"input"` and `"expected_output"` cannot be removed from `attributes`
- All attribute names are stored lowercase — `"Input"` and `"input"` are the same
- Attribute names must be unique within the dataset
- Attribute names must be non-empty
- Attributes are ordered: built-ins first (`"input"`, `"expected_output"`), then custom in insertion order. Order is immutable
- A `Dataset` with zero items does not appear as selectable when creating an `Experiment`
- Renaming preserves all items and attributes
- Storage: PostgreSQL (latest, via Docker)

**Relationships:**
- Has many `DatasetItem`s (one-to-many, cascade delete)
- Referenced by many `Experiment`s. On deletion, all referencing experiments and their results are cascade-deleted. User must confirm if experiments exist

---

#### 2. `DatasetItem`

A single row in a dataset. Always conforms to the dataset's current schema.

```ts
type DatasetItem = {
  id: uuid                    // System-generated
  datasetId: uuid             // Reference to owning Dataset
  values: Record<string, string>
  // Keys are exactly the current attribute names of the owning dataset's attributes.
  // Values are always strings; missing attributes default to empty string "".
}
```

**Constraints:**
- `values` must contain exactly the keys present in the owning dataset's `schema` — no more, no fewer (ItemSchemaConformance)
- All values are strings
- `"input"` and `"expected_output"` keys are always present
- When an attribute is added to the schema, all existing items gain that key with value `""`
- When an attribute is removed from the schema, all existing items drop that key
- Items appear in creation order

**Relationships:**
- Belongs to exactly one `Dataset` (many-to-one)
- Cascade-deleted when its owning `Dataset` is deleted

---

#### 3. `Grader`

An evaluation criterion. Holds the rubric given to the LLM judge.

```ts
type Grader = {
  id: uuid                    // System-generated
  name: string                // User-provided. Non-empty, unique across all graders
  description: string         // User-provided. May be empty string, never null
  rubric: string              // User-provided. Non-empty. The full judging instruction for the LLM
}
```

**Constraints:**
- `name` must be non-empty
- `name` must be unique across all graders
- `rubric` must be non-empty
- `description` defaults to `""`, never `null`
- No enforced length limit on `rubric`

**Relationships:**
- Referenced by many `Experiment`s (many-to-many via `graderIds`)
- On deletion, all referencing experiments and their results are cascade-deleted. User must confirm if experiments exist

---

#### 4. `Experiment`

Ties a dataset and one or more graders together. Tracks run status and owns all result cells.

```ts
type ExperimentStatus = "queued" | "running" | "complete" | "failed"

type Experiment = {
  id: uuid                    // System-generated
  name: string                // User-provided. Non-empty; derived from original on re-run
  datasetId: uuid             // User-selected. Reference to owning Dataset (live reference, not snapshot)
  graderIds: uuid[]           // User-selected. List of Grader IDs; at least one required
  status: ExperimentStatus    // System-managed. Starts as "queued" on creation
}
```

**Statuses:**
- `"queued"` — created, waiting for another experiment to finish running
- `"running"` — actively evaluating cells
- `"complete"` — all cells evaluated (some may be in error state)
- `"failed"` — run could not complete or all cells failed

**Constraints:**
- `name` must be non-empty
- `datasetId` must reference an existing `Dataset` with at least one item at run time
- `graderIds` must contain at least one entry; no upper bound
- `status` starts as `"queued"` on creation
- At most one experiment may be `"running"` at a time; others queue
- Dataset is referenced live — not snapshotted
- Re-running creates a new `Experiment` with a new `id` and derived `name`; original is preserved
- No timestamps stored

**Relationships:**
- References one `Dataset` (many-to-one)
- References one or more `Grader`s (many-to-many via `graderIds[]`)
- Has many `ExperimentResult`s (one-to-many, cascade delete)
- Cascade-deleted when its referenced `Dataset` is deleted
- Cascade-deleted when any of its referenced `Grader`s is deleted

---

#### 5. `ExperimentResult`

One verdict for a single dataset item × grader pair within an experiment.

```ts
type Verdict = "pass" | "fail" | "error"

type ExperimentResult = {
  id: uuid                    // System-generated
  experimentId: uuid          // Owning experiment
  datasetItemId: uuid         // The dataset item that was evaluated
  graderId: uuid              // The grader used for this evaluation
  verdict: Verdict            // "pass", "fail", or "error"
  reason: string              // Explanation from the LLM judge; may be empty on "error"
}
```

**Verdict values:**
- `"pass"` — LLM judge determined the item meets the rubric criteria
- `"fail"` — LLM judge determined the item does not meet the rubric criteria
- `"error"` — The evaluation call failed; no verdict was produced

**Constraints:**
- The combination `(experimentId, datasetItemId, graderId)` is unique — exactly one cell per item × grader per experiment
- `verdict` is always one of the three literal values; never null
- `reason` is a string; empty string `""` is acceptable on error
- Error cells are stored, not discarded
- CSV export represents error cells as the literal string `"error"`

**Relationships:**
- Belongs to exactly one `Experiment` (many-to-one, cascade delete)
- References one `DatasetItem` and one `Grader` by ID (informational — cascade flows through `Experiment`, not directly)

---

### Relationship Diagram

```
Dataset ──< DatasetItem            (one-to-many, cascade delete)
Dataset ──< Experiment             (one-to-many via datasetId, cascade delete)

Grader  ──< Experiment             (many-to-many via graderIds[], cascade delete on grader deletion)

Experiment ──< ExperimentResult (one-to-many, cascade delete)
ExperimentResult >── DatasetItem (many-to-one, reference only)
ExperimentResult >── Grader      (many-to-one, reference only)
```

---

### Cascade Delete Rules

| Entity deleted | Also deletes |
|---|---|
| `Dataset` | All its `DatasetItem`s, all `Experiment`s referencing it, all `ExperimentResult`s of those experiments |
| `Grader` | All `Experiment`s referencing it in `graderIds`, all `ExperimentResult`s of those experiments |
| `Experiment` | All its `ExperimentResult`s |
| `DatasetItem` | Nothing — item deletion is isolated within the dataset |
| Attribute removal (from `Dataset.attributes`) | Drops the corresponding key from all `DatasetItem.values`; no experiments or cells deleted |

---

### System-Generated vs. User-Provided Fields

| Entity | System-generated | User-provided |
|---|---|---|
| `Dataset` | `id` | `name` |
| `DatasetItem` | `id` | `values` |
| `Grader` | `id` | `name`, `description`, `rubric` |
| `Experiment` | `id`, `status` | `name`, `datasetId`, `graderIds` |
| `ExperimentResult` | `id`, `verdict`, `reason` | *(none — fully system-produced)* |

---

### Key Invariants

1. **Schema conformance:** For every `DatasetItem` in a `Dataset`, the keys of `item.values` equal exactly the entries in `dataset.attributes`
2. **Built-in immutability:** No operation may remove `"input"` or `"expected_output"` from any dataset's schema
3. **Name uniqueness:** Dataset names are unique across all datasets. Grader names are unique across all graders. Attribute names are unique within a dataset's schema
4. **Non-empty selection:** A dataset with zero items is never available for experiment creation
5. **Concurrency limit:** At most two experiments may have `status === "running"` at any time
6. **Cell uniqueness:** Within an experiment, `(datasetItemId, graderId)` uniquely identifies exactly one cell
7. **Attribute order stability:** The order of entries in `dataset.attributes` is immutable after insertion. `"input"` and `"expected_output"` are always first

---

## Tech Stack

### Monorepo

- **Turborepo** — build orchestration and caching
- **pnpm** workspaces — package management
- **Structure:**
  ```
  apps/
    api/          # Hono API server
    web/          # Vite + React frontend
  packages/
    db/           # Prisma client, migrations, generated types
    shared/       # Shared types (Result, Zod schemas, etc.)
  ```

### Backend (`apps/api`)

- **Hono** — HTTP framework
- **Prisma** — ORM with PostgreSQL
- **Zod** — request/response validation
- **PostgreSQL** (latest, via Docker)

**Module pattern — every domain follows this structure:**
```
datasets/
  router.ts       # Hono route definitions (CRUD endpoints)
  service.ts      # Business logic, orchestration, returns Result<T>
  repository.ts   # Prisma database operations
  validator.ts    # Zod schemas for request validation
```

```
graders/
  router.ts
  service.ts
  repository.ts
  validator.ts
```

```
experiments/
  router.ts       # CRUD + POST /:id/run + GET /:id/events (SSE)
  service.ts      # Owns experiment queue, evaluation queue, LLM orchestration, SSE event emission
  repository.ts   # Experiment + ExperimentResult persistence
  validator.ts    # Zod schemas for create, run, etc.
```

All three modules follow the same pattern. The experiments module has additional responsibilities (queue management, SSE streaming) but they live inside `service.ts` — the route/repository/validator boundaries stay clean.

### Frontend (`apps/web`)

- **Vite** — build tool
- **React** — UI framework
- **shadcn/ui** — component library (CLI-first: `pnpm dlx shadcn@latest init`)
- **Tailwind CSS v4** — styling
- **Zod** — client-side validation
- **TanStack Query** — server state management (queries, mutations, cache)
- **TanStack Table** — data tables (results, datasets, graders)
- **TanStack Form** — form state management
- **Tremor** — charts and aggregate stats visualization (pass rates, bar charts)
- **Lucide React** — icon library (consistent, MIT licensed, pairs with shadcn/ui)
- **Motion** — animation library (formerly Framer Motion, use when needed for transitions and micro-interactions)

### Shared Packages (`packages/`)

- **`packages/db`** — Prisma schema, migrations, generated client. Both API and (if needed) seed scripts import from here
- **`packages/shared`** — Shared TypeScript types:
  - `Result<T, E>` type
  - Zod schemas used by both API validation and frontend form validation
  - Entity types derived from Prisma (re-exported without Prisma internals)
  - API contract types (request/response shapes)

---

## Architecture Guardrails

### TypeScript Strictness

- **No `any` type anywhere.** ESLint rule `@typescript-eslint/no-explicit-any` set to `error`
- **Prefer type inference** — do not annotate return types on functions unless the inferred type is wrong or ambiguous. Let TypeScript infer. ESLint rule `@typescript-eslint/explicit-function-return-type` is OFF
- **Strict mode enabled** in all `tsconfig.json` files (`strict: true`)

### Result Pattern

All service functions return `Result<T>` instead of throwing exceptions. Errors are values, not side effects.

```ts
// packages/shared/src/result.ts
export type Result<T, E = string> =
  | { success: true; data: T }
  | { success: false; error: E }

export const ok = <T>(data: T): Result<T, never> => ({ success: true, data })
export const fail = <E = string>(error: E): Result<never, E> => ({ success: false, error })
```

**Usage in services:**
```ts
// datasets/service.ts
const createDataset = async (input: CreateDatasetInput) => {
  const existing = await repository.findByName(input.name)
  if (existing) return fail("Dataset name already exists")

  const dataset = await repository.create(input)
  return ok(dataset)
}
```

**Usage in routes:**
```ts
// datasets/router.ts
app.post("/datasets", async (c) => {
  const body = await c.req.json()
  const parsed = createDatasetSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)

  const result = await service.createDataset(parsed.data)
  if (!result.success) return c.json({ error: result.error }, 400)

  return c.json(result.data, 201)
})
```

**Rules:**
- Services NEVER throw. They return `Result<T>`
- Repositories MAY throw (Prisma errors) — services catch and wrap in `fail()`
- Routes check `result.success` and map to HTTP status codes
- No try/catch in route handlers — the service layer handles it

### Database & Migrations

- **Prisma** as ORM with `packages/db` as the single source of truth
- **Prisma Migrate** for migration management (`pnpm prisma migrate dev`, `pnpm prisma migrate deploy`)
- Migrations are generated, never hand-written
- PostgreSQL latest, running via Docker Compose in the monorepo

### Code Quality

- **ESLint** (flat config, `eslint.config.js`) with:
  - `@typescript-eslint/eslint-plugin` — strict TypeScript rules
  - `@typescript-eslint/no-explicit-any` → `error`
  - `@typescript-eslint/no-unused-vars` → `error`
  - `eslint-plugin-import` — import ordering and validation
  - Shared config at root, extended by each app/package
- **Prettier** — formatting (runs before ESLint)
  - Configured at root (`.prettierrc`)
  - Integrated with ESLint via `eslint-config-prettier` (disables conflicting rules)
- **All tools initialized via CLI** — never hand-write config files when an init command exists

### API Design

- RESTful routes following the module pattern
- All request bodies validated with Zod before hitting service layer
- Consistent error responses: `{ error: string }` with appropriate HTTP status codes
- Zod schemas defined in `validator.ts` per module and shared via `packages/shared` where frontend needs them

### Frontend Patterns

- **TanStack Query** for all API calls — no raw `fetch` in components
- **TanStack Table** for dataset items table, graders list, experiment results table
- **TanStack Form** with Zod resolvers for all forms (create/edit dataset, grader, experiment)
- **Tremor** charts for aggregate stats (pass rates per grader, experiment summary)
- **shadcn/ui** for all base components (buttons, dialogs, inputs, tabs, etc.)
- Components organized by feature, not by type

### UI Design Approach

- **Design system**: Full design system documented in `.interface-design/system.md` — all tokens, component patterns, states, and animation specs live there
- **Skill**: `interface-design` — this is a data tool (tables, forms, stats), not a marketing site
- **Theme**: Dark mode, zinc palette, borders-only depth, precision instrument aesthetic
- **Icons**: Lucide React — consistent icon set, native shadcn/ui integration
- **Tone**: Precise like a lab notebook, functional like a terminal, structured like a spreadsheet
- **Signature**: Left-border accent cells in the results table (2px colored border = pass/fail/error)
- **Typography**: Inter (sans) + JetBrains Mono (mono), 13px base, `tabular-nums` for all numeric data
- **Semantic colors**: Pass (phosphor green), Fail (deep red), Error (instrument amber) — color is reserved for meaning only
- **Spacing**: 4px base unit, all multiples
- **States**: Every view handles: loading (shimmer), empty (inset panel + icon + action), error (alert + retry), populated
- **Animation**: Motion library for popover reveals, slide panels, live cell fills. No decorative animation. If it wouldn't fit in `htop`, it doesn't belong here.
- **Navigation**: Left sidebar (Datasets, Graders, Experiments) + tab sub-navigation within detail views
- **Results table**: THE core view — rows sorted by fail count descending, verdict glyphs (✓/✗/!), hover popovers for reasons, pinned aggregate row at bottom

### CLI-First Setup

Every tool must be initialized via its CLI command. No hand-writing manifests or config files.

**Research before installing**: Always look up the current latest version and setup guide for any package before installing or configuring it. Do not rely on memorized versions — they go stale. Use official documentation sites (e.g. `hono.dev`, `prisma.io`, `tailwindcss.com`, `tanstack.com`, `sdk.vercel.ai`) to confirm the correct install command, init process, and configuration format for the current version.

| Tool | Init command |
|---|---|
| Monorepo | `pnpm dlx create-turbo@latest` |
| API (Hono) | `pnpm create hono@latest` |
| Frontend (Vite) | `pnpm dlx create vite@latest` |
| shadcn/ui | `pnpm dlx shadcn@latest init` |
| Prisma | `pnpm dlx prisma init` |
| ESLint | `pnpm dlx @eslint/create-config@latest` |
| TypeScript | `pnpm exec tsc --init` |

---

## Evaluation Execution Architecture

### Overview

Experiments are executed asynchronously using a **two-level queue** pattern. The API returns immediately when a run is triggered; processing happens in the background. This is implemented in-process using `p-queue` for the prototype, with a clear migration path to BullMQ + Redis for production.

### Two-Level Queue

```
┌──────────────────────────────────────────┐
│ HTTP API (Hono)                          │
│ POST /experiments/:id/run → 202 Accepted │
└────────────┬─────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────┐
│ Experiment Queue (p-queue)               │
│ concurrency: 2                           │
│ → up to 2 experiments run in parallel    │
│ → others wait in "queued" status         │
└────────────┬─────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────┐
│ Evaluation Queue (p-queue, per experiment)│
│ concurrency: 4                           │
│ → runs 4 LLM calls in parallel           │
│ → each cell is independent               │
│ → failures don't block other cells       │
└────────────┬─────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────┐
│ LLM API Call (per cell)                  │
│ → sends: system msg (rubric) +           │
│          user msg (item attributes)      │
│ → receives: verdict (pass/fail) + reason │
└──────────────────────────────────────────┘
```

### Level 1: Experiment Queue

- **Concurrency: 2** — up to two experiments run in parallel
- When a run is triggered, the experiment status is set to `"queued"`
- When the queue picks it up, status transitions to `"running"`
- If both slots are occupied, additional experiments wait in `"queued"` status

### Level 2: Evaluation Queue (per experiment)

- **Concurrency: 4** — up to 4 parallel LLM calls per experiment (max 8 total across 2 experiments)
- Created fresh for each experiment run
- One task per `(datasetItem × grader)` cell
- Each task is independent — a failure in one cell does not affect others
- Supports `intervalCap` + `interval` for rate limiting (e.g. 30 calls per 60 seconds)

### Status Lifecycle

```
POST /run
    │
    ▼
 "queued"  ──(queue picks up)──▶  "running"  ──(all cells done)──▶  "complete"
                                      │
                                      ├──(some cells error)──▶  "complete" (with error cells)
                                      │
                                      └──(all cells error)──▶  "failed"
```

- Status is persisted in PostgreSQL, not in the queue
- The API can be polled for current status: `GET /experiments/:id`
- Frontend uses TanStack Query with polling/refetch to show live status

### Partial Failure Handling

- Each LLM call is wrapped in a try/catch inside the evaluation queue
- On failure: the cell is saved with `verdict: "error"` and the error message as `reason`
- Other cells continue processing unaffected
- If ALL cells fail, experiment status is set to `"failed"`
- If SOME cells fail, experiment status is still `"complete"` (with error cells visible in results)

### LLM Prompt Construction

Per the spec's resolved decision on rubric role:

- **System message**: Contains the grader's `rubric` — the judging instructions
- **User message**: Contains the dataset item's attributes (`input`, `expected_output`, and any custom attributes)
- **Expected response**: Structured output with `verdict` ("pass" or "fail") and `reason` (string)

### Technology Choice: p-queue

- **Library**: `p-queue` v9.x (in-process, promise-based, 0 dependencies)
- **Why**: Simple, lightweight, built-in concurrency + rate limiting, no external infrastructure
- **Tradeoff**: In-memory only — queued jobs are lost on server restart

### Migration Path to BullMQ

When the prototype outgrows in-process queuing, swap to BullMQ:

| Concern | p-queue (now) | BullMQ (later) |
|---|---|---|
| Infrastructure | None | Redis required |
| Persistence | In-memory, lost on restart | Redis-backed, survives restarts |
| Multi-process | Single process | Multiple workers across machines |
| Monitoring | Application logs | Bull Board dashboard |
| Rate limiting | Built-in (`intervalCap`) | Job options + rate limiter |
| Dead letter queue | Manual (catch + save) | Built-in DLQ |
| Setup complexity | ~20 lines | ~100 lines + Redis |

**Migration trigger**: when experiments take >30 min, need multi-server scaling, or need job persistence across restarts.

**Migration strategy**: The service layer (`experiments/service.ts`) owns the queue logic. Swapping p-queue for BullMQ only changes the queue implementation inside the service — routes, repositories, and validators are untouched.

### Real-Time Updates (Server-Sent Events)

The frontend receives live experiment progress via **SSE** using Hono's built-in `streamSSE()` helper. This replaces polling and gives the user immediate feedback as cells complete.

**Endpoint:** `GET /experiments/:id/events`

**Event types:**

| Event | When emitted | Payload |
|---|---|---|
| `connected` | Client connects | `{ experimentId }` |
| `progress` | After each cell completes | `{ experimentId, status, cellsCompleted, totalCells }` |
| `completed` | Experiment finishes | `{ experimentId, status, cellsCompleted, totalCells }` |
| `error` | Experiment fails entirely | `{ experimentId, error }` |

**Server side (Hono):**
- The evaluation queue emits events via an in-process `EventEmitter` as each cell completes
- The SSE endpoint subscribes to events for the requested experiment ID
- Events include aggregate progress (cells completed / total), not per-cell details
- Connection stays open until experiment completes or client disconnects
- `stream.onAbort()` cleans up the subscription on client disconnect

**Client side (React):**
- A custom `useExperimentSSE(experimentId)` hook opens an `EventSource` connection
- On `progress` events: updates TanStack Query cache directly via `queryClient.setQueryData()` for instant UI feedback
- On `completed` events: invalidates the experiment query to fetch final results from the server
- The hook auto-closes the connection when the component unmounts or experiment completes
- No polling needed — SSE provides push-based updates

**Flow:**
```
Cell completes → EventEmitter fires → SSE stream writes progress event
                                          │
                                          ▼
                                    EventSource receives
                                          │
                                          ▼
                                    queryClient.setQueryData()
                                          │
                                          ▼
                                    UI re-renders with updated progress
```

**Why SSE over WebSockets:**
- Unidirectional (server → client) is all we need — client doesn't send data back
- Native browser support via `EventSource` — no library needed
- Hono has built-in `streamSSE()` — zero extra dependencies
- Automatic reconnection built into the `EventSource` API
- Simpler than WebSockets for this use case

**Connection model: one SSE connection per experiment**
- Each experiment detail view opens its own `EventSource` to `GET /experiments/:id/events`
- With max 2 concurrent experiments, that's at most 2 SSE connections
- HTTP/2 multiplexes all connections over a single TCP connection — no resource concern
- Even on HTTP/1.1 (6 connections per origin), 2 SSE + 4 REST is well within limits
- Clean lifecycle: connection opens when the user views the experiment, closes on completion or navigation away
- No multiplexed single-connection design needed — per-experiment scoping is simpler and the concurrency limit makes it practical

---

## LLM Integration

### Provider

- **Vercel AI SDK** (`ai` package) — for structured LLM calls
- **OpenRouter** (`@openrouter/ai-sdk-provider`) — model gateway, access to 400+ models
- **Default judge model**: configurable via environment variable (e.g. `google/gemini-3-flash-preview` for speed, `anthropic/claude-sonnet-4-6` for quality)

### Structured Output

Each evaluation call uses `generateObject()` from the Vercel AI SDK with a Zod schema to guarantee type-safe responses:

```ts
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateObject } from 'ai'
import { z } from 'zod'

const verdictSchema = z.object({
  verdict: z.enum(['pass', 'fail']),
  reason: z.string(),
})

// Per the spec: system message = rubric, user message = item attributes
const result = await generateObject({
  model: openrouter(process.env.LLM_JUDGE_MODEL ?? 'google/gemini-3-flash-preview'),
  schema: verdictSchema,
  system: grader.rubric,
  prompt: formatItemAttributes(datasetItem),
})
// result.object is typed as { verdict: "pass" | "fail", reason: string }
```

### Environment Variables

All environment configuration lives in a single `.env` file at the **monorepo root**. Each app reads from it.

```env
# .env (monorepo root)

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/eval_harness"

# LLM
OPENROUTER_API_KEY="sk-or-v1-..."    # OpenRouter API key
LLM_JUDGE_MODEL="google/gemini-3-flash-preview"  # Default judge model (overridable)

# API
API_PORT=3001

# Frontend
VITE_API_URL="http://localhost:3001"
```

**Rules:**
- `.env` at monorepo root — single source of truth
- `.env.example` committed to repo with placeholder values (no real keys)
- `.env` added to `.gitignore` — never committed
- `OPENROUTER_API_KEY` is the only secret — everything else is configuration
- `LLM_JUDGE_MODEL` is configurable so the model can be changed without code changes
- Vite requires `VITE_` prefix for frontend-accessible variables

---

## Testing Strategy

### TDD — Non-Negotiable

Every feature follows: write failing test → implement → green → commit. No exceptions.

### Backend Testing

- **Framework**: Vitest (fast, native ESM, TypeScript-first)
- **Layers tested independently:**
  - `validator.ts` — Zod schema parsing (valid/invalid inputs)
  - `service.ts` — Business logic with mocked repository (Result pattern assertions)
  - `repository.ts` — Database operations against test PostgreSQL (integration tests)
  - `router.ts` — HTTP layer via Hono test client (`app.request()`)

### Frontend Testing

- **Framework**: Vitest + React Testing Library
- **Focus**: Component behavior, not implementation details

### API Smoke Tests (`test.yml`)

A structured YAML file documenting every API endpoint with curl commands for manual testing and CI verification. Organized by module, covers happy paths and error cases.

```yaml
# test.yml — API Endpoint Test Guide
# Run these curl commands against http://localhost:3001

datasets:
  create:
    description: "Create a new dataset"
    command: |
      curl -X POST http://localhost:3001/datasets \
        -H "Content-Type: application/json" \
        -d '{"name": "my-dataset"}'
    expected_status: 201
    expected_body: '{ "success": true, "data": { "id": "...", "name": "my-dataset", "attributes": ["input", "expected_output"] } }'

  create_duplicate_name:
    description: "Reject duplicate dataset name"
    command: |
      curl -X POST http://localhost:3001/datasets \
        -H "Content-Type: application/json" \
        -d '{"name": "my-dataset"}'
    expected_status: 400
    expected_body: '{ "success": false, "error": "Dataset name already exists" }'

  create_empty_name:
    description: "Reject empty dataset name"
    command: |
      curl -X POST http://localhost:3001/datasets \
        -H "Content-Type: application/json" \
        -d '{"name": ""}'
    expected_status: 400

  list:
    description: "List all datasets"
    command: |
      curl http://localhost:3001/datasets
    expected_status: 200

  get:
    description: "Get dataset by ID with schema and items"
    command: |
      curl http://localhost:3001/datasets/:id
    expected_status: 200

  rename:
    description: "Rename a dataset"
    command: |
      curl -X PATCH http://localhost:3001/datasets/:id \
        -H "Content-Type: application/json" \
        -d '{"name": "renamed-dataset"}'
    expected_status: 200

  delete:
    description: "Delete dataset (cascades to items + experiments)"
    command: |
      curl -X DELETE http://localhost:3001/datasets/:id
    expected_status: 200

  add_attribute:
    description: "Add custom attribute to dataset schema"
    command: |
      curl -X POST http://localhost:3001/datasets/:id/attributes \
        -H "Content-Type: application/json" \
        -d '{"name": "context"}'
    expected_status: 201

  add_duplicate_attribute:
    description: "Reject duplicate attribute name"
    command: |
      curl -X POST http://localhost:3001/datasets/:id/attributes \
        -H "Content-Type: application/json" \
        -d '{"name": "input"}'
    expected_status: 400

  remove_attribute:
    description: "Remove custom attribute from schema"
    command: |
      curl -X DELETE http://localhost:3001/datasets/:id/attributes/context
    expected_status: 200

  remove_builtin_attribute:
    description: "Reject removal of built-in attribute"
    command: |
      curl -X DELETE http://localhost:3001/datasets/:id/attributes/input
    expected_status: 400

dataset_items:
  create:
    description: "Add item to dataset"
    command: |
      curl -X POST http://localhost:3001/datasets/:id/items \
        -H "Content-Type: application/json" \
        -d '{"values": {"input": "What is 2+2?", "expected_output": "4"}}'
    expected_status: 201

  create_missing_builtin:
    description: "Item without required built-in attributes"
    command: |
      curl -X POST http://localhost:3001/datasets/:id/items \
        -H "Content-Type: application/json" \
        -d '{"values": {"input": "hello"}}'
    expected_status: 400

  list:
    description: "List items in a dataset"
    command: |
      curl http://localhost:3001/datasets/:id/items
    expected_status: 200

  update:
    description: "Edit a dataset item"
    command: |
      curl -X PATCH http://localhost:3001/datasets/:id/items/:itemId \
        -H "Content-Type: application/json" \
        -d '{"values": {"input": "What is 3+3?", "expected_output": "6"}}'
    expected_status: 200

  delete:
    description: "Remove a dataset item"
    command: |
      curl -X DELETE http://localhost:3001/datasets/:id/items/:itemId
    expected_status: 200

  csv_template:
    description: "Download CSV template for dataset"
    command: |
      curl http://localhost:3001/datasets/:id/csv/template -o template.csv
    expected_status: 200

  csv_import:
    description: "Import items from CSV"
    command: |
      curl -X POST http://localhost:3001/datasets/:id/csv/import \
        -F "file=@items.csv"
    expected_status: 200

  csv_export:
    description: "Export items as CSV"
    command: |
      curl http://localhost:3001/datasets/:id/csv/export -o items.csv
    expected_status: 200

graders:
  create:
    description: "Create a new grader"
    command: |
      curl -X POST http://localhost:3001/graders \
        -H "Content-Type: application/json" \
        -d '{"name": "accuracy-check", "description": "Checks factual accuracy", "rubric": "Evaluate whether the output matches the expected output. Consider semantic equivalence, not just exact string matching."}'
    expected_status: 201

  create_empty_rubric:
    description: "Reject grader with empty rubric"
    command: |
      curl -X POST http://localhost:3001/graders \
        -H "Content-Type: application/json" \
        -d '{"name": "bad-grader", "description": "test", "rubric": ""}'
    expected_status: 400

  list:
    description: "List all graders"
    command: |
      curl http://localhost:3001/graders
    expected_status: 200

  get:
    description: "Get grader by ID"
    command: |
      curl http://localhost:3001/graders/:id
    expected_status: 200

  update:
    description: "Edit a grader"
    command: |
      curl -X PATCH http://localhost:3001/graders/:id \
        -H "Content-Type: application/json" \
        -d '{"name": "updated-grader", "rubric": "Updated rubric instructions"}'
    expected_status: 200

  delete:
    description: "Delete grader (cascades to experiments)"
    command: |
      curl -X DELETE http://localhost:3001/graders/:id
    expected_status: 200

experiments:
  create:
    description: "Create an experiment"
    command: |
      curl -X POST http://localhost:3001/experiments \
        -H "Content-Type: application/json" \
        -d '{"name": "eval-run-1", "datasetId": ":datasetId", "graderIds": [":graderId1", ":graderId2"]}'
    expected_status: 201

  create_no_graders:
    description: "Reject experiment with no graders"
    command: |
      curl -X POST http://localhost:3001/experiments \
        -H "Content-Type: application/json" \
        -d '{"name": "bad-exp", "datasetId": ":datasetId", "graderIds": []}'
    expected_status: 400

  list:
    description: "List all experiments"
    command: |
      curl http://localhost:3001/experiments
    expected_status: 200

  get:
    description: "Get experiment with results"
    command: |
      curl http://localhost:3001/experiments/:id
    expected_status: 200

  run:
    description: "Trigger experiment run (returns 202, processes async)"
    command: |
      curl -X POST http://localhost:3001/experiments/:id/run
    expected_status: 202

  events:
    description: "SSE stream for experiment progress"
    command: |
      curl -N http://localhost:3001/experiments/:id/events
    expected_status: 200
    notes: "Streams SSE events: connected, progress, completed, error"

  delete:
    description: "Delete experiment and all results"
    command: |
      curl -X DELETE http://localhost:3001/experiments/:id
    expected_status: 200

  csv_export:
    description: "Export experiment results as CSV"
    command: |
      curl http://localhost:3001/experiments/:id/csv/export -o results.csv
    expected_status: 200
    notes: "Only available when experiment status is complete"

  rerun:
    description: "Re-run experiment (creates new experiment)"
    command: |
      curl -X POST http://localhost:3001/experiments/:id/rerun
    expected_status: 201
    notes: "Creates a new experiment with derived name, original preserved"
```
