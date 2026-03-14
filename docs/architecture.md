# Architecture Reference

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

### Entities

| Entity                | Purpose                                                    | Key fields                                                                          | Constraints                                                          |
| --------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `Dataset`             | Top-level container for a dataset                          | `id` (UUID), `name`                                                                 | `name` UNIQUE                                                        |
| `DatasetRevision`     | Immutable snapshot of the dataset at a point in time       | `schemaVersion` (Int), `attributes` (String[]), `createdAt`                         | No updates — every mutation creates a new revision                   |
| `DatasetRevisionItem` | A single row within a revision                             | `itemId` (UUID, stable), `values` (JSON)                                            | `itemId` is preserved across revisions to track the same logical row |
| `Grader`              | Evaluation criterion with rubric text used as judge prompt | `name`, `description`, `rubric`                                                     | `name` UNIQUE                                                        |
| `Experiment`          | A run definition, pinned to a specific revision            | `name`, `status` (queued/running/complete/failed), `datasetId`, `datasetRevisionId` | Status transitions: queued → running → complete/failed               |
| `ExperimentGrader`    | Junction between Experiment and Grader                     | composite PK `(experimentId, graderId)`                                             | —                                                                    |
| `ExperimentResult`    | Verdict for one (item × grader) cell                       | `verdict` (String), `reason` (String)                                               | UNIQUE `(experimentId, datasetRevisionItemId, graderId)`             |

### Cascade Delete Chains

```
DELETE Dataset
  → Experiment (Cascade)
    → ExperimentGrader (Cascade)
    → ExperimentResult (Cascade)
  → DatasetRevision (Cascade)
    → DatasetRevisionItem (Cascade)
      → ExperimentResult (Cascade)

DELETE Grader
  → ExperimentGrader (Cascade)
  → ExperimentResult (Restrict)   ← grader cannot be deleted while results reference it

DELETE Experiment
  → ExperimentGrader (Cascade)
  → ExperimentResult (Cascade)

DELETE DatasetRevision
  → DatasetRevisionItem (Cascade)
    → ExperimentResult (Cascade)
```

> **Note:** `ExperimentResult.grader` uses `onDelete: Restrict`. A grader with existing results cannot be deleted — the results must be removed first (by deleting the experiment).

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
    return fail(e instanceof Error ? e.message : 'Unknown error')
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
const experimentService = createExperimentService(
  experimentRepository,
  datasetRepository, // cross-domain repo dependency
  graderRepository, // cross-domain repo dependency
  experimentRunner,
)
const experimentRouter = createExperimentRouter(experimentService)
```

### Experiment Runner

`apps/api/src/experiments/runner.ts`

Two-level queue using `p-queue`:

```
experimentQueue  (concurrency: 2)   — limits parallel experiments
  └── evalQueue  (concurrency: 4)   — limits parallel LLM calls per experiment
```

Flow:

1. `runner.enqueue(experimentId, items, graders)` adds to `experimentQueue`.
2. When the experiment slot opens: status → `running`, emit `progress` events per cell.
3. All item × grader cells are scheduled onto `evalQueue` (4 concurrent LLM calls).
4. On completion: status → `complete` (or `failed` if all cells errored), emit `completed`/`error` event.
5. Progress events are emitted on `experimentEvents` (a Node.js `EventEmitter`) keyed by experiment ID.

### Evaluator

`apps/api/src/experiments/evaluator.ts`

- Provider: OpenRouter via `@openrouter/ai-sdk-provider`
- SDK: Vercel AI SDK `generateText` with `Output.object` (structured output)
- Model: `LLM_JUDGE_MODEL` env var (default: `google/gemini-2.5-flash-preview`)
- Output schema: `{ reason: string, verdict: enum('pass', 'fail') }` (Zod)

### Judge Template System

`apps/api/src/experiments/judge-template.ts`

Two templates with `{variable}` placeholders replaced via `String.prototype.replace()`:

| Template          | Placeholders                                | Produced by                        |
| ----------------- | ------------------------------------------- | ---------------------------------- |
| `SYSTEM_TEMPLATE` | `{rubric}`                                  | `buildSystemPrompt(rubric)`        |
| `USER_TEMPLATE`   | `{input}`, `{expected_output}`, `{context}` | `buildUserMessage(itemAttributes)` |

Required item attributes: `input`, `expected_output`. Any additional attributes are rendered as a `## Additional Context` section appended to the user message.

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
    │       └── Dialogs: AddAttribute, AddItem, CreateDataset, DatasetCsv, DatasetDelete
    ├── GradersPage
    │   ├── GraderList
    │   └── GraderDetail
    │       ├── GraderForm
    │       └── Dialogs: CreateGrader, GraderDelete
    └── ExperimentsPage
        ├── ExperimentList
        └── ExperimentDetail
            ├── ExperimentHeader
            ├── AggregateStats
            ├── ResultsTable
            │   └── VerdictCell
            └── Dialogs: CreateExperiment, ExperimentDelete
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

| Hook file            | Key hooks                                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `use-datasets.ts`    | `useDatasets`, `useDataset`, `useCreateDataset`, `useAddAttribute`, `useAddItem`, `useDeleteDataset`, `useImportCsv`                          |
| `use-graders.ts`     | `useGraders`, `useGrader`, `useCreateGrader`, `useUpdateGrader`, `useDeleteGrader`                                                            |
| `use-experiments.ts` | `useExperiments`, `useExperiment`, `useCreateExperiment`, `useRunExperiment`, `useRerunExperiment`, `useDeleteExperiment`, `useExperimentSSE` |

### Results Table

`components/experiments/results-table.tsx` — the core experiment view.

- Rows: dataset items (from the pinned revision)
- Columns: one pair `{grader}_verdict` / `{grader}_reason` per attached grader
- Each cell is a `VerdictCell` showing `pass` / `fail` / `error` with the reason on hover

### SSE Integration

`useExperimentSSE(experimentId, status)` in `use-experiments.ts`:

- Opens an `EventSource` only when `status === 'running'`.
- On `progress`: updates the query cache for `['experiments', id]` by appending the new `ExperimentResult` (deduplicates by `id`).
- On `completed`/`error`: invalidates both `['experiments', id]` and `['experiments']` to trigger a fresh fetch, then closes the `EventSource`.
- On unmount or status change away from `running`: closes the `EventSource`.
- Falls back to polling (`refetchInterval: 2000ms`) when `status` is `queued` or `running`, acting as a safety net if SSE is unavailable.
- Returns `{ cellsCompleted, totalCells }` for progress display.
