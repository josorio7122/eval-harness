# Architecture Reference

## System Overview

Mini-skills is an LLM evaluation harness that lets you measure how well a language model performs against a dataset of input/output pairs. You define **datasets** (versioned collections of items), **graders** (rubric-based judge prompts), and **experiments** (a pairing of a dataset revision + model + graders). When you run an experiment, the harness sends each item to an LLM judge for every attached grader, collects structured pass/fail verdicts, and surfaces the results in a live-updating results table. Every dataset mutation creates an immutable revision so experiments always reference a stable snapshot, and experiments can be re-run against the latest revision at any time. You can also author versioned **prompts** that pair system and user messages with a model configuration, with full version history.

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

Prompt (unique name)
  │
  └── PromptVersion (immutable snapshot, version, systemPrompt, userPrompt, modelId, modelParams)

PromptVersion ──< Experiment (via promptVersionId)
Experiment ──< ExperimentOutput
```

_Dataset, Grader, and Experiment include a `deletedAt` field for soft delete. Soft-deleted records are excluded from all list and lookup queries._

### Entities

| Entity                | Purpose                                                    | Key fields                                                                                                                                         | Constraints                                                                  |
| --------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `Dataset`             | Top-level container for a dataset                          | `id` (UUID), `name`, `deletedAt` (DateTime?)                                                                                                       | `name` UNIQUE among active records (partial index where `deletedAt IS NULL`) |
| `DatasetRevision`     | Immutable snapshot of the dataset at a point in time       | `schemaVersion` (Int), `attributes` (String[]), `createdAt`                                                                                        | No updates — every mutation creates a new revision                           |
| `DatasetRevisionItem` | A single row within a revision                             | `itemId` (UUID, stable), `values` (JSON)                                                                                                           | `itemId` is preserved across revisions to track the same logical row         |
| `Grader`              | Evaluation criterion with rubric text used as judge prompt | `name`, `description`, `rubric`, `deletedAt` (DateTime?)                                                                                           | `name` UNIQUE among active records (partial index where `deletedAt IS NULL`) |
| `Experiment`          | A run definition, pinned to a specific revision            | `name`, `status` (queued/running/complete/failed), `datasetId`, `datasetRevisionId`, `modelId`, `promptVersionId` (UUID?), `deletedAt` (DateTime?) | Status transitions: queued → running → complete/failed                       |
| `ExperimentGrader`    | Junction between Experiment and Grader                     | composite PK `(experimentId, graderId)`                                                                                                            | —                                                                            |
| `ExperimentResult`    | Verdict for one (item × grader) cell                       | `verdict` (String), `reason` (String, default: `""`)                                                                                               | UNIQUE `(experimentId, datasetRevisionItemId, graderId)`                     |
| `ExperimentOutput`    | LLM-generated output for one item within an experiment     | `experimentId` (UUID), `datasetRevisionItemId` (UUID), `output` (String), `error` (String?)                                                        | UNIQUE `(experimentId, datasetRevisionItemId)`                               |
| `Prompt`              | Reusable prompt template with model config                 | `id` (UUID), `name`, `deletedAt` (DateTime?)                                                                                                       | `name` UNIQUE among active records (partial index where `deletedAt IS NULL`) |
| `PromptVersion`       | Immutable snapshot of prompt content                       | `version` (Int), `systemPrompt`, `userPrompt`, `modelId`, `modelParams` (JSON: { temperature?, maxTokens?, topP? }), `createdAt`                   | No updates — every edit creates a new version                                |

### Soft Delete

Dataset, Grader, Experiment, and Prompt use **soft delete** — setting `deletedAt` to the current timestamp instead of removing the record. Child records (revisions, items, results) are never deleted.

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

**Soft-delete a Prompt:**

- Prompt hidden from lists
- All PromptVersions preserved
- Prompt name becomes available for reuse

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

Domains: `datasets/`, `graders/`, `experiments/`, `prompts/`

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
const experimentRunner = createExperimentRunner(experimentRepository, evaluate, generateOutput)
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

Three-level queue using `p-queue`:

```
experimentQueue  (concurrency: 2)   — limits parallel experiments
  ├── genQueue   (concurrency: 2)   — created fresh per experiment run; limits parallel generation calls (Phase 1)
  └── evalQueue  (concurrency: 4)   — created fresh per experiment run; limits parallel grading calls (Phase 2)
```

Flow:

1. `POST /experiments` creates the experiment and immediately calls `runner.enqueue({ experimentId, datasetItems, graders, modelId, promptVersion })`.
2. `runner.enqueue` adds to `experimentQueue`; status starts as `queued`.
3. When the experiment slot opens: status → `running`.
4. **Phase 1 (Generation):** All items are scheduled onto `genQueue` (2 concurrent LLM calls). For each item, the `{input}` placeholder in the prompt's `userPrompt` is substituted and sent to the generation model. Generated outputs are stored as `ExperimentOutput` records.
5. **Phase 2 (Grading):** After all generation calls complete, all item × grader cells are scheduled onto `evalQueue` (4 concurrent LLM calls). Each grading call uses the generated output from Phase 1 as the response to evaluate.
6. On completion: status → `complete` (or `failed` if all cells errored), emit `completed`/`error` event.
7. Progress events are emitted on `experimentEvents` (a Node.js `EventEmitter`) keyed by experiment ID.

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

> **Note:** When a prompt is present, the judge's user message labels the LLM-generated output (from Phase 1) as **"Response"** and includes the item's `expected_output` as **"Reference Output"** — giving the judge context to evaluate correctness without conflating the candidate response with the reference. The judge is explicitly told it is evaluating the generated response, not the reference.

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
/prompts          → PromptsPage  (no :id → PromptList)
/prompts/:id      → PromptsPage  (:id present → PromptDetail)
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
    ├── ExperimentsPage
    │   ├── ExperimentList
    │   └── ExperimentDetail
    │       ├── ExperimentHeader
    │       ├── GraderChart
    │       ├── ResultsFilterBar
    │       ├── ResultsTable
    │       │   └── ResultsTableRow
    │       │       └── VerdictCell
    │       ├── GraderSelector
    │       ├── ModelSelector
    │       ├── StatusBadge
    │       └── Dialogs: CreateExperimentDialog, ExperimentDeleteDialog
    └── PromptsPage
        ├── PromptList
        └── PromptDetail
            ├── PromptHeader (inline name edit + delete action)
            ├── PromptEditor (readOnly prop for past versions)
            ├── PromptVersionHistory
            ├── PlaygroundPanel (slide-over chat interface)
            │   ├── PlaygroundChat
            │   │   └── PlaygroundMessage (× N)
            │   └── PlaygroundInput
            └── Dialogs: CreatePromptDialog, PromptDeleteDialog
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
| `ModelSelector`       | Model dropdown grouped by provider (moved from experiments/) |
| `ModelParams`         | Temperature, maxTokens, topP number inputs                   |

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
| `use-prompts.ts`     | `usePrompts`, `usePrompt`, `useCreatePrompt`, `useUpdatePromptName`, `useCreatePromptVersion`, `useDeletePrompt`          |

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

---

## 4. Prompt Playground Architecture

### Overview

The Prompt Playground is a slide-over chat interface accessible from the prompt detail view. It lets users test any saved prompt version in a multi-turn conversation with token-by-token streaming. Conversations are ephemeral — no database persistence.

### Backend

**New streaming endpoint:**

```
POST /prompts/:id/playground
```

- Accepts the full conversation (prompt version ID + message history)
- Looks up the `PromptVersion` to get `systemPrompt`, `userPrompt`, `modelId`, `modelParams`
- For the first message: substitutes the user's input into `userPrompt` template (replacing `{input}`)
- For follow-up messages: sends messages as-is (no template substitution)
- Streams the LLM response token-by-token using Vercel AI SDK `streamText()`
- Returns a text stream (not SSE) — standard `text/event-stream` for AI SDK streaming
- Separate from the experiment runner — no queuing, processed immediately
- Supports abort via standard HTTP request cancellation

**Module pattern:**

The playground is part of the `prompts/` domain module — no new domain folder needed.

| File                   | Addition                                       |
| ---------------------- | ---------------------------------------------- |
| `prompts/router.ts`    | New `POST /:id/playground` route               |
| `prompts/validator.ts` | New Zod schemas for playground request         |
| `prompts/service.ts`   | New method to resolve version + build messages |

**Request shape:**

```typescript
{
  versionId: string // UUID of the PromptVersion to use
  messages: Array<{
    // Full conversation history
    role: 'user' | 'assistant'
    content: string
  }>
  isFirstMessage: boolean // Whether to apply {input} template substitution
}
```

**Streaming flow:**

1. Validate request (version exists, messages non-empty)
2. Fetch `PromptVersion` (systemPrompt, userPrompt, modelId, modelParams)
3. Build messages array:
   - System message: `PromptVersion.systemPrompt`
   - If `isFirstMessage`: substitute first user message into `userPrompt` template
   - Otherwise: pass messages as-is
4. Call `streamText()` with OpenRouter model + built messages
5. Pipe the text stream directly to the HTTP response

### Frontend

**New components (in `components/prompts/`):**

| Component                | Responsibility                                                        |
| ------------------------ | --------------------------------------------------------------------- |
| `playground-panel.tsx`   | Slide-over container, open/close state, version picker                |
| `playground-chat.tsx`    | Message list rendering, auto-scroll, system prompt display            |
| `playground-input.tsx`   | Text input, send button, stop button, disabled state during streaming |
| `playground-message.tsx` | Single message bubble (user or assistant), streaming text display     |

**New hook:**

| Hook                | Purpose                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `use-playground.ts` | Manages conversation state, streaming via Vercel AI SDK `useChat` (from `@ai-sdk/react`), version selection, reset |

**State management:**

- All conversation state is local (React state) — not in TanStack Query cache
- `useChat` from Vercel AI SDK handles streaming, message accumulation, and abort
- Version selection triggers state reset (clear messages, update version ID)
- No server-side state — the full message history is sent with every request

**Integration with prompt detail:**

- Playground button added to `PromptHeader` or `PromptEditor`
- Panel overlays from the right, does not navigate away from prompt detail
- Prompt detail remains interactive underneath (user can view version history, etc.)

### Key Design Decisions

1. **`streamText()` not `generateText()`** — playground uses streaming for real-time token display, unlike experiments which use `generateText()` for batch processing
2. **No new database entities** — conversations are ephemeral, stored only in browser memory
3. **Full history sent per request** — stateless server; client owns conversation state
4. **Same module, not new domain** — playground is a prompt feature, not a standalone domain
5. **Vercel AI SDK `useChat` on frontend** — handles streaming protocol, message state, and abort natively
