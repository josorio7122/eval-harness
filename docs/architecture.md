# Architecture Reference

## System Overview

Mini-skills is an LLM evaluation harness that lets you measure how well a language model performs against a dataset of input/output pairs. You define **datasets** (versioned collections of items), **graders** (rubric-based judge prompts), and **experiments** (a pairing of a dataset revision + model + graders). When you run an experiment, the harness sends each item to an LLM judge for every attached grader, collects structured pass/fail verdicts, and surfaces the results in a live-updating results table. Every dataset mutation creates an immutable revision so experiments always reference a stable snapshot, and experiments can be re-run against the latest revision at any time.

## 1. Data Model

### Entity Relationship Diagram

```
Dataset (unique name)
  │
  ├── DatasetRevision (immutable snapshot, schemaVersion, attributes[])
  │     │
  │     └── DatasetRevisionItem (itemId stable across revisions, values JSON)
  │                │
  │                └── ExperimentResult ──────────────────────┐
  │                                                            │
  ├── Experiment (pins to Dataset + DatasetRevision, status)  │
  │     │                                                      │
  │     ├── ExperimentGrader ◄──── Grader (unique name,       │
  │     │                               rubric)               │
  │     └── ExperimentResult ──────────────────────── Grader ─┘
```

_Dataset, Grader, and Experiment include a `deletedAt` field for soft delete. Soft-deleted records are excluded from all list and lookup queries._

### Entities

| Entity                | Purpose                                                    | Key fields                                                                                                              | Constraints                                                                  |
| --------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `Dataset`             | Top-level container for a dataset                          | `id` (UUID), `name`, `deletedAt` (DateTime?)                                                                            | `name` UNIQUE among active records (partial index where `deletedAt IS NULL`) |
| `DatasetRevision`     | Immutable snapshot of the dataset at a point in time       | `schemaVersion` (Int), `attributes` (String[]), `createdAt`                                                             | No updates — every mutation creates a new revision                           |
| `DatasetRevisionItem` | A single row within a revision                             | `itemId` (UUID, stable), `values` (JSON)                                                                                | `itemId` is preserved across revisions to track the same logical row         |
| `Grader`              | Evaluation criterion with rubric text used as judge prompt | `name`, `description`, `rubric`, `deletedAt` (DateTime?)                                                                | `name` UNIQUE among active records (partial index where `deletedAt IS NULL`) |
| `Experiment`          | A run definition, pinned to a specific revision            | `name`, `status` (queued/running/complete/failed), `datasetId`, `datasetRevisionId`, `modelId`, `deletedAt` (DateTime?) | Status transitions: queued → running → complete/failed                       |
| `ExperimentGrader`    | Junction between Experiment and Grader                     | composite PK `(experimentId, graderId)`                                                                                 | —                                                                            |
| `ExperimentResult`    | Verdict for one (item × grader) cell                       | `verdict` (String), `reason` (String, default: `""`)                                                                    | UNIQUE `(experimentId, datasetRevisionItemId, graderId)`                     |

### Soft Delete

Dataset, Grader, and Experiment use **soft delete** — setting `deletedAt` to the current timestamp instead of removing the record. Child records (revisions, items, results) are never deleted.

**Soft-delete a Dataset:**

- Dataset hidden from lists and dropdowns
- All DatasetRevisions and items preserved
- All Experiments referencing this dataset preserved with their results
- Dataset name becomes available for reuse

**Soft-delete a Grader:**

- Grader hidden from lists and dropdowns
- All Experiments that used this grader preserved with their results
- Grader name becomes available for reuse

**Soft-delete an Experiment:**

- Experiment hidden from the list
- All ExperimentResults preserved in the database

> **Foreign key safety:** `Experiment.datasetId` uses `onDelete: Restrict` — a hard delete of a Dataset (bypassing the app layer) is blocked if experiments reference it. `ExperimentResult.graderId` uses `onDelete: Restrict` — a hard delete of a Grader is blocked if results reference it.

### Key Invariants

| Invariant             | Enforcement                                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Revision immutability | No UPDATE on `DatasetRevision` or `DatasetRevisionItem` — every dataset mutation creates a new revision                                      |
| Stable `itemId`       | When a new revision is created from an existing one, rows carry forward the same `itemId` UUID to track identity across revisions            |
| Experiment pinning    | `Experiment.datasetRevisionId` is set at creation time and never changed — a re-run creates a new `Experiment` pinned to the latest revision |
| Cell uniqueness       | `ExperimentResult` has a UNIQUE constraint on `(experimentId, datasetRevisionItemId, graderId)` — one verdict per cell                       |

---

## 2. Backend Architecture

**Stack:** Hono + Node.js + Prisma + PostgreSQL  
**Entry point:** `apps/api/src/index.ts`

### Layered Module Pattern

```
Router  (Hono routes, Zod validation, HTTP status mapping)
  ↓
Service (business logic, composes repo calls, returns Result<T>)
  ↓
Repository (Prisma queries wrapped in tryCatch, returns Result<T>)
```

Each domain has four files:

| File            | Responsibility                                                                      |
| --------------- | ----------------------------------------------------------------------------------- |
| `validator.ts`  | Zod schemas for request bodies                                                      |
| `repository.ts` | Prisma queries; every method returns `Result<T>` via `tryCatch`                     |
| `service.ts`    | Business logic; factory function `createXService(repo, ...)` for DI                 |
| `router.ts`     | HTTP layer; factory function `createXRouter(service)`; maps `Result` to HTTP status |

Domains: `datasets/`, `graders/`, `experiments/`

### Result Pattern

Defined in `packages/shared/src/result.ts`, exported from `@eval-harness/shared`:

```typescript
type Result<T, E = string> = { success: true; data: T } | { success: false; error: E }

const ok = <T>(data: T): Result<T, never> => ({ success: true, data })
const fail = <E>(error: E): Result<never, E> => ({ success: false, error })

async function tryCatch<T>(fn: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof Error) {
      // Prisma not-found errors (findUniqueOrThrow / findFirstOrThrow)
      if (e.name === 'NotFoundError' || ('code' in e && e.code === 'P2025')) {
        return fail('Record not found')
      }
      return fail(e.message)
    }
    return fail('Unknown error')
  }
}
```

- Repositories use `findUniqueOrThrow` / `findFirstOrThrow` — Prisma throws on not-found, `tryCatch` converts to `fail()`.
- Services wrap compound logic in `tryCatch`; propagate repo failures with `if (!result.success) return result`.
- Routers check `result.success` and return appropriate HTTP status codes (400/404 on failure, 200/201/202 on success).

### Dependency Injection

Services are constructed as factory functions in `index.ts`:

```typescript
const experimentRunner = createExperimentRunner(experimentRepository, evaluate)
const experimentService = createExperimentService({
  repo: experimentRepository,
  datasetRepo: datasetRepository,
  graderRepo: graderRepository,
  runner: experimentRunner,
})
const experimentRouter = createExperimentRouter(experimentService)
```

### Experiment Runner

`apps/api/src/experiments/runner.ts`

Two-level queue using `p-queue`:

```
experimentQueue  (concurrency: 2)   — limits parallel experiments
  └── evalQueue  (concurrency: 4)   — created fresh per experiment run; limits parallel LLM calls
```

Flow:

1. `POST /experiments` creates the experiment and immediately calls `runner.enqueue({ experimentId, datasetItems, graders, modelId })`.
2. `runner.enqueue` adds to `experimentQueue`; status starts as `queued`.
3. When the experiment slot opens: status → `running`, a new `evalQueue` is created for this run, emit `progress` events per cell.
4. All item × grader cells are scheduled onto `evalQueue` (4 concurrent LLM calls).
5. On completion: status → `complete` (or `failed` if all cells errored), emit `completed`/`error` event.
6. Progress events are emitted on `experimentEvents` (a Node.js `EventEmitter`) keyed by experiment ID.

### Evaluator

`apps/api/src/experiments/evaluator.ts`

- Provider: OpenRouter via `@openrouter/ai-sdk-provider`
- SDK: Vercel AI SDK `generateText` with `Output.object` (structured output)
- Model: accepts `modelId` as a parameter sourced from `experiment.modelId`. Uses the experiment's `modelId` directly — required, no fallback.
- Output schema: `{ reason: string, verdict: enum('pass', 'fail') }` (Zod)

**Model flow:**

```
Experiment.modelId
  → runner passes modelId to evaluate()
    → evaluator calls openrouter(modelId)
      → OpenRouter API
```

### Judge Template System

`apps/api/src/experiments/judge-template.ts`

Two templates with `{variable}` placeholders replaced via `String.prototype.replace()`:

| Template          | Placeholders                                | Produced by                        |
| ----------------- | ------------------------------------------- | ---------------------------------- |
| `SYSTEM_TEMPLATE` | `{rubric}`                                  | `buildSystemPrompt(rubric)`        |
| `USER_TEMPLATE`   | `{input}`, `{expected_output}`, `{context}` | `buildUserMessage(itemAttributes)` |

Required item attributes: `input`, `expected_output`. Any additional attributes are rendered as a `## Additional Context` section appended to the user message.

> **Note:** The `expected_output` attribute is rendered in the prompt under the heading **"Response"** — not as "expected_output". This is intentional: the judge sees it as the candidate response to evaluate, without framing that reveals the test structure.

### SSE (Server-Sent Events)

`GET /experiments/:id/events` — Hono `streamSSE` endpoint.

Event types emitted over the stream:

| Event       | Payload                                          |
| ----------- | ------------------------------------------------ |
| `connected` | `{ experimentId }`                               |
| `progress`  | `{ cellsCompleted, totalCells, status, result }` |
| `completed` | `{ cellsCompleted, totalCells, status }`         |
| `error`     | `{ error }`                                      |

The SSE handler attaches a listener to `experimentEvents` (the shared `EventEmitter`). It removes the listener and closes the stream on `completed`, `error`, or client disconnect (`stream.onAbort`).

**CSV export:** `GET /experiments/:id/csv/export` streams the full results table as a CSV file (one row per item × grader cell), suitable for offline analysis.

---

## 3. Frontend Architecture

**Stack:** React 19 + Vite + React Router + TanStack Query + shadcn/ui + Tailwind CSS  
**Entry point:** `apps/web/src/App.tsx`

### Routing

```
/                 → redirect to /datasets
/datasets         → DatasetsPage   (no :id → DatasetList)
/datasets/:id     → DatasetsPage   (:id present → DatasetDetail)
/graders          → GradersPage    (no :id → GraderList)
/graders/:id      → GradersPage    (:id present → GraderDetail)
/experiments      → ExperimentsPage (no :id → ExperimentList)
/experiments/:id  → ExperimentsPage (:id present → ExperimentDetail)
```

Pages are thin routers — they read `:id` from `useParams` and render either a list or a detail component. No logic beyond that.

### Component Hierarchy

```
App
└── Layout (sidebar nav + outlet)
    ├── DatasetsPage
    │   ├── DatasetList
    │   └── DatasetDetail
    │       ├── DatasetHeader
    │       ├── DatasetSchemaPanel
    │       │   ├── RevisionListPanel
    │       │   └── RevisionDetailPanel
    │       ├── DatasetItemsTable
    │       ├── RevisionHistory
    │       └── Dialogs: AddAttributeDialog, AddItemDialog, CreateDatasetDialog, DatasetCsvDialog, DatasetDeleteDialog
    ├── GradersPage
    │   ├── GraderList
    │   └── GraderDetail
    │       ├── GraderForm
    │       └── Dialogs: CreateGrader, GraderDelete
    └── ExperimentsPage
        ├── ExperimentList
        └── ExperimentDetail
            ├── ExperimentHeader
            ├── GraderChart
            ├── ResultsFilterBar
            ├── ResultsTable
            │   └── ResultsTableRow
            │       └── VerdictCell
            ├── GraderSelector
            ├── ModelSelector
            ├── StatusBadge
            └── Dialogs: CreateExperimentDialog, ExperimentDeleteDialog
```

**Shared components** (`components/shared/`):

| Component             | Purpose                                                      |
| --------------------- | ------------------------------------------------------------ |
| `DataTable`           | Generic column-keyed table                                   |
| `PageHeader`          | Back-button + breadcrumb strip                               |
| `SectionLabel`        | Typography primitive (`text-[10px] font-semibold uppercase`) |
| `EmptyState`          | Placeholder when a list is empty                             |
| `ListSkeleton`        | Loading skeleton for lists                                   |
| `ConfirmDeleteDialog` | Reusable delete confirmation dialog                          |

### State Management

- **Server state:** TanStack Query — all API data lives in the query cache. `staleTime: 5000ms`, `retry: 1`.
- **UI state:** local `useState` — dialogs open/closed, form inputs, transient progress.
- **No global client state store** (no Zustand, no Context for data).

Query hooks per domain (`hooks/use-*.ts`):

| Hook file            | Key hooks                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `use-datasets.ts`    | `useDatasets`, `useDataset`, `useCreateDataset`, `useAddAttribute`, `useAddItem`, `useDeleteDataset`, `useImportCsv`      |
| `use-graders.ts`     | `useGraders`, `useGrader`, `useCreateGrader`, `useUpdateGrader`, `useDeleteGrader`                                        |
| `use-experiments.ts` | `useExperiments`, `useExperiment`, `useCreateExperiment`, `useRerunExperiment`, `useDeleteExperiment`, `useExperimentSSE` |

### Results Table

`components/experiments/results-table.tsx` — the core experiment view.

- Rows: dataset items (from the pinned revision)
- Columns: one pair `{grader}_verdict` / `{grader}_reason` per attached grader
- Each cell is a `VerdictCell` showing `pass` / `fail` / `error` with the reason on hover

### SSE Integration

`useExperimentSSE(experimentId, status)` in `use-experiments.ts`:

- Opens an `EventSource` only when `status === 'running'`.
- On `progress`: updates the query cache for `['experiments', id]` by appending the new `ExperimentResult` (deduplicates by `id`).
- On `error`: invalidates only `['experiments', id]` (not the list).
- On `completed`: invalidates both `['experiments', id]` and `['experiments']` to trigger a fresh fetch, then closes the `EventSource`.
- On unmount or status change away from `running`: closes the `EventSource`.
- Falls back to polling (`refetchInterval: 2000ms`) when `status` is `queued` or `running` (both pre-start and in-progress), acting as a safety net if SSE is unavailable.
- Returns `{ cellsCompleted, totalCells }` for progress display.
