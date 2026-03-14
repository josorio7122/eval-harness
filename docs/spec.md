# Lightweight Eval Harness — Specification

## Goal

When this system is complete, a user can manage datasets of structured test cases, define graders with rubrics that instruct an LLM judge, and run experiments that evaluate every dataset item against selected graders — producing a pass/fail verdict and reason for each item–grader pair. Results are displayed in a table with per-grader pass rates, per-item pass summaries, and overall experiment statistics. The user can filter results by outcome, import and export dataset items via CSV, and export experiment results as CSV. All state persists in-memory for the session.

## Behaviors

**Datasets**

- **DatasetList:** When the user navigates to the dataset area, they see a list of all existing datasets, each identified by its user-given name.
- **DatasetCreate:** When the user submits a name for a new dataset, that dataset appears in the list immediately. It starts with two built-in attributes — `input` and `expected_output` — and no items.
- **DatasetRename:** When the user edits the name of a dataset and confirms, the list reflects the new name immediately. All items in that dataset are preserved.
- **DatasetDelete:** When the user deletes a dataset, it is soft-deleted — hidden from the list but preserved in the database. All experiments referencing that dataset and their results are preserved. The dataset's name becomes available for reuse. The frontend confirms the action before proceeding.
- **DatasetOpen:** When the user selects a dataset from the list, they see that dataset's schema (its attributes) and all of its items.

**Schema (attributes)**

- **AttributeList:** When viewing a dataset, the user can see all defined attributes, always including `input` and `expected_output` among them.
- **AttributeAdd:** When the user adds a new attribute name to a dataset's schema, the name is automatically lowercased. That attribute appears as a new column across all existing items (empty by default) and across all future items in that dataset.
- **AttributeRemove:** When the user removes a custom attribute from a dataset's schema, that attribute column disappears from all items in that dataset. The `input` and `expected_output` attributes cannot be removed — any attempt to do so is rejected with a clear message.
- **BuiltInProtection:** The system never allows `input` or `expected_output` to be removed from a dataset's schema, regardless of how the action is triggered.

**Dataset Items**

- **ItemList:** When viewing a dataset, the user sees all items as rows, with one cell per attribute defined in the dataset's schema.
- **ItemCreate:** When the user submits a new item, that item appears in the dataset immediately. Every attribute defined in the schema is present on the item; any attribute the user did not fill in is stored as an empty string.
- **ItemEdit:** When the user edits an item and confirms, the updated values are reflected immediately. No other items are affected.
- **ItemDelete:** When the user deletes an item, it is removed from the dataset immediately and is no longer visible.
- **ItemSchemaConformance:** At all times, every item in a dataset's latest revision carries exactly the set of attributes defined by that revision's schema — no more, no fewer. Adding an attribute to the schema creates a new revision where all items carry that attribute (empty by default). Removing an attribute from the schema creates a new revision where all items no longer carry that attribute. Previous revisions retain their original schema and item values.

**Import & Export**

- **DatasetCSVTemplateDownload:** When the user requests a CSV template for a dataset, they receive a file containing exactly one row — the header row — with columns in schema order: `input` and `expected_output` first, followed by custom attributes in insertion order. The file contains no data rows. The filename communicates which dataset it belongs to.
- **DatasetCSVImport:** When the user selects a CSV file (via file picker or drag-and-drop) and confirms the import, the system reads every data row and creates a new revision containing only the imported items — replacing all existing items. Previous revisions are preserved as immutable snapshots, and experiments pinned to those revisions are unaffected.
- **DatasetCSVImportPreview:** Before committing an import, the system shows the user a summary: the number of valid rows found and any rows that will be skipped (with a reason per skipped row). The user must explicitly confirm before items are created.
- **DatasetCSVExport:** When the user requests a CSV export of a dataset's items, they receive a file where the first row is the header (schema order) and each subsequent row is one item in insertion order. The filename communicates which dataset it belongs to.

**Dataset Revisions**

- **RevisionOnCreate:** When a dataset is created, the system automatically creates an initial revision (schemaVersion 1) with the default attributes `["input", "expected_output"]` and zero items. This revision is the dataset's starting state.
- **RevisionOnItemCreate:** When the user adds an item to a dataset, the system creates a new revision containing all existing items plus the new item. The previous revision is unchanged. The new revision inherits the same `schemaVersion` as the previous revision.
- **RevisionOnItemEdit:** When the user edits an item, the system creates a new revision containing all items with the edited item's values updated. The edited item retains the same stable `itemId` across revisions. The previous revision is unchanged. The new revision inherits the same `schemaVersion`.
- **RevisionOnItemDelete:** When the user deletes an item, the system creates a new revision containing all items except the deleted one. The previous revision is unchanged and still contains the deleted item. The new revision inherits the same `schemaVersion`.
- **RevisionOnAttributeAdd:** When the user adds an attribute, the system creates a new revision with the new attribute added to the schema and all items backfilled with empty string for that attribute. The `schemaVersion` is incremented by 1.
- **RevisionOnAttributeRemove:** When the user removes a custom attribute, the system creates a new revision with the attribute removed from the schema and stripped from all items. The `schemaVersion` is incremented by 1.
- **RevisionOnCSVImport:** When the user imports items via CSV, the system creates exactly one new revision containing only the imported items — replacing all items from the previous revision. The new revision inherits the same `schemaVersion`. Previous revisions retain their items.
- **RevisionImmutability:** Once a revision is created, its attributes and items are never modified by any subsequent operation. Revisions are an immutable audit trail of dataset state.
- **RevisionLatest:** The current state of a dataset — its attributes and items — is always the latest revision, determined by the most recent `createdAt` timestamp. There is no separate mutable working copy.
- **RevisionSchemaVersion:** The `schemaVersion` counter increments only when the schema changes (attribute added or removed). Item-only mutations (create, edit, delete, CSV import) copy the `schemaVersion` unchanged.

**Version Navigation**

- **RevisionList:** When the user navigates to a dataset's revision history, they see a list of all revisions ordered by `createdAt` descending (newest first). Each entry shows the `schemaVersion`, `attributes`, `createdAt` timestamp, item count, and the number of experiments pinned to that revision.
- **RevisionDetail:** When the user selects a specific revision from the history, they see the full list of items in that revision with their values, the revision's attributes, and its `schemaVersion`. This view is read-only — the user cannot edit items in a past revision.
- **RevisionBrowseItems:** When viewing a previous revision, the user sees the exact dataset state at that point in time — including items that were later deleted and attribute values that were later changed. The items are displayed in the same format as the current dataset view.
- **RevisionCompareSchema:** When browsing the revision list, the user can see which revisions changed the schema (different `schemaVersion` from the previous entry) versus which revisions only changed items (same `schemaVersion`).
- **RevisionExperimentLink:** When viewing a revision, the user can see which experiments were run against it. Selecting an experiment navigates to that experiment's results.
- **RevisionCurrentIndicator:** The most recent revision in the list is clearly marked as "Current" to distinguish it from historical revisions.

## Contracts

These describe what the user provides and what the system surfaces — not internal representations.

**Dataset (summary, as shown in the list)**

- `name` — string, user-provided, non-empty
- `item_count` — integer, how many items exist in the latest revision

**Dataset (detail view)**

- `name` — string
- `attributes` — ordered list of attribute names from the latest revision; always includes "input" and "expected_output"
- `items` — ordered list of items from the latest revision
- `schemaVersion` — integer, the latest revision's schema version

**Item (as displayed in a dataset)**

- `values` — map of attribute name to string value; must contain exactly the attributes defined in the dataset's schema; "input" and "expected_output" are always present; custom attributes may be present with empty-string values

**Create Dataset request**

- `name` — string, required, non-empty

**Add Attribute request**

- `attribute_name` — string, required, non-empty, must not already exist in this dataset's schema

**Create or Edit Item request**

- `values` — map of attribute name to string; must include "input" and "expected_output"; may include values for custom attributes; omitted attributes default to empty string; values for attributes not in the schema are ignored

**CSV Template file (download)**

- Format: UTF-8 encoded CSV
- One row: the header row with all attribute names in schema order
- No data rows

**CSV Import file (user provides)**

- Format: UTF-8 encoded CSV
- First row: header with column names
- Remaining rows: one item per row
- Required columns: all attributes in the dataset's schema must be present. Extra columns not in the schema are silently ignored. `input` and `expected_output` are matched case-insensitively and normalized to lowercase.
- Empty cells are treated as empty-string values

**CSV Import preview (system surfaces before commit)**

- `valid_row_count` — number of rows that will be created
- `skipped_rows` — list of row number + reason for any rows that will not be imported

**CSV Export file (user receives)**

- Format: UTF-8 encoded CSV
- Row 1: header in schema order
- Rows 2–N: one item per row in insertion order; empty values appear as empty cells
- Filename incorporates the dataset name

**Dataset Revision (as shown in revision history)**

- `schemaVersion` — integer, incremented on schema changes only
- `attributes` — ordered list of attribute names for this revision
- `item_count` — integer, how many items exist in this revision
- `experiment_count` — integer, how many experiments are pinned to this revision
- `created_at` — timestamp of when this revision was created
- `is_current` — boolean, true only for the most recent revision

**Dataset Revision (detail view)**

- `schemaVersion` — integer
- `attributes` — ordered list of attribute names
- `items` — ordered list of revision items, each with a stable `itemId` and `values`
- `created_at` — timestamp
- `experiments` — list of experiments pinned to this revision (name, status)

**Revision List request**

- `dataset_id` — UUID of the dataset

**Revision Detail request**

- `dataset_id` — UUID of the dataset
- `revision_id` — UUID of the specific revision

## Constraints

- `input` and `expected_output` are reserved attribute names. They are present on every dataset from creation and cannot be removed or renamed.
- All attribute values are strings. No numeric, boolean, or structured types are in scope for this phase.
- Attribute names within a dataset must be unique.
- A dataset's name must be non-empty and unique across all active (non-deleted) datasets. Names can be reused after soft deletion.
- This is a single-user, single-session tool. No authentication or multi-tenancy constraints apply.
- The current state of a dataset is always derived from its latest revision (by `createdAt`). There is no separate mutable table.
- Every mutation to a dataset's items or schema creates a new immutable revision. Previous revisions are never modified.
- `schemaVersion` increments only on schema changes (attribute add/remove). Item mutations copy `schemaVersion` unchanged.
- Revisions are preserved even when the parent dataset is soft-deleted. There is no API to delete individual revisions.

## Error Cases

- **EmptyDatasetName:** The user submits a dataset with an empty name → the dataset is not created and the user sees an inline validation message.
- **DuplicateDatasetName:** The user submits a dataset with a name that already exists → the dataset is not created and the user sees an inline validation message indicating the name is already in use.
- **EmptyAttributeName:** The user attempts to add an attribute with an empty name → the attribute is not added and the user sees an inline validation message.
- **DuplicateAttributeName:** The user attempts to add an attribute whose name already exists in this dataset's schema → the attribute is not added and the user sees an inline validation message indicating the name is already in use.
- **RemoveBuiltInAttribute:** The user attempts to remove `input` or `expected_output` → the request is rejected and the user sees a message indicating these attributes are required and cannot be removed.
- **ItemMissingBuiltIns:** The user submits a new or edited item without a value for `input` or `expected_output` → the system either prevents submission with a validation message, or stores an empty string for the missing attribute — this behavior is left to the implementor to decide consistently, but the item is always stored with both attributes present.
- **ImportNotCSV:** The user provides a file that is not valid CSV → the import is rejected before preview and the user sees a message indicating the file could not be parsed.
- **ImportMissingBuiltIns:** The CSV header does not contain `input` or `expected_output` → the import is rejected before preview with a message listing the missing required columns.
- **ImportUnknownColumns:** The CSV header contains column names not in the dataset's schema → unknown columns are silently ignored. The system filters to only recognized attributes. The preview shows which columns were ignored so the user can verify no important data was skipped.
- **ImportEmptyFile:** The CSV contains no data rows → the import is rejected with a message indicating no items were found.
- **ImportRowBlankBuiltIns:** A data row has an empty value for `input` or `expected_output` → that row is flagged in the preview as skipped with a reason. Other valid rows may still be imported.
- **ImportCancelled:** The user dismisses the preview without confirming → no items are created and the dataset is unchanged.
- **ExportEmptyDataset:** The user requests a CSV export of a dataset with no items → the system produces a valid file containing only the header row.

## Out of Scope

- Attribute types other than string (numbers, booleans, enums, structured objects).
- Importing or exporting in any format other than CSV.
- Versioning or history of graders or grader rubric changes.
- Diffing between dataset revisions (showing what changed between two revisions).
- Reverting a dataset to a previous revision.
- Validation of item values beyond schema conformance (no regex, length, or format constraints).
- Sorting or reordering items within a dataset beyond insertion order.
- Searching or filtering items within a dataset.
- Persisting any data to a SQL or external database.
- User authentication or multi-user sessions.
- Comparing results across multiple experiment runs.
- Streaming LLM responses into cells as they arrive (cells populate on completion).

## Resolved Decisions (Datasets)

1. **Dataset name uniqueness:** Dataset names must be unique among active (non-deleted) datasets. The system rejects duplicate names with a validation message. Names can be reused after soft deletion.
2. **Attribute name casing:** All attribute names are lowercased automatically. `Input` and `input` are the same attribute.
3. **Item ordering:** Items appear in insertion order. No reordering or sorting.
4. **Attribute ordering:** Attributes appear in insertion order. No reordering. `input` and `expected_output` are always first.
5. **Deletion confirmation:** Deleting a dataset requires explicit confirmation. The confirmation explains that the dataset will be hidden from lists but all data is preserved.
6. **Minimum item count:** A dataset with zero items is not valid for experiment selection. It does not appear as a selectable option when creating an experiment.

---

## Graders

### Behaviors

- **GraderList:** When the user navigates to the grader area, they see a list of all existing graders, each identified by its user-given name and description.
- **GraderCreate:** When the user submits a name, description, and rubric for a new grader, that grader appears in the list immediately.
- **GraderOpen:** When the user selects a grader from the list, they see the grader's full detail: its name, description, and rubric text.
- **GraderEdit:** When the user edits any field of a grader (name, description, or rubric) and confirms, the updated values are reflected immediately across the list and the detail view.
- **GraderDelete:** When the user deletes a grader, it is soft-deleted — hidden from the list and grader dropdowns but preserved in the database. All experiments that used this grader and their results are preserved. The grader's name becomes available for reuse. The frontend confirms the action before proceeding.
- **RubricVisibility:** The rubric is always visible in the grader's detail view in its entirety. It is not truncated or summarized — the user can read and edit the exact instruction text that will be used to judge test cases.

### Contracts

These describe what the user provides and what the system surfaces — not internal representations.

**Grader (summary, as shown in the list)**

- `name` — string, user-provided, non-empty
- `description` — string, user-provided, may be empty

**Grader (detail view)**

- `name` — string
- `description` — string, may be empty
- `rubric` — string; the full instruction text that will be given to an LLM judge when this grader is used to evaluate a test case; describes what "correct" or "acceptable" output looks like and how the judge should reason about it

**Create Grader request**

- `name` — string, required, non-empty
- `description` — string, optional, defaults to empty
- `rubric` — string, required, non-empty; the judging instruction

**Edit Grader request**

- `name` — string, required, non-empty
- `description` — string, optional, may be empty
- `rubric` — string, required, non-empty

### Error Cases

- **EmptyGraderName:** The user submits a grader with an empty name → the grader is not saved and the user sees an inline validation message.
- **DuplicateGraderName:** The user submits a grader with a name that already exists → the grader is not saved and the user sees an inline validation message indicating the name is already in use.
- **EmptyRubric:** The user submits a grader with an empty rubric → the grader is not saved and the user sees an inline validation message indicating that a rubric is required.
- **EditEmptyRubric:** The user clears the rubric text on an existing grader and attempts to save → the edit is rejected and the user sees an inline validation message; the previously saved rubric is preserved.
- **EditEmptyName:** The user clears the name on an existing grader and attempts to save → the edit is rejected and the user sees an inline validation message; the previously saved name is preserved.

### Resolved Decisions (Graders)

1. **Grader name uniqueness:** Grader names must be unique among active (non-deleted) graders. The system rejects duplicate names with a validation message. Names can be reused after soft deletion.
2. **Rubric role:** The rubric is a sub-prompt — it contains the judging instructions for the LLM. When running an experiment, the system constructs the LLM prompt as: system message contains the rubric (judging criteria), user message contains the dataset item attributes (`input`, `expected_output`, and any custom attributes). The rubric text is freeform with no enforced placeholder conventions.
3. **Rubric length limits:** No enforced limit on rubric length.
4. **Deletion safety:** Graders are soft-deleted — hidden from lists and dropdowns but preserved in the database. Experiments and results referencing the grader are preserved. The user must explicitly confirm the deletion.
5. **Description optionality:** Description is optional. An empty description is treated the same as any other value — no visual distinction.

---

## Experiments

### Behaviors

- **ExperimentCreate:** When the user provides a name, selects a dataset, selects one or more graders, and selects a model, the system creates an experiment that references the dataset's latest revision at the time of creation. The experiment is immediately visible in the experiment list. No new revision is created — the experiment uses the existing latest revision.
- **ExperimentModelSelection:** When creating an experiment, the user selects a model from a dropdown — selection is required. Available models are grouped by provider: Anthropic, OpenAI, Google, Meta, Mistral, and DeepSeek. The selected model is stored on the experiment and used by the evaluator when the experiment runs. The model ID is displayed in the experiment header and in the experiment list.
- **ExperimentModelStored:** The model is stored per experiment. No default or environment fallback exists — the model is always explicitly set at creation time.
- **ExperimentRun:** When the user runs an experiment, the system evaluates every grader against every item in the experiment's referenced revision — not the dataset's current state. For each evaluation, the system sends the rubric as judging instructions and the revision item's attributes as the data to judge. Each evaluation produces a verdict (pass or fail) and a reason. Dataset edits made after experiment creation do not affect the experiment's items or results.
- **ExperimentRerun:** When the user re-runs an experiment, the system creates a new experiment that references the dataset's latest revision at the time of the rerun. The new experiment runs independently with its own revision reference. The original experiment and its results are preserved with their original revision.
- **ExperimentList:** The user can see a list of all experiments, each showing at minimum its name and the dataset it is associated with.
- **ExperimentResults:** When the user opens an experiment, they see a results table where rows are the revision's items (frozen at experiment creation), columns are graders, and each cell displays the pass/fail verdict for that item–grader pair. The reason for each verdict is accessible on hover without leaving the table. The revision version and creation timestamp are visible.
- **ExperimentDelete:** When the user deletes an experiment, it is soft-deleted — hidden from the list but preserved in the database along with all its results. The dataset and graders are not affected.
- **ExperimentCSVExport:** When the user requests a CSV export of a completed experiment's results, they receive a file where the header contains the revision's attributes followed by one pair of columns per grader (`{grader_name}_verdict` and `{grader_name}_reason`). Each subsequent row is one revision item's results. Verdicts are the literal strings `pass` or `fail`; cells in error state contain `error`. The export always reflects the revision's data, not the dataset's current state. Re-exporting after dataset edits produces identical output.
- **ExperimentRevisionPinning:** Once an experiment is created, its revision reference never changes. Editing the dataset creates new revisions but does not affect any existing experiment's items or results.
- **ExperimentSharedRevision:** Two experiments created against the same dataset without any intervening edits share the same revision. No duplicate snapshot is created.

**Aggregate Statistics**

- **GraderPassRate:** When an experiment has results, each grader column header displays that grader's pass rate — shown as both a fraction and a percentage (e.g., "7/10 — 70%"). This is visible without any additional action.
- **ItemPassSummary:** Each result row displays a per-item pass summary — the count of graders that passed for that item out of the total number of graders (e.g., "2/3 passed"). A row where all graders pass is visually distinguishable from a row with any failures.
- **ExperimentSummary:** A summary area is present when an experiment has results, showing the overall pass rate across every grader–item cell in the experiment (total passes ÷ total cells, as fraction and percentage), and a per-grader breakdown listing each grader's pass rate in one place.
- **ResultsFilter:** The user can filter result rows by outcome — choosing to view all rows, only rows where every grader passed, or only rows where at least one grader failed. The active filter is indicated. Clearing the filter restores the full result set.
- **FilteredAggregates:** When a filter is applied, column-header pass rates and the summary area reflect only the visible rows, not the full experiment. The total cell count used in calculations is shown so the user knows stats are scoped.
- **NoResultsState:** An experiment with no results yet shows no aggregate stats — the summary area and per-grader rates are absent or clearly marked as unavailable until at least one run completes.

### Contracts

These describe what the user provides and what the system surfaces — not internal representations.

**Create Experiment request**

- `name` — string, required, non-empty
- `dataset` — one selected dataset, must contain at least one item
- `graders` — one or more selected graders
- `modelId` — string, required, non-empty; the OpenRouter model ID to use as the LLM judge

**Experiment (as shown in the list)**

- `name` — string
- `dataset_name` — name of the associated dataset
- `status` — one of: "queued", "running", "complete", "failed"
- `modelId` — the OpenRouter model ID used as the LLM judge for this experiment

**Experiment (detail view header)**

- `revision_schema_version` — the schemaVersion of the revision this experiment is pinned to (displayed in the detail view header alongside `created_at`, not in the list view)

**Experiment Results table**

- Rows are revision items (frozen at experiment creation, identified by their content)
- Columns are graders (identified by name)
- Each cell contains:
  - `verdict` — "pass" or "fail"
  - `reason` — string, visible on hover
- The revision's `schemaVersion` and `created_at` are displayed

### Error Cases

- **MissingRequiredFields:** The user attempts to create an experiment without a name, without selecting a dataset, or without selecting at least one grader → creation is blocked and the missing fields are indicated.
- **EmptyDatasetRun:** The selected dataset contains no items at the time of running → the run fails with a clear message indicating the dataset is empty. No partial results are stored.
- **RunFailurePartial:** Evaluation fails for one or more cells (e.g. the LLM call errors) → those cells display an explicit error state rather than a verdict. The remaining cells that succeeded are still shown. The experiment is marked as partially failed.
- **RunFailureTotal:** The run cannot start or all cells fail → the experiment is marked as failed and the user is informed. No misleading "complete" status is shown.
- **ConcurrentRun:** The system allows up to two experiments to run in parallel. If both slots are occupied, additional experiments are queued and wait until a slot becomes available.
- **ExportNoResults:** The user attempts to export experiment results when the experiment has no results → the export action is unavailable with a clear indication that results must exist before export.

### Resolved Decisions (Experiments)

1. **Re-runnability:** Re-running an experiment creates a new experiment with new results. The original experiment and its results are preserved. This maintains full run history.
2. **Dataset reference:** Experiments reference a specific dataset revision, not the live dataset. The revision is pinned at experiment creation time and never changes. Dataset edits after creation produce new revisions but do not affect existing experiments. This ensures experiment results are always reproducible and immune to subsequent dataset mutations.
3. **Grader cap:** No cap on graders per experiment. Unbounded selection.
4. **Timestamps:** No timestamps for now.
5. **Experiment statuses:** Experiments have four statuses: "queued" (waiting for a slot), "running" (actively evaluating), "complete" (all cells evaluated), "failed" (run could not complete). Up to two experiments may run in parallel; additional experiments queue until a slot is available.
