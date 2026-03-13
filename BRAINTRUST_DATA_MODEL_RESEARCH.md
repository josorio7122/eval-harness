# Braintrust Data Model Research

## Research: Braintrust Dataset, Row, and Experiment Versioning with `_xact_id`

### Answer

Braintrust uses a **transaction-based versioning model** where every insert, update, and delete operation generates a unique monotonically-increasing `_xact_id` (transaction ID). Datasets are stored as **append-only event logs** — when a row is updated, the old row remains with its `_xact_id`, and a new row with the same `id` is inserted with a higher `_xact_id`. To fetch a dataset at a specific version, you query up to a maximum `_xact_id` (the version parameter). Experiments pin to `dataset_version` which is a transaction ID, allowing reproducible evaluation runs.

### Key Findings

#### 1. **`_xact_id` is the Core Versioning Mechanism**

- `_xact_id` is a **unique transaction ID** for every network operation that processes an event insertion (insert/update/delete)
- IDs are **monotonically increasing over time**
- Used to retrieve versioned snapshots of datasets via the `version` parameter
- When fetching dataset events, you can specify `max_xact_id` to get events as they existed at that point in time
- **Sources:** Braintrust API docs (fetch-dataset-post-form), SDK code on GitHub #857 (prompt versions)

#### 2. **Dataset Rows Support Insert, Update, Delete (Event Log Model)**

- Each dataset row has fields: `id`, `_xact_id`, `created`, `input`, `expected`, `metadata`, `tags`, `span_id`, `root_span_id`, `origin`
- When you **insert** a row: creates new row with unique `id` and assigned `_xact_id`
- When you **update** a row: inserts a new record with the same `id` but **higher `_xact_id`** — doesn't replace the old row
- When you **delete** a row: marks with `_object_delete=true` (soft delete, records remain in history)
- The dataset table itself is **append-only**: old versions remain accessible by filtering on `_xact_id`
- **Source:** Insert dataset events API, Fetch dataset API, SDK PR #368 ("Added `update` method to datasets")

#### 3. **Merge Semantics for Updates**

- The SDK provides **`_is_merge` flag** to control update behavior:
  - `_is_merge=false` (default): complete replacement of existing row with same `id`
  - `_is_merge=true`: deep merge new data into existing row (keeping unspecified fields)
- Supports **`_merge_paths`** to control depth of merge — paths below merge boundaries are replaced instead of merged
- Supports **`_array_delete`** to remove specific values from array fields during merge
- **Source:** Insert dataset events API schema (InsertDatasetEvent)

#### 4. **Experiment Dataset Versioning**

- Experiments have a `dataset_version` field (type: string) that pins to a specific `_xact_id`
- When an experiment is created or run, it stores the `_xact_id` of the dataset as it existed at that moment
- To reproduce an experiment, you fetch the dataset with `version=<stored_xact_id>`
- **Source:** Get experiment API returns `dataset_version`, Datasets guide mentions "pin evaluations to a specific version of the dataset via the SDK"

#### 5. **How to Query "Dataset at Version X"**

```
POST /v1/dataset/{dataset_id}/fetch
{
  "version": "<xact_id_string>",  // e.g., "1234567890"
  "limit": 100
}
```

- The `version` parameter filters results to only include rows where `_xact_id <= version`
- Since the table is append-only, you get the **latest version of each row as of that transaction ID**
- For pagination: `max_xact_id` and `max_root_span_id` form a tuple used to paginate from latest to earliest
- **Source:** FetchEventsRequest schema, FetchLimit documentation

#### 6. **Pagination and Time-Ordered Results**

- Fetch queries return results in **descending time order** (latest `_xact_id` first)
- Pagination uses **cursor-based navigation** via `cursor` field (deprecated: manually construct from `max_xact_id` + `max_root_span_id`)
- Important: pagination across version history means **later pages may return duplicate `id` values** with earlier `_xact_id` — this is expected behavior when traversing history
- You should **deduplicate by `id`** and keep only the latest `_xact_id` for current-version queries
- **Source:** FetchLimit documentation

#### 7. **No Separate Events/Log Table**

- Braintrust uses a **single append-only table per dataset**
- All insert, update, delete operations are recorded as new rows in the same table
- Soft deletes use `_object_delete=true` flag (no separate tombstone table)
- **Source:** Dataset structure documentation, API design (single INSERT endpoint, single FETCH endpoint)

### Data Model Reconstruction

```sql
-- DATASET (metadata)
CREATE TABLE datasets (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  name VARCHAR NOT NULL,
  description TEXT,
  created TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  user_id UUID,
  metadata JSONB,
  url_slug VARCHAR UNIQUE,
  -- Unique within project
  UNIQUE(project_id, name)
);

-- DATASET_EVENTS (append-only log)
-- Every insert/update/delete creates a new row
CREATE TABLE dataset_events (
  -- Surrogate key for the event record itself
  _event_id BIGSERIAL PRIMARY KEY,

  -- User-provided row ID (can be repeated across versions)
  id VARCHAR NOT NULL,

  -- Transaction ID: monotonically increasing, unique per operation
  _xact_id BIGINT NOT NULL UNIQUE,

  -- Foreign keys
  dataset_id UUID NOT NULL,
  project_id UUID NOT NULL,

  -- Data fields
  input JSONB,
  expected JSONB,
  metadata JSONB,
  tags TEXT[] NULL,
  created TIMESTAMP NOT NULL,

  -- Span/tracing fields
  span_id VARCHAR NOT NULL,
  root_span_id VARCHAR NOT NULL,
  _pagination_key VARCHAR NULL,  -- Stable time-ordered key

  -- Origin tracking (when copied from other objects)
  origin JSONB NULL, -- {object_type, object_id, id, _xact_id, created}

  -- Soft delete flag
  _object_delete BOOLEAN DEFAULT FALSE,

  -- Merge metadata
  _is_merge BOOLEAN DEFAULT FALSE,
  _merge_paths TEXT[][] NULL,
  _array_delete JSONB NULL,

  -- Audit/comments
  comments JSONB[] NULL,
  audit_data JSONB[] NULL,
  facets JSONB NULL,

  -- Indexes
  INDEX idx_dataset_id (dataset_id),
  INDEX idx_id_xact (id, _xact_id DESC),  -- For deduplication
  INDEX idx_xact_id (dataset_id, _xact_id DESC),  -- For versioning
  INDEX idx_root_span_id (root_span_id)
);

-- EXPERIMENTS (references dataset versions)
CREATE TABLE experiments (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  name VARCHAR NOT NULL,
  dataset_id UUID,
  dataset_version VARCHAR NULL,  -- Stores _xact_id of dataset at time of experiment
  created TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  -- ... other experiment fields
  UNIQUE(project_id, name)
);

-- QUERY: Get dataset as it was at version X
SELECT * FROM dataset_events
WHERE dataset_id = $1
  AND _xact_id <= $2
  AND _object_delete IS FALSE
ORDER BY id, _xact_id DESC;
-- Deduplicate by id, keeping max _xact_id for each

-- QUERY: Insert new row
INSERT INTO dataset_events (id, _xact_id, dataset_id, ...)
VALUES ($1, nextval('xact_id_seq'), $2, ...);

-- QUERY: Update existing row (creates new row with same id, higher _xact_id)
-- Option 1: Replace (default)
INSERT INTO dataset_events (id, _xact_id, dataset_id, ...)
VALUES ($1, nextval('xact_id_seq'), $2, ...);

-- Option 2: Merge (_is_merge=true)
-- Application-level logic merges old row's data with new row's data
-- Then inserts merged result

-- QUERY: Soft delete
INSERT INTO dataset_events (id, _xact_id, dataset_id, _object_delete, ...)
VALUES ($1, nextval('xact_id_seq'), $2, TRUE, ...);
```

### How Version Pinning Works

```typescript
// When experiment is created
const experiment = await client.experiments.create({
  project_id: 'proj_123',
  dataset_id: 'ds_456',
  dataset_version: '1234567890', // Captured _xact_id at creation time
  name: 'eval_run_1',
})

// Later, to reproduce the experiment with exact same dataset version
const dataset = await client.datasets.fetch({
  dataset_id: 'ds_456',
  version: experiment.dataset_version, // Re-fetch at original _xact_id
})
```

### Why This Design?

1. **Immutable history**: All versions remain queryable — no data loss, audit trail complete
2. **Reproducibility**: Pin experiments to exact dataset versions via `_xact_id`
3. **Scalability**: Append-only log avoids UPDATE/DELETE locks, supports high-throughput writes
4. **Simplicity**: Single table for all operations (insert/update/delete) — no complex merging logic in database
5. **Flexibility**: Merge semantics handled in application, not SQL — supports arbitrary merge strategies per use case

### Sources

- **Braintrust API Reference**: Datasets endpoints
  - https://braintrust.dev/docs/api-reference/datasets/insert-dataset-events
  - https://braintrust.dev/docs/api-reference/datasets/fetch-dataset-get-form
  - https://braintrust.dev/docs/api-reference/datasets/fetch-dataset-post-form
  - https://braintrust.dev/docs/api-reference/experiments/get-experiment

- **SDK Documentation**: Prompt versions & merge operations
  - https://github.com/braintrustdata/braintrust-sdk/pull/857 (prompt versioning with \_xact_id)
  - https://github.com/braintrustdata/braintrust-sdk/pull/368 (dataset update with merge)
  - https://github.com/braintrustdata/braintrust-sdk/pull/90 (trace view editing, merge paths)

- **User Docs**: Datasets and Versioning
  - https://braintrust.dev/docs/annotate/datasets
  - https://matt-otel-docs.preview.braintrust.dev/docs/guides/datasets (mentions versioned snapshots)

- **SDK Reference**: Go evaluation SDK shows Version() method on datasets
  - https://pkg.go.dev/github.com/braintrustdata/braintrust-sdk-go/eval

- **Elixir SDK Docs**: Shows xact_id and version parameters
  - https://hexdocs.pm/braintrust/Braintrust.Function.html
