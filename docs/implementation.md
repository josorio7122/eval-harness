# Implementation Details

## Data Model

### Overview

This document defines the entity model for the lightweight eval harness. Data is persisted in PostgreSQL (latest version, running via Docker). All IDs are UUIDs, generated server-side.

---

### Entities

#### 1. `Dataset`

A named collection of structured test cases. The current state (attributes and items) is always derived from the latest `DatasetRevision`.

```ts
type Dataset = {
  id: uuid // System-generated
  name: string // User-provided. Non-empty, unique across all datasets
  deletedAt: timestamp | null // Soft-delete timestamp; null when active
}
```

**Constraints:**

- `name` must be non-empty
- `name` must be unique across all datasets
- A `Dataset` whose latest revision has zero items does not appear as selectable when creating an `Experiment`
- Renaming preserves all revisions and their items
- Storage: PostgreSQL (latest, via Docker)

**Relationships:**

- Has many `DatasetRevision`s (one-to-many, cascade delete)
- Referenced by many `Experiment`s (`onDelete: Restrict` — prevents hard deletion while experiments exist). Soft-deleted datasets hide from lists but preserve all experiment references.

---

#### 2. `DatasetRevision`

An immutable snapshot of a dataset's schema and items at a point in time. Created on every mutation (item add/edit/delete, attribute add/remove, CSV import). Never modified after creation.

```ts
type DatasetRevision = {
  id: uuid // System-generated
  datasetId: uuid // Reference to owning Dataset
  schemaVersion: number // Increments only on schema changes (attribute add/remove). Item mutations copy unchanged.
  attributes: string[] // The attribute schema at this revision. Always includes ["input", "expected_output"]
  createdAt: timestamp // System-generated. Used to determine latest revision (ORDER BY createdAt DESC LIMIT 1)
}
```

**Constraints:**

- `schemaVersion` starts at 1 when the dataset is created
- `schemaVersion` increments by 1 only when attributes change (add or remove). Item-only mutations copy the previous `schemaVersion` unchanged
- `attributes` always contains at least `["input", "expected_output"]`
- All attribute names are stored lowercase
- Attribute names must be unique within the revision
- Attributes are ordered: built-ins first, then custom in insertion order
- A revision is immutable once created — its attributes and items are never modified
- Latest revision is determined by `ORDER BY createdAt DESC LIMIT 1`

**Relationships:**

- Belongs to exactly one `Dataset` (many-to-one, cascade delete when dataset is deleted)
- Has many `DatasetRevisionItem`s (one-to-many, cascade delete)
- Referenced by many `Experiment`s. Revisions are never deleted individually — only via cascade when the parent dataset is deleted

---

#### 3. `DatasetRevisionItem`

A single row in a dataset revision. Immutable once created.

```ts
type DatasetRevisionItem = {
  id: uuid // System-generated. Unique per revision.
  revisionId: uuid // Reference to owning DatasetRevision
  itemId: uuid // Stable identity across revisions. Tracks the same logical item.
  values: Record<string, string>
  // Keys are exactly the attribute names of the owning revision's attributes.
  // Values are always strings.
}
```

**Constraints:**

- `values` must contain exactly the keys present in the owning revision's `attributes` — no more, no fewer
- All values are strings
- `"input"` and `"expected_output"` keys are always present
- `itemId` is a stable UUID that persists across revisions for the same logical item
- When an attribute is added, the new revision's items have that key with value `""`
- When an attribute is removed, the new revision's items no longer have that key
- Items are immutable within a revision — edits create a new revision with updated values

**Relationships:**

- Belongs to exactly one `DatasetRevision` (many-to-one, cascade delete)
- Referenced by `ExperimentResult` (informational — cascade flows through `Experiment`, not directly)

---

#### 4. `Grader`

An evaluation criterion. Holds the rubric given to the LLM judge.

```ts
type Grader = {
  id: uuid // System-generated
  name: string // User-provided. Non-empty, unique across all graders
  description: string // User-provided. May be empty string, never null
  rubric: string // User-provided. Non-empty. The full judging instruction for the LLM
  deletedAt: timestamp | null // Soft-delete timestamp; null when active
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
- Soft-deleted (hidden from lists and dropdowns). All experiments and results referencing the grader are preserved. `ExperimentResult.graderId` uses `onDelete: Restrict` at the database level as a safety net.

---

#### 5. `Experiment`

Ties a dataset and one or more graders together. Tracks run status and owns all result cells.

```ts
type ExperimentStatus = 'queued' | 'running' | 'complete' | 'failed'

type Experiment = {
  id: uuid // System-generated
  name: string // User-provided. Non-empty; derived from original on re-run
  datasetId: uuid // User-selected. Reference to owning Dataset (for grouping/navigation)
  datasetRevisionId: uuid // System-set. Reference to the DatasetRevision pinned at creation time
  graderIds: uuid[] // User-selected. List of Grader IDs; at least one required
  status: ExperimentStatus // System-managed. Starts as "queued" on creation
  modelId: string // Required. OpenRouter model ID for the LLM judge (Phase 2)
  promptVersionId: uuid | null // System-set. Pinned PromptVersion ID; null if no prompt selected
  deletedAt: timestamp | null // Soft-delete timestamp; null when active
}
```

**Statuses:**

- `"queued"` — created, waiting for another experiment to finish running
- `"running"` — actively evaluating cells
- `"complete"` — all cells evaluated (some may be in error state)
- `"failed"` — run could not complete or all cells failed

**Constraints:**

- `name` must be non-empty
- `datasetId` must reference an existing `Dataset` whose latest revision has at least one item
- `graderIds` must contain at least one entry; no upper bound
- `status` starts as `"queued"` on creation
- At most two experiments may be `"running"` at a time; others queue
- `datasetRevisionId` references the dataset's latest revision at the time of experiment creation. This reference never changes after creation
- Re-running creates a new `Experiment` with a new `id` and derived `name`; original is preserved
- `modelId` must be a non-empty string; required when creating an experiment
- `promptVersionId` is set at creation time and never changes. If the prompt is later edited or soft-deleted, the pinned version row is unaffected

**Relationships:**

- References one `Dataset` (many-to-one, for grouping/navigation)
- References one `DatasetRevision` (many-to-one, pinned at creation — the frozen item set)
- References one or more `Grader`s (many-to-many via `graderIds[]`)
- Has many `ExperimentResult`s (one-to-many, cascade delete)
- Protected by `onDelete: Restrict` on the Dataset FK — preserved when the dataset is soft-deleted
- Graders are soft-deleted independently — experiments are never affected by grader deletion
- References zero or one `PromptVersion` (many-to-one, optional; `onDelete: Restrict`)

---

#### 6. `ExperimentResult`

One verdict for a single dataset item × grader pair within an experiment.

```ts
type Verdict = 'pass' | 'fail' | 'error'

type ExperimentResult = {
  id: uuid // System-generated
  experimentId: uuid // Owning experiment
  datasetRevisionItemId: uuid // The revision item that was evaluated
  graderId: uuid // The grader used for this evaluation
  verdict: Verdict // "pass", "fail", or "error"
  reason: string // Explanation from the LLM judge; may be empty on "error"
}
```

**Verdict values:**

- `"pass"` — LLM judge determined the item meets the rubric criteria
- `"fail"` — LLM judge determined the item does not meet the rubric criteria
- `"error"` — The evaluation call failed; no verdict was produced

**Constraints:**

- The combination `(experimentId, datasetRevisionItemId, graderId)` is unique — exactly one cell per item × grader per experiment
- `verdict` is always one of the three literal values; never null
- `reason` is a string; empty string `""` is acceptable on error
- Error cells are stored, not discarded
- CSV export represents error cells as the literal string `"error"`

**Relationships:**

- Belongs to exactly one `Experiment` (many-to-one, cascade delete)
- References one `DatasetRevisionItem` and one `Grader` by ID (informational — cascade flows through `Experiment`, not directly)

---

#### 6b. `ExperimentOutput`

One LLM-generated output per dataset item per experiment, produced during Phase 1 of execution. Exists only for experiments with a pinned prompt version.

```ts
type ExperimentOutput = {
  id: uuid // System-generated
  experimentId: uuid // Owning experiment
  datasetRevisionItemId: uuid // The item whose `input` was used as the generation input
  output: string // Raw LLM response text; empty string if generation failed
  error: string | null // Error message if generation failed; null on success
}
```

**Constraints:**

- `(experimentId, datasetRevisionItemId)` is unique — exactly one output record per item per experiment
- `output` is always a string; empty string `""` is valid (model returned nothing or generation failed)
- `error` is null on success, non-null on failure
- Output records are written during Phase 1 as each generation completes
- Output records are never modified after creation — reruns create new records on new experiments
- An item with `error !== null` has its grading cells stored as `verdict: "error"` with the generation error as reason; no LLM grading call is made for that item

**Relationships:**

- Belongs to exactly one `Experiment` (many-to-one, cascade delete when experiment is deleted)
- References one `DatasetRevisionItem` by ID (informational reference)

---

#### 7. `Prompt`

A reusable prompt template pairing system and user prompts with a model configuration. Content lives in immutable versions.

```ts
type Prompt = {
  id: uuid // System-generated
  name: string // User-provided. Non-empty, unique across all active prompts
  deletedAt: timestamp | null // Soft-delete timestamp; null when active
}
```

**Constraints:**

- `name` must be non-empty
- `name` must be unique across all active (non-deleted) prompts. Names can be reused after soft deletion.

**Relationships:**

- Has many `PromptVersion`s (one-to-many, cascade delete)

---

#### 8. `PromptVersion`

An immutable snapshot of a prompt's content at a point in time. Created on every content edit. Never modified after creation.

```ts
type PromptVersion = {
  id: uuid // System-generated
  promptId: uuid // Reference to owning Prompt
  version: number // Auto-incremented per prompt (1, 2, 3…)
  systemPrompt: string // The system message. Required, may be empty string.
  userPrompt: string // The user message template. Required, may be empty string.
  modelId: string // OpenRouter model identifier (e.g. 'anthropic/claude-sonnet-4')
  modelParams: { temperature?: number; maxTokens?: number; topP?: number } // Defaults to {} if not provided
  createdAt: timestamp // System-generated
}
```

**Constraints:**

- `version` starts at 1 when the prompt is created
- `version` increments by 1 on every content edit
- `(promptId, version)` is unique — no two versions of the same prompt share a version number
- `systemPrompt` and `userPrompt` are required but may be empty strings
- `modelId` must be non-empty
- `modelParams` defaults to `{}` if not provided. Valid fields: `temperature` (0–2), `maxTokens` (integer ≥ 1), `topP` (0–1)
- A version is immutable once created — its content is never modified
- The prompt list view's `lastUpdated` is derived from `MAX(PromptVersion.createdAt)` for each prompt — no separate `updatedAt` field on `Prompt`

**Relationships:**

- Belongs to exactly one `Prompt` (many-to-one, cascade delete when prompt is deleted)
- Referenced by many `Experiment`s via `promptVersionId` (one-to-many, `onDelete: Restrict`)

---

### Relationship Diagram

```
Dataset ──< DatasetRevision                  (one-to-many, cascade delete)
DatasetRevision ──< DatasetRevisionItem      (one-to-many, cascade delete)

Dataset ──< Experiment                       (one-to-many via datasetId, onDelete: Restrict)
DatasetRevision ──< Experiment               (one-to-many via datasetRevisionId, pinned at creation)

Grader  ──< Experiment                       (many-to-many via graderIds[], soft delete independent)

Experiment ──< ExperimentResult              (one-to-many, cascade delete)
ExperimentResult >── DatasetRevisionItem     (many-to-one, reference only)
ExperimentResult >── Grader                  (many-to-one, reference only)

Experiment ──< ExperimentOutput              (one-to-many, cascade delete)
ExperimentOutput >── DatasetRevisionItem     (many-to-one, reference only)

Prompt ──< PromptVersion                     (one-to-many, cascade delete)
PromptVersion ──< Experiment                 (one-to-many via promptVersionId, onDelete: Restrict)
```

---

### Deletion Rules

| Entity deleted       | Behavior                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `Dataset`            | Soft-deleted (`deletedAt` set). All revisions, items, experiments, and results preserved. Name available for reuse.                         |
| `Grader`             | Soft-deleted (`deletedAt` set). All experiments and results referencing it preserved. Name available for reuse.                             |
| `Experiment`         | Soft-deleted (`deletedAt` set). All results preserved in the database.                                                                      |
| `DatasetRevision`    | Never deleted individually — preserved even when parent dataset is soft-deleted.                                                            |
| Attribute change     | Creates a new revision; previous revisions are unchanged.                                                                                   |
| Item add/edit/delete | Creates a new revision; previous revisions are unchanged.                                                                                   |
| `Prompt`             | Soft-deleted (`deletedAt` set). All versions preserved. Experiments pinned to a version continue to reference it. Name available for reuse. |
| `ExperimentOutput`   | Cascade-deleted when the parent `Experiment` is soft-deleted. Never deleted individually.                                                   |

---

### System-Generated vs. User-Provided Fields

| Entity                | System-generated                                       | User-provided                                                                                                        |
| --------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `Dataset`             | `id`                                                   | `name`                                                                                                               |
| `DatasetRevision`     | `id`, `schemaVersion`, `createdAt`                     | _(none — system-produced from mutations)_                                                                            |
| `DatasetRevisionItem` | `id`, `itemId`                                         | `values`                                                                                                             |
| `Grader`              | `id`                                                   | `name`, `description`, `rubric`                                                                                      |
| `Experiment`          | `id`, `status`, `datasetRevisionId`, `promptVersionId` | `name`, `datasetId`, `graderIds`, `modelId`, `promptId` (user provides prompt ID; system resolves to latest version) |
| `ExperimentResult`    | `id`, `verdict`, `reason`                              | _(none — fully system-produced)_                                                                                     |
| `ExperimentOutput`    | `id`, `output`, `error`                                | _(none — fully system-produced)_                                                                                     |
| `Prompt`              | `id`                                                   | `name`                                                                                                               |
| `PromptVersion`       | `id`, `version`, `createdAt`                           | `systemPrompt`, `userPrompt`, `modelId`, `modelParams`                                                               |

---

### Key Invariants

1. **Revision immutability:** Once a `DatasetRevision` is created, its `attributes` and all its `DatasetRevisionItem` rows are never modified
2. **Schema conformance:** For every `DatasetRevisionItem` in a revision, the keys of `item.values` equal exactly the entries in `revision.attributes`
3. **Built-in immutability:** No operation may remove `"input"` or `"expected_output"` from any revision's attributes
4. **Name uniqueness:** Dataset names are unique across all active (non-deleted) datasets. Grader names are unique across all active (non-deleted) graders. Names can be reused after soft deletion. Attribute names are unique within a revision's attributes
5. **Non-empty selection:** A dataset whose latest revision has zero items is never available for experiment creation
6. **Concurrency limit:** At most two experiments may have `status === "running"` at any time
7. **Cell uniqueness:** Within an experiment, `(datasetRevisionItemId, graderId)` uniquely identifies exactly one cell
8. **Attribute order stability:** The order of entries in a revision's `attributes` is immutable. `"input"` and `"expected_output"` are always first
9. **Stable item identity:** `DatasetRevisionItem.itemId` tracks the same logical item across revisions. A new `itemId` is generated only when a brand-new item is created
10. **Latest revision:** The current state of a dataset is always its latest revision by `createdAt DESC`. There is no separate mutable working copy
11. **Experiment pinning:** An experiment's `datasetRevisionId` is set at creation time and never changes. Dataset mutations after creation do not affect the experiment
12. **Version immutability:** Once a `PromptVersion` is created, its `systemPrompt`, `userPrompt`, `modelId`, and `modelParams` are never modified
13. **Prompt name uniqueness:** Prompt names are unique across all active (non-deleted) prompts. Names can be reused after soft deletion
14. **Version number uniqueness:** Within a prompt, `(promptId, version)` uniquely identifies exactly one `PromptVersion`. No two versions of the same prompt share a version number
15. **Prompt version pinning:** An experiment's `promptVersionId` is set at creation time and never changes. Editing a prompt after experiment creation (creating a new version) does not affect any existing experiment's `promptVersionId`
16. **Output uniqueness:** Within an experiment, `(experimentId, datasetRevisionItemId)` uniquely identifies exactly one `ExperimentOutput`. Enforced at the database level
17. **Phase ordering:** For experiments with a prompt, all Phase 1 generation tasks complete before any Phase 2 grading task begins. Enforced by the runner — the grading queue does not start until the generation queue drains
18. **Output ownership:** `ExperimentOutput` records belong exclusively to their experiment. Reruns create new output records on the new experiment; original outputs are preserved unchanged

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
  router.ts       # Hono route definitions (CRUD + revision endpoints)
  service.ts      # Business logic, orchestration, revision creation, returns Result<T>
  repository.ts   # Prisma database operations (DatasetRevision, DatasetRevisionItem)
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
  router.ts       # CRUD + GET /:id/events (SSE); creation auto-enqueues runner
  service.ts      # Owns experiment queue, evaluation queue, LLM orchestration, SSE event emission
  repository.ts   # Experiment + ExperimentResult persistence
  validator.ts    # Zod schemas for create, run, etc.
```

```
prompts/
  router.ts       # CRUD + version creation
  service.ts      # Business logic, version management, returns Result<T>
  repository.ts   # Prompt + PromptVersion persistence
  validator.ts    # Zod schemas for create prompt, update name, create version
```

All four modules follow the same pattern. The experiments module has additional responsibilities (queue management, SSE streaming) but they live inside `service.ts` — the route/repository/validator boundaries stay clean.

### Frontend (`apps/web`)

- **Vite** — build tool
- **React 19** — UI framework
- **shadcn/ui** — component library (Base UI v4 primitives via `pnpm dlx shadcn@latest init`)
- **Tailwind CSS v4** — styling
- **TanStack Query** — server state management (queries, mutations, cache)
- **Recharts** — charts for pass rate visualization
- **Lucide React** — icon library

### Shared Packages (`packages/`)

- **`packages/db`** — Prisma schema, migrations, generated client. Both API and (if needed) seed scripts import from here
- **`packages/shared`** — Shared TypeScript utilities:
  - `Result<T, E>` type
  - `ok`, `fail` constructors
  - `tryCatch` helper

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
export type Result<T, E = string> = { success: true; data: T } | { success: false; error: E }

export const ok = <T>(data: T): Result<T, never> => ({ success: true, data })
export const fail = <E = string>(error: E): Result<never, E> => ({ success: false, error })
```

**Usage in services:**

```ts
// datasets/service.ts
const createDataset = async (input: CreateDatasetInput) => {
  const existing = await repository.findByName(input.name)
  if (existing) return fail('Dataset name already exists')

  const dataset = await repository.create(input)
  return ok(dataset)
}
```

**Usage in routes:**

```ts
// datasets/router.ts
app.post('/datasets', async (c) => {
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
- **Custom DataTable component** for all tables (dataset items, graders list, experiment results)
- **Local useState** for form state management
- **Recharts** for aggregate stats charts (pass rates per grader, experiment summary)
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

| Tool            | Init command                            |
| --------------- | --------------------------------------- |
| Monorepo        | `pnpm dlx create-turbo@latest`          |
| API (Hono)      | `pnpm create hono@latest`               |
| Frontend (Vite) | `pnpm dlx create vite@latest`           |
| shadcn/ui       | `pnpm dlx shadcn@latest init`           |
| Prisma          | `pnpm dlx prisma init`                  |
| ESLint          | `pnpm dlx @eslint/create-config@latest` |
| TypeScript      | `pnpm exec tsc --init`                  |

---

## Evaluation Execution Architecture

### Overview

Experiments are executed asynchronously using a queue pattern. When no prompt is attached, the existing **two-level queue** runs (experiment queue → evaluation queue). When a prompt is attached, a **three-level queue** runs (experiment queue → LLM run queue → evaluation queue). The API returns immediately when a run is triggered; processing happens in the background. This is implemented in-process using `p-queue` for the prototype, with a clear migration path to BullMQ + Redis for production.

### Queue Architecture

**Without prompt (existing two-level queue):**

```
HTTP POST /experiments → 201 Created
    │
    ▼
Experiment Queue (concurrency: 2)
    │
    ▼
Evaluation Queue (concurrency: 4)  ← items × graders in parallel
    │
    ▼
LLM Judge call → verdict + reason → ExperimentResult
```

**With prompt (three-level queue):**

```
HTTP POST /experiments → 201 Created
    │
    ▼
Experiment Queue (concurrency: 2)
    │
    ▼
Phase 1 — LLM Run Queue (concurrency: 2)
    │  for each item: substitute {input} → call prompt model → store ExperimentOutput
    │  (all items complete before Phase 2 starts)
    ▼
Phase 2 — Evaluation Queue (concurrency: 4)
    │  for each item × grader: send generated output + expected_output ref → LLM judge
    │  (items that failed Phase 1 skip grading, stored as verdict: "error")
    ▼
LLM Judge call → verdict + reason → ExperimentResult
```

### Level 1: Experiment Queue

- **Concurrency: 2** — up to two experiments run in parallel
- When a run is triggered, the experiment status is set to `"queued"`
- When the queue picks it up, status transitions to `"running"`
- If both slots are occupied, additional experiments wait in `"queued"` status

### Level 2: LLM Run Queue — Phase 1 (only when `promptVersionId` is set)

- **Concurrency: 2** — up to 2 parallel generation calls per experiment
- Created fresh for each experiment run, only when the experiment has a `promptVersionId`
- One task per dataset item — substitutes `{input}` into the prompt's `userPrompt`, calls the prompt's model with `systemPrompt` and `modelParams`, stores `ExperimentOutput`
- Failures are caught per-item: the item's output is stored with `error` set; processing continues for other items
- The entire Phase 1 queue drains (`await Promise.all(tasks)`) before Phase 2 begins
- Items that errored in Phase 1 are not added to Phase 2 grading tasks; their grading cells are immediately written as `verdict: "error"`

### Level 3: Evaluation Queue — Phase 2

- **Concurrency: 4** — up to 4 parallel LLM judge calls per experiment
- Created fresh for each experiment run
- One task per `(datasetItem × grader)` cell — skips items whose Phase 1 output errored
- When prompt is present: sends the stored `output` string as the response to judge; sends `expected_output` as reference context
- When no prompt: sends `expected_output` as the response (unchanged behavior)
- Each task is independent — a failure in one cell does not affect others

### Status Lifecycle

```
POST /experiments (creation auto-enqueues)
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

**Phase 1 — Generation (only when prompt is present)**

- **System message**: The pinned `PromptVersion.systemPrompt`, verbatim
- **User message**: The pinned `PromptVersion.userPrompt` with `{input}` replaced by the item's `input` value
- **Model**: `PromptVersion.modelId` with `PromptVersion.modelParams` (temperature, maxTokens, topP)
- **No structured output**: generation uses `generateText()` without `Output.object()` — the raw text response is stored as-is

**Phase 2 — Grading**

- **System message**: Contains the grader's `rubric` — the judging instructions (unchanged)
- **User message (without prompt)**: Contains the item's `input` + `expected_output` as the response + custom attributes (unchanged)
- **User message (with prompt)**: Contains the item's `input` + generated output labeled as "Response" + `expected_output` labeled as "Reference Output" + custom attributes. The judge evaluates the generated response against the rubric, using the reference as a quality standard.
- **Expected response**: Structured output with `verdict` ("pass" or "fail") and `reason` (string) (unchanged)

### Technology Choice: p-queue

- **Library**: `p-queue` v9.x (in-process, promise-based, 0 dependencies)
- **Why**: Simple, lightweight, built-in concurrency + rate limiting, no external infrastructure
- **Tradeoff**: In-memory only — queued jobs are lost on server restart

### Migration Path to BullMQ

When the prototype outgrows in-process queuing, swap to BullMQ:

| Concern           | p-queue (now)              | BullMQ (later)                   |
| ----------------- | -------------------------- | -------------------------------- |
| Infrastructure    | None                       | Redis required                   |
| Persistence       | In-memory, lost on restart | Redis-backed, survives restarts  |
| Multi-process     | Single process             | Multiple workers across machines |
| Monitoring        | Application logs           | Bull Board dashboard             |
| Rate limiting     | Built-in (`intervalCap`)   | Job options + rate limiter       |
| Dead letter queue | Manual (catch + save)      | Built-in DLQ                     |
| Setup complexity  | ~20 lines                  | ~100 lines + Redis               |

**Migration trigger**: when experiments take >30 min, need multi-server scaling, or need job persistence across restarts.

**Migration strategy**: The service layer (`experiments/service.ts`) owns the queue logic. Swapping p-queue for BullMQ only changes the queue implementation inside the service — routes, repositories, and validators are untouched.

### Real-Time Updates (Server-Sent Events)

The frontend receives live experiment progress via **SSE** using Hono's built-in `streamSSE()` helper. This replaces polling and gives the user immediate feedback as cells complete.

**Endpoint:** `GET /experiments/:id/events`

**Event types:**

| Event       | When emitted              | Payload                                                |
| ----------- | ------------------------- | ------------------------------------------------------ |
| `connected` | Client connects           | `{ experimentId }`                                     |
| `progress`  | After each cell completes | `{ experimentId, status, cellsCompleted, totalCells }` |
| `completed` | Experiment finishes       | `{ experimentId, status, cellsCompleted, totalCells }` |
| `error`     | Experiment fails entirely | `{ experimentId, error }`                              |

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
- **Judge model**: stored per experiment at creation time as `modelId` — required, no fallback. The model is passed directly to the evaluator.

### Structured Output

Each evaluation call uses `generateText()` with `Output.object()` from the Vercel AI SDK to guarantee type-safe structured responses:

```ts
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateText, Output } from 'ai'
import { z } from 'zod'

const verdictSchema = z.object({
  reason: z.string(),
  verdict: z.enum(['pass', 'fail']),
})

const result = await generateText({
  model: openrouter(modelId), // modelId comes from the experiment — required, no fallback
  output: Output.object({ schema: verdictSchema }),
  messages: [
    { role: 'system', content: buildSystemPrompt(rubric) },
    { role: 'user', content: buildUserMessage(itemAttributes) },
  ],
})
// result.output is typed as { verdict: "pass" | "fail", reason: string }
```

### Environment Variables

All environment configuration lives in a single `.env` file at the **monorepo root**. Each app reads from it.

```env
# .env (monorepo root)

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/eval_harness"

# LLM
OPENROUTER_API_KEY="sk-or-v1-..."    # OpenRouter API key

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
    description: 'Create a new dataset'
    command: |
      curl -X POST http://localhost:3001/datasets \
        -H "Content-Type: application/json" \
        -d '{"name": "my-dataset"}'
    expected_status: 201
    expected_body: '{ "success": true, "data": { "id": "...", "name": "my-dataset", "attributes": ["input", "expected_output"] } }'

  create_duplicate_name:
    description: 'Reject duplicate dataset name'
    command: |
      curl -X POST http://localhost:3001/datasets \
        -H "Content-Type: application/json" \
        -d '{"name": "my-dataset"}'
    expected_status: 400
    expected_body: '{ "success": false, "error": "Dataset name already exists" }'

  create_empty_name:
    description: 'Reject empty dataset name'
    command: |
      curl -X POST http://localhost:3001/datasets \
        -H "Content-Type: application/json" \
        -d '{"name": ""}'
    expected_status: 400

  list:
    description: 'List all datasets'
    command: |
      curl http://localhost:3001/datasets
    expected_status: 200

  get:
    description: 'Get dataset by ID with schema and items'
    command: |
      curl http://localhost:3001/datasets/:id
    expected_status: 200

  rename:
    description: 'Rename a dataset'
    command: |
      curl -X PATCH http://localhost:3001/datasets/:id \
        -H "Content-Type: application/json" \
        -d '{"name": "renamed-dataset"}'
    expected_status: 200

  delete:
    description: 'Delete dataset (cascades to items + experiments)'
    command: |
      curl -X DELETE http://localhost:3001/datasets/:id
    expected_status: 200

  add_attribute:
    description: 'Add custom attribute to dataset schema'
    command: |
      curl -X POST http://localhost:3001/datasets/:id/attributes \
        -H "Content-Type: application/json" \
        -d '{"name": "context"}'
    expected_status: 201

  add_duplicate_attribute:
    description: 'Reject duplicate attribute name'
    command: |
      curl -X POST http://localhost:3001/datasets/:id/attributes \
        -H "Content-Type: application/json" \
        -d '{"name": "input"}'
    expected_status: 400

  remove_attribute:
    description: 'Remove custom attribute from schema'
    command: |
      curl -X DELETE http://localhost:3001/datasets/:id/attributes/context
    expected_status: 200

  remove_builtin_attribute:
    description: 'Reject removal of built-in attribute'
    command: |
      curl -X DELETE http://localhost:3001/datasets/:id/attributes/input
    expected_status: 400

dataset_items:
  create:
    description: 'Add item to dataset'
    command: |
      curl -X POST http://localhost:3001/datasets/:id/items \
        -H "Content-Type: application/json" \
        -d '{"values": {"input": "What is 2+2?", "expected_output": "4"}}'
    expected_status: 201

  create_missing_builtin:
    description: 'Item without required built-in attributes'
    command: |
      curl -X POST http://localhost:3001/datasets/:id/items \
        -H "Content-Type: application/json" \
        -d '{"values": {"input": "hello"}}'
    expected_status: 400

  list:
    description: 'List items in a dataset'
    command: |
      curl http://localhost:3001/datasets/:id/items
    expected_status: 200

  update:
    description: 'Edit a dataset item'
    command: |
      curl -X PATCH http://localhost:3001/datasets/:id/items/:itemId \
        -H "Content-Type: application/json" \
        -d '{"values": {"input": "What is 3+3?", "expected_output": "6"}}'
    expected_status: 200

  delete:
    description: 'Remove a dataset item'
    command: |
      curl -X DELETE http://localhost:3001/datasets/:id/items/:itemId
    expected_status: 200

  csv_template:
    description: 'Download CSV template for dataset'
    command: |
      curl http://localhost:3001/datasets/:id/csv/template -o template.csv
    expected_status: 200

  csv_import:
    description: 'Import items from CSV'
    command: |
      curl -X POST http://localhost:3001/datasets/:id/csv/import \
        -F "file=@items.csv"
    expected_status: 200

  csv_export:
    description: 'Export items as CSV'
    command: |
      curl http://localhost:3001/datasets/:id/csv/export -o items.csv
    expected_status: 200

graders:
  create:
    description: 'Create a new grader'
    command: |
      curl -X POST http://localhost:3001/graders \
        -H "Content-Type: application/json" \
        -d '{"name": "accuracy-check", "description": "Checks factual accuracy", "rubric": "Evaluate whether the output matches the expected output. Consider semantic equivalence, not just exact string matching."}'
    expected_status: 201

  create_empty_rubric:
    description: 'Reject grader with empty rubric'
    command: |
      curl -X POST http://localhost:3001/graders \
        -H "Content-Type: application/json" \
        -d '{"name": "bad-grader", "description": "test", "rubric": ""}'
    expected_status: 400

  list:
    description: 'List all graders'
    command: |
      curl http://localhost:3001/graders
    expected_status: 200

  get:
    description: 'Get grader by ID'
    command: |
      curl http://localhost:3001/graders/:id
    expected_status: 200

  update:
    description: 'Edit a grader'
    command: |
      curl -X PATCH http://localhost:3001/graders/:id \
        -H "Content-Type: application/json" \
        -d '{"name": "updated-grader", "rubric": "Updated rubric instructions"}'
    expected_status: 200

  delete:
    description: 'Delete grader (blocked if ExperimentResults reference it — delete experiments first)'
    command: |
      curl -X DELETE http://localhost:3001/graders/:id
    expected_status: 200

experiments:
  create:
    description: 'Create an experiment (automatically enqueued for evaluation)'
    command: |
      curl -X POST http://localhost:3001/experiments \
        -H "Content-Type: application/json" \
        -d '{"name": "eval-run-1", "datasetId": ":datasetId", "graderIds": [":graderId1", ":graderId2"]}'
    expected_status: 201

  create_no_graders:
    description: 'Reject experiment with no graders'
    command: |
      curl -X POST http://localhost:3001/experiments \
        -H "Content-Type: application/json" \
        -d '{"name": "bad-exp", "datasetId": ":datasetId", "graderIds": []}'
    expected_status: 400

  list:
    description: 'List all experiments'
    command: |
      curl http://localhost:3001/experiments
    expected_status: 200

  get:
    description: 'Get experiment with results'
    command: |
      curl http://localhost:3001/experiments/:id
    expected_status: 200

  events:
    description: 'SSE stream for experiment progress'
    command: |
      curl -N http://localhost:3001/experiments/:id/events
    expected_status: 200
    notes: 'Streams SSE events: connected, progress, completed, error'

  delete:
    description: 'Delete experiment and all results'
    command: |
      curl -X DELETE http://localhost:3001/experiments/:id
    expected_status: 200

  csv_export:
    description: 'Export experiment results as CSV'
    command: |
      curl http://localhost:3001/experiments/:id/csv/export -o results.csv
    expected_status: 200
    notes: 'Only available when experiment status is complete'

  rerun:
    description: 'Re-run experiment (creates new experiment)'
    command: |
      curl -X POST http://localhost:3001/experiments/:id/rerun
    expected_status: 201
    notes: 'Creates a new experiment with derived name, original preserved'
```
