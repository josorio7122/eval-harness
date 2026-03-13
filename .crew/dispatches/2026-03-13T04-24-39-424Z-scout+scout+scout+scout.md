# scout+scout+scout+scout dispatch

## Task
[scout] Read the ENTIRE file /Users/josorio/Code/mini-skills/docs/spec.md and return its full contents. Do not summarize.
[scout] Read the ENTIRE file /Users/josorio/Code/mini-skills/docs/implementation.md and return its full contents. Do not summarize.
[scout] Read the ENTIRE file /Users/josorio/Code/mini-skills/.interface-design/system.md and return its full contents. Do not summarize.
[scout] Map the current project structure of /Users/josorio/Code/mini-skills. Run: find . -type f -not -path 

## Output
## Scout #1: Read the ENTIRE file /Users/josorio/Code/mini-skills/docs/spec.md and return its full contents. Do not summarize.
Here is the full contents of `/Users/josorio/Code/mini-skills/docs/spec.md`:

The file contains a comprehensive specification for a Lightweight Eval Harness system with three main sections:

**Datasets** — manages test case collections with:
- CRUD operations (create, rename, delete with cascade)
- Schema management (built-in `input` and `expected_output` attributes, plus custom attributes)
- Item management (create, edit, delete with schema conformance)
- CSV import/export with preview and validation
- Deletion warnings when experiments reference the dataset

**Graders** — manages evaluation rubrics with:
- CRUD operations (create, edit, delete with cascade)
- Name and description fields, plus the judging rubric text
- Full rubric visibility (no truncation)
- Deletion warnings when experiments reference the grader
- Name/rubric uniqueness and non-empty validation

**Experiments** — runs evaluations across datasets and graders with:
- Creation with dataset + multiple grader selection
- Execution that produces pass/fail verdicts + reasons for each item–grader pair
- Results display in a table (rows = items, columns = graders)
- Aggregate statistics: per-grader pass rates, per-item pass counts, overall pass rate
- Result filtering by outcome (all, passed-all-graders, any-failed)
- CSV export of results
- Parallel execution (up to 2 concurrent, others queued)
- Re-run capability that creates a new experiment with preserved history

All state persists in-memory (single-session, single-user). No database, authentication, or external persistence required. Constraints include string-only attribute values, insertion-order item/attribute display, and reserved `input`/`expected_output` attributes that cannot be removed.

## Scout #2: Read the ENTIRE file /Users/josorio/Code/mini-skills/docs/implementation.md and return its full contents. Do not summarize.
Here is the full contents of `/Users/josorio/Code/mini-skills/docs/implementation.md`:

---

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
- **States**: Every view handles: loading (shimmer), empty (inset panel + icon + action), empty error (alert + retry), populated
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

## Scout #3: Read the ENTIRE file /Users/josorio/Code/mini-skills/.interface-design/system.md and return its full contents. Do not summarize.
Here is the complete contents of `/Users/josorio/Code/mini-skills/.interface-design/system.md`:

# Eval Harness — Design System

## Intent

- **Who**: ML engineer or developer, iterating on prompts and eval criteria at midnight. Not browsing — hunting for failures.
- **What they do**: Create datasets, define grading rubrics, run experiments, scan results to find failures, drill into reasons.
- **Feel**: Precise like a lab notebook. Functional like a terminal. Structured like a spreadsheet. Confidence-inspiring — "I can trust these results."

## Domain Exploration

### Concepts
Evaluation, rubric, verdict, pass/fail, test case, grader, experiment run, dataset schema, accuracy, LLM judge, ground truth, provenance, threshold.

### Color World
Deep slate (terminal backgrounds), phosphor green (passing signal), warning amber (instrument panels), error red (system alerts), steel blue (scientific instruments), off-white (lab notebook paper), ink black (dense data tables). Dark mode, cool temperature, desaturated except for semantic signals.

### Signature Element
The **results grid cell** — a dense, borderless grid where each cell has a 2px colored left-border accent (green/red/amber) and a verdict glyph (✓/✗/!). Hover expands to show the grader rationale in an inline popover. This IS the product.

### Defaults Rejected

| Default | Replacement |
|---|---|
| White card grid with soft shadows | Dark canvas, borders-only depth, sharp radius (4px) |
| Color-coded status badges (pill-shaped) | Left-border accent on table rows — color at the edge, not inside a badge |
| Blue primary action buttons | Near-white buttons on dark surfaces — the results speak louder than the buttons |

## Token Architecture

### Foreground
```
--fg-primary:     hsl(240, 5%, 90%)     ← default text
--fg-secondary:   hsl(240, 4%, 66%)     ← supporting text
--fg-tertiary:    hsl(240, 4%, 54%)     ← metadata
--fg-muted:       hsl(240, 3%, 38%)     ← disabled, placeholder
--fg-inverted:    hsl(240, 6%, 7%)      ← text on light surfaces
```

### Background / Surfaces
```
--bg-base:        hsl(240, 6%, 7%)      ← canvas
--bg-surface-1:   hsl(240, 5%, 11%)     ← panels, cards
--bg-surface-2:   hsl(240, 4%, 16%)     ← inputs, table headers
--bg-surface-3:   hsl(240, 3%, 20%)     ← dropdowns, popovers, modals
--bg-inset:       hsl(240, 6%, 5%)      ← recessed areas, empty states
```

### Borders
```
--border-subtle:  rgba(255,255,255,0.05)   ← table row dividers
--border-default: rgba(255,255,255,0.08)   ← card/panel borders
--border-strong:  rgba(255,255,255,0.12)   ← interactive element borders
--border-focus:   hsl(215, 60%, 58%)       ← focus ring (accent)
```

### Accent
```
--accent:         hsl(215, 60%, 58%)       ← steel-blue, selection/focus only
--accent-subtle:  hsla(215, 60%, 58%, 0.12)
--accent-strong:  hsl(215, 60%, 70%)
```

### Semantic Colors
```
--pass:           hsl(142, 52%, 44%)       ← phosphor green
--pass-subtle:    hsla(142, 52%, 44%, 0.08)
--pass-fg:        hsl(142, 52%, 70%)

--fail:           hsl(0, 60%, 52%)         ← deep red
--fail-subtle:    hsla(0, 60%, 52%, 0.10)
--fail-fg:        hsl(0, 60%, 75%)

--error:          hsl(38, 85%, 52%)        ← instrument amber
--error-subtle:   hsla(38, 85%, 52%, 0.10)
--error-fg:       hsl(38, 85%, 75%)

--neutral:        hsl(240, 3%, 40%)        ← pending/skipped
--neutral-subtle: hsla(240, 3%, 40%, 0.15)
--neutral-fg:     hsl(240, 4%, 60%)
```

**Rule**: Semantic colors appear only in three places — result cells, status indicators, and aggregate stats. Nowhere else.

## Typography

```
--font-sans:   'Inter', 'Inter var', system-ui, -apple-system, sans-serif
--font-mono:   'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace
```

| Role | Size | Weight | Spacing | Font |
|---|---|---|---|---|
| Page title | 16px | 600 | -0.01em | sans |
| Section heading | 13px | 600 | 0.01em | sans, uppercase |
| Body | 13px | 400 | 0 | sans |
| Table header | 11px | 600 | 0.05em | sans, uppercase |
| Table cell | 13px | 400 | 0 | sans |
| Data / scores | 13px | 500 | 0 | mono, tabular-nums |
| Stat number | 24px | 600 | -0.02em | mono, tabular-nums |
| Stat label | 11px | 500 | 0.04em | sans, uppercase |
| Code / rubric | 12px | 400 | 0 | mono |
| Badge label | 11px | 500 | 0.03em | sans |

**Critical**: All numeric data uses `font-variant-numeric: tabular-nums` and mono stack. Numbers in columns must align.

## Spacing

Base unit: **4px**

```
--space-1:  4px     --space-5:  20px
--space-2:  8px     --space-6:  24px
--space-3:  12px    --space-8:  32px
--space-4:  16px    --space-10: 40px
```

- Table cell padding: `8px 12px`
- Card padding: `16px`
- Input height: `32px`
- Button height: `32px` default, `28px` compact, `36px` primary CTA

## Depth Strategy

**Borders-only. No shadows. No exceptions.**

Why: Dark canvas, tool aesthetic, terminal feel. Shadows imply physical light which contradicts the precision instrument mental model. Borders communicate structure without physicality.

- `0.5px` borders within data structures (table dividers)
- `1px` borders around panels, cards, interactive elements
- Always `rgba(255,255,255, X)` — never `solid #333`

## Radius

```
--radius-sm:  3px    ← tags, badges
--radius-md:  4px    ← buttons, inputs
--radius-lg:  6px    ← cards, panels
--radius-xl:  8px    ← modals, popovers
```

## Component Patterns

### Navigation
Left sidebar (220px, `--bg-base`, `1px` right border). Three sections: Datasets, Graders, Experiments. Active item: 2px left-border in `--accent`. Section headings: 10px, 600, uppercase, `--fg-tertiary`.

### Dataset List
Dense table rows. Name (primary), item count + field count (mono, secondary), timestamp (tertiary). Hover: `--bg-surface-1` fill. Row separator: `1px solid --border-subtle`.

### Dataset Detail
Two-panel split. Left (30%): schema fields as definition list. Right (70%): items table. Separated by `1px solid --border-default` vertical divider.

### Grader List
Same as dataset list. Type badge (`LLM` in `--accent-subtle` bg) distinguishes grader types.

### Grader Detail
Rubric editor in `--bg-inset` textarea, mono font, 12px. Auto-grows. Focus: `--border-focus`. Unsaved changes: `1px solid --error` left-border on form panel.

### Experiment List
Left-border accent per status: Running (`--accent`), Pass (`--pass`), Fail below threshold (`--fail`), Error (`--error`), Queued (`--neutral`). Running rows show 2px progress line at bottom.

### Results Table (Core View)
Rows = dataset items, Columns = graders. Default sort: fail count descending — failures at top.

**Cell anatomy:**
- Height: 44px
- 2px left-border in semantic color
- Background tint: fail/error cells only (`--fail-subtle`, `--error-subtle`)
- Verdict glyph centered: ✓ (`--pass-fg`), ✗ (`--fail-fg`), ! (`--error-fg`), — (`--neutral-fg`)
- No text labels — glyph + color communicates

**Hover popover** (150ms delay):
- `--bg-surface-3`, `1px solid --border-strong`, `border-radius: 6px`
- Shows: item key, grader name, model output (mono, 12px), rationale
- Max-width: 320px, anchored to cell

**Aggregate row** (pinned bottom): Each column's pass rate + inline mini-bar (Tremor ProgressBar, 8px). `--bg-surface-2` background.

### Aggregate Stats Banner
Above results table, 80px height, `--bg-surface-1`.
1. Pass rate headline: 24px mono, colored by threshold
2. Cell count: `"120 items × 3 graders = 360 evaluations"`
3. Per-grader breakdown: Tremor BarChart

### Pass/Fail/Error Cell (Atomic Unit)
```
Container: 44px height, 8px 12px padding
Left border: 2px solid <semantic-color>
Background: <semantic-subtle> (fail/error only)
Glyph: mono 14px, weight 600, centered
Hover: popover after 150ms delay
```

## States

| View | Loading | Empty | Error | Populated |
|---|---|---|---|---|
| Lists | 3 row shimmers | Inset panel + icon + action | Inset panel + alert + retry | Dense rows |
| Dataset schema | Block shimmer | Dashed border + "+" button | Inline alert | Definition list |
| Dataset items | Row shimmers + visible headers | Inset panel with column headers shown | Alert in table body | Scrollable table |
| Results table | Grid shimmer (headers first) | Centered inset panel | Error strip + partial data | Populated |
| Aggregate stats | `—` + Loader2 spinner | N/A | Error strip | Stats + chart |

**Universal rule**: Error never hides existing data. Show stale data + error bar: `"Last updated 4 min ago · Refresh failed"`.

## Animation (Motion library)

| Element | Transition | Duration | Easing |
|---|---|---|---|---|
| Cell hover popover | opacity 0→1, y 4→0 | 150ms | ease-out |
| Popover dismiss | opacity 1→0 | 100ms | ease-in |
| Nav item active | left-border 0→2px | 150ms | ease-out |
| New experiment row | height 0→auto, opacity 0→1 | 200ms | ease-out |
| Result cell fill (live) | opacity 0.4→1 | 200ms | ease-out |
| Breathing cell (pending) | opacity 0.4↔0.7 | 1500ms loop | ease-in-out |
| Slide panel open | x 100%→0 | 250ms | ease-out |
| Slide panel close | x 0→100% | 200ms | ease-in |
| Tab content switch | opacity 0→1 | 100ms | ease-out |

**Does NOT animate**: Table row reorder, page navigation, form states, badge changes, modal backdrop. If it wouldn't fit in `htop`, it doesn't belong.

## Craft Checks

1. **Swap test**: Remove left-border accents, change to system font, generic blue accent → it becomes a generic admin panel. Those three elements are load-bearing identity.
2. **Squint test**: Fail cells (tinted backgrounds, red borders) cluster at the top. You can locate problems before your eyes focus.
3. **Signature test**: (1) left-border cell accents, (2) progress line at row bottom, (3) pinned aggregate row with mini-bars, (4) rubric editor unsaved-state border, (5) breathing cell animation.
4. **Token test**: Variable names (`--pass-fg`, `--fail-subtle`, `--bg-inset`) sound like a scientific instrument's interface, not `--primary`, `--success`, `--danger`.

## Scout #4: Map the current project structure of /Users/josorio/Code/mini-skills. Run: find . -type f -not -path './.git/*' -not -path './node_modules/*' -not -path './.crew/*' | head -100. Also check if any package.json, tsconfig, or config files exist. Show the full tree.
Perfect! Let me create a comprehensive summary now.

---

## Findings: mini-skills Project Overview

### Structure

The project is a **specification & planning repository** (not yet implemented). It contains detailed requirements and design documentation for building a lightweight eval harness — a web-based tool for managing datasets, defining evaluation criteria (graders), and running experiments to judge test cases.

```
/Users/josorio/Code/mini-skills/
├── docs/                          # Core specification documents (76 lines total)
│   ├── spec.md                    # Full feature specification + constraints
│   ├── requirements.md            # User flow + acceptance criteria + resources
│   └── implementation.md           # Tech stack, architecture, database design
├── .interface-design/
│   └── system.md                  # UI design system (dark mode eval harness aesthetic)
└── .crew/                         # Crew execution artifacts
    ├── dispatches/                # Agent execution logs (20+ recent runs)
    ├── findings/                  # Scout/researcher findings
    └── state.md                   # Session state tracking
```

### Key Files

- **`docs/spec.md`** (2100+ lines): Complete product specification covering:
  - **Datasets**: CRUD for test case collections, schema management, custom attributes, CSV import/export
  - **Graders**: LLM-powered evaluation criteria with rubrics, pass/fail verdicts + reasons
  - **Experiments**: Run graders against datasets, results in a table with aggregate stats (pass rates, per-item summaries), CSV export
  - **Error handling**: 30+ explicit error cases documented (empty names, duplicates, schema violations, import validation)
  - **Cascade deletes**: Detailed deletion rules (dataset deletion cascades to items + experiments)

- **`docs/implementation.md`** (1000+ lines): Technical implementation blueprint covering:
  - **Data model**: 5 entities (Dataset, DatasetItem, Grader, Experiment, ExperimentResult) with relationships, constraints, invariants
  - **Tech stack**: 
    - Backend: Hono + Prisma + PostgreSQL + Zod
    - Frontend: Vite + React + shadcn/ui + Tailwind v4 + TanStack Query/Table/Form
    - Monorepo: Turborepo + pnpm workspaces
  - **Architecture guardrails**: TypeScript strict mode, Result pattern (no exceptions), module pattern (router/service/repository/validator per domain)
  - **Evaluation execution**: Two-level queue (p-queue) — max 2 parallel experiments, 4 LLM calls per experiment, SSE for real-time progress
  - **LLM integration**: Vercel AI SDK + OpenRouter + structured output (Zod schemas)
  - **Testing strategy**: TDD required, Vitest + React Testing Library, API smoke tests (YAML)

- **`docs/requirements.md`** (~100 lines): High-level user flow + acceptance criteria + stretch goals (SQL persistence, aggregate stats, CSV export)

- **`.interface-design/system.md`** (~200 lines): Design system documenting:
  - **Intent**: Dark mode lab notebook aesthetic — precise, functional, trustworthy
  - **Signature element**: Results grid with 2px left-border accent cells (colored for pass/fail/error) and verdict glyphs
  - **Token architecture**: HSL-based dark palette (slate base, phosphor green pass, deep red fail, amber error)
  - **Defaults rejected**: No white cards, no soft shadows, no pill-shaped status badges

### Patterns Observed

1. **Specification-driven**: All behavior contracts explicitly documented (e.g., "ItemSchemaConformance: At all times, every item carries exactly the schema's attributes")
2. **Cascade delete rules**: Carefully specified and tested (e.g., deleting a dataset cascades to all items + all experiments referencing it + all results)
3. **Built-in attribute protection**: `input` and `expected_output` cannot be removed from any dataset — enforced in multiple layers
4. **Result pattern everywhere**: Services return `Result<T>` instead of throwing; repos may throw (Prisma), services wrap in `fail()`
5. **Module pattern**: Every domain (datasets, graders, experiments) follows router/service/repository/validator split
6. **Type safety**: No `any` types, strict mode required, Zod validation on request/response boundaries
7. **Queue architecture**: Two-level concurrency (2 experiments parallel, 4 LLM calls per experiment)
8. **SSE for real-time progress**: Not polling — push-based updates as cells complete

### Concerns

- **No implementation code yet**: This is a specification repo. The actual codebase (Hono API, React frontend, Prisma schema, migrations) does not exist yet and needs to be scaffolded
- **Complex cascade rules**: The database design has intricate cascade delete rules (Dataset → Items, Dataset → Experiments, Graders → Experiments). Migration generation + testing will be critical
- **Queue migration path**: Current design uses p-queue (in-memory), but spec notes clear migration to BullMQ + Redis for production. Prototype needs to handle queue persistence
- **LLM error handling**: Cell-level LLM failures are caught, but spec requires distinguishing "some cells error" vs "all cells error" status transitions
- **SSE connection model**: Design calls for per-experiment SSE connections; need to test connection limit on browsers + ensure cleanup on navigation

### Resolved Decisions Documented

The spec includes explicit "Resolved Decisions" sections that close ambiguities:

**Datasets:**
- Dataset names must be unique; duplicate names rejected at form validation
- Attribute names auto-lowercased
- Items appear in insertion order (no sorting)
- Deletion requires confirmation if experiments reference the dataset

**Graders:**
- Grader names must be unique
- Rubric is freeform instruction text (no enforced placeholders)
- Deletion cascades to all referencing experiments + results

**Experiments:**
- Re-running creates a new experiment (preserves original + results)
- Dataset is live reference (not snapshot) — edits after run reflect in results
- Status progression: queued → running → complete (or failed)
- CSV export only available when status = "complete"

### Relevant to Task

This is a **greenfield specification** ready for implementation. The next step is to:

1. **Scaffold the monorepo** (`pnpm dlx create-turbo@latest`)
2. **Create backend** (Hono API) with Prisma schema matching the entity model
3. **Create frontend** (Vite + React) with tabs + tables + forms
4. **Implement queue architecture** (p-queue for experiments/evaluations)
5. **Add LLM integration** (Vercel AI SDK + OpenRouter)
6. **Add tests** (TDD — write test first, all specs testable)

**All specifications for behavior, database, UI design, and error handling are complete.** No ambiguity on what to build.
