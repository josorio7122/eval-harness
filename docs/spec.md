# Lightweight Eval Harness — Specification

## Goal

When this system is complete, a user can manage datasets of structured test cases, define graders with rubrics that instruct an LLM judge, and run experiments that evaluate every dataset item against selected graders — producing a pass/fail verdict and reason for each item–grader pair. Results are displayed in a table with per-grader pass rates, per-item pass summaries, and overall experiment statistics. The user can filter results by outcome, import and export dataset items via CSV, and export experiment results as CSV. All state persists in PostgreSQL.

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

- **ExperimentCreate:** When the user provides a name, selects a dataset, selects one or more graders, selects a model, and selects a prompt, the experiment is created and automatically enqueued for evaluation — no separate run step is required. The experiment references the dataset's latest revision and the prompt's latest version at the time of creation. The experiment is immediately visible in the experiment list. Dataset edits and prompt edits made after experiment creation do not affect the experiment's items, outputs, or results.
- **ExperimentModelSelection:** When creating an experiment, the user selects a model from a dropdown — selection is required. Available models are grouped by provider: Anthropic, OpenAI, Google, Meta, Mistral, and DeepSeek. The selected model is stored on the experiment and used by the evaluator when the experiment runs. The model ID is displayed in the experiment header and in the experiment list.
- **ExperimentModelStored:** The model is stored per experiment. No default or environment fallback exists — the model is always explicitly set at creation time.
- **ExperimentRerun:** When the user re-runs an experiment, the system creates a new experiment referencing the dataset's latest revision at the time of rerun. If the original experiment had a prompt, the new experiment pins the latest version of that same prompt at the time of rerun. The new experiment runs independently with its own revision and prompt version references. The original experiment and its results are preserved.
- **ExperimentList:** The user can see a list of all experiments, each showing at minimum its name and the dataset it is associated with.
- **ExperimentResults:** When the user opens an experiment, they see a results table where rows are the revision's items (frozen at experiment creation), columns are graders, and each cell displays the pass/fail verdict for that item–grader pair. The reason for each verdict is accessible on hover. An output column displays the LLM-generated output for each item. The revision version, creation timestamp, prompt name, and pinned version number are visible in the experiment header.
- **ExperimentDelete:** When the user deletes an experiment, it is soft-deleted — hidden from the list but preserved in the database along with all its results. The dataset and graders are not affected.
- **ExperimentCSVExport:** When the user requests a CSV export of a completed experiment's results, they receive a file where the header contains the revision's attributes, followed by an `output` column, followed by one pair of columns per grader (`{grader_name}_verdict` and `{grader_name}_reason`). Each subsequent row is one revision item's results. The `output` column contains the generated text or the literal string `"error"`. Verdicts are the literal strings `pass`, `fail`, or `error`. The export always reflects the revision's frozen data.
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
- `promptId` — UUID, required; the system locates the prompt's latest version and pins it at creation time

**Experiment (as shown in the list)**

- `name` — string
- `dataset_name` — name of the associated dataset
- `status` — one of: "queued", "running", "complete", "failed"
- `modelId` — the OpenRouter model ID used as the LLM judge for this experiment

**Experiment (detail view header)**

- `revision_schema_version` — the schemaVersion of the revision this experiment is pinned to
- `prompt_name` — string or null; the name of the prompt used, if any
- `prompt_version` — integer or null; the pinned version number, if any

**Experiment Results table**

- Rows are revision items (frozen at experiment creation)
- Columns: item attribute values | `output` | one verdict+reason pair per grader
- Each `output` cell: the text generated by the LLM in Phase 1; error state displayed explicitly
- Each verdict cell: `verdict` — "pass", "fail", or "error"; `reason` — string, visible on hover
- The revision's `schemaVersion`, `created_at`, prompt name, and prompt version (when present) are displayed in the header

### Error Cases

- **MissingRequiredFields:** The user attempts to create an experiment without a name, without selecting a dataset, without selecting at least one grader, or without selecting a prompt → creation is blocked and the missing fields are indicated.
- **EmptyDatasetRun:** The selected dataset contains no items at the time of running → the run fails with a clear message indicating the dataset is empty. No partial results are stored.
- **RunFailurePartial:** Evaluation fails for one or more cells (e.g. the LLM call errors) → those cells display an explicit error state rather than a verdict. The remaining cells that succeeded are still shown. The experiment is marked as partially failed.
- **RunFailureTotal:** The run cannot start or all cells fail → the experiment is marked as failed and the user is informed. No misleading "complete" status is shown.
- **ConcurrentRun:** The system allows up to two experiments to run in parallel. If both slots are occupied, additional experiments are queued and wait until a slot becomes available.
- **ExportNoResults:** The user attempts to export experiment results when the experiment has no results → the export action is unavailable with a clear indication that results must exist before export.
- **PromptNotFound:** The user selects a prompt ID that does not exist or has been soft-deleted → experiment creation is rejected with a message indicating the prompt was not found.
- **TemplateMissingInputPlaceholder:** The selected prompt's latest `userPrompt` does not contain the `{input}` placeholder → experiment creation is rejected with a clear message. The user must edit the prompt to include `{input}` before it can be used in an experiment.

### Resolved Decisions (Experiments)

1. **Re-runnability:** Re-running an experiment creates a new experiment with new results. The original experiment and its results are preserved. This maintains full run history.
2. **Dataset reference:** Experiments reference a specific dataset revision, not the live dataset. The revision is pinned at experiment creation time and never changes. Dataset edits after creation produce new revisions but do not affect existing experiments. This ensures experiment results are always reproducible and immune to subsequent dataset mutations.
3. **Grader cap:** No cap on graders per experiment. Unbounded selection.
4. **Timestamps:** No timestamps for now.
5. **Experiment statuses:** Experiments have four statuses: "queued" (created, briefly waiting for a slot), "running" (actively evaluating), "complete" (all cells evaluated), "failed" (run could not complete). Experiments are automatically enqueued on creation. Up to two experiments may run in parallel; additional experiments queue until a slot is available.
6. **Prompt pinning:** When a prompt is selected at experiment creation, the latest version of that prompt is pinned. The pinned version never changes. If the prompt is later edited (creating a new version) or deleted (soft-deleted), the experiment's pinned version is unaffected.

---

## Prompts

### Behaviors

- **PromptList:** When the user navigates to the prompt area, they see a list of all existing prompts, each showing its name, the model from its latest version, the total version count, and when it was last updated.
- **PromptCreate:** When the user submits a name, system prompt, user prompt, model, and optional model parameters for a new prompt, that prompt appears in the list immediately with version 1.
- **PromptOpen:** When the user selects a prompt from the list, they see the prompt's full detail: its name, the latest version's content (system prompt, user prompt, model, model parameters), and the complete version history.
- **PromptRename:** When the user edits the name of a prompt and confirms, the list reflects the new name immediately. No new version is created — renaming is a metadata-only change.
- **PromptEditContent:** When the user modifies any content field (system prompt, user prompt, model, or model parameters) and saves, the system creates a new immutable version with the full updated content. The previous version is preserved unchanged. The version number increments by 1.
- **PromptDelete:** When the user deletes a prompt, it is soft-deleted — hidden from the list but preserved in the database. The prompt's name becomes available for reuse. The frontend confirms the action before proceeding.
- **VersionImmutability:** Once a prompt version is created, its system prompt, user prompt, model ID, and model parameters are never modified. Editing always creates a new version.
- **VersionHistory:** When viewing a prompt's detail, the user can see all versions ordered newest first. Each version shows its version number, model display name, and creation timestamp. Selecting a past version loads its content into the editor in read-only mode.
- **VersionFullSnapshot:** Every version is a complete snapshot of the prompt's content. There are no partial updates — saving always submits all content fields, and the new version stores the full state.

### Contracts

These describe what the user provides and what the system surfaces — not internal representations.

**Prompt (summary, as shown in the list)**

- `name` — string, user-provided, non-empty
- `versionCount` — integer, total number of versions
- `latestVersion` — the most recent PromptVersion (see below)

**Prompt (detail view)**

- `name` — string
- `versions` — ordered list of all versions, newest first

**PromptVersion (as shown in version history and editor)**

- `version` — integer, incremented per prompt (1, 2, 3…)
- `systemPrompt` — string, the system message
- `userPrompt` — string, the user message template
- `modelId` — string, OpenRouter model identifier
- `modelParams` — object with optional `temperature` (0–2), `maxTokens` (≥1), `topP` (0–1)
- `createdAt` — timestamp of when this version was created

**Create Prompt request**

- `name` — string, required, non-empty
- `systemPrompt` — string, required (empty string allowed)
- `userPrompt` — string, required (empty string allowed)
- `modelId` — string, required, non-empty
- `modelParams` — object, optional; `temperature` (number, 0–2), `maxTokens` (integer, ≥1), `topP` (number, 0–1)

**Update Prompt Name request**

- `name` — string, required, non-empty

**Create Version request**

- `systemPrompt` — string, required (empty string allowed)
- `userPrompt` — string, required (empty string allowed)
- `modelId` — string, required, non-empty
- `modelParams` — object, optional; same shape as create

### Error Cases

- **EmptyPromptName:** The user submits a prompt with an empty name → the prompt is not created and the user sees an inline validation message.
- **DuplicatePromptName:** The user submits a prompt with a name that already exists among active prompts → the prompt is not created and the user sees an inline validation message indicating the name is already in use.
- **EmptyModelId:** The user submits a prompt or version without selecting a model → creation is blocked and the user sees a validation message.
- **InvalidModelParams:** The user submits model parameters outside valid ranges (temperature > 2, topP > 1, maxTokens < 1) → the request is rejected with a validation message indicating which parameter is invalid.
- **EditNameEmpty:** The user clears the name on an existing prompt and attempts to save → the edit is rejected and the user sees an inline validation message; the previously saved name is preserved.
- **VersionNoChanges:** The user attempts to save a new version with content identical to the latest version → the save button is disabled in the UI (no API call is made).

### Resolved Decisions (Prompts)

1. **Prompt name uniqueness:** Prompt names must be unique among active (non-deleted) prompts. The system rejects duplicate names with a validation message. Names can be reused after soft deletion.
2. **Version immutability:** Prompt versions are immutable once created. No update or delete operations exist for individual versions.
3. **Full-snapshot versioning:** Every version stores the complete prompt content (system prompt, user prompt, model ID, model parameters). There are no partial updates or diffs between versions.
4. **Name change does not create a version:** Renaming a prompt updates only the parent metadata. It does not affect versions or create a new version.
5. **Model parameters are optional:** If not provided, the LLM's default parameters are used. The `modelParams` field defaults to an empty object `{}`.
6. **Prompt-experiment linking:** Selecting a prompt when creating an experiment is required. See the Prompt-Experiment Integration section for full details.
7. **Deletion safety:** Prompts are soft-deleted — hidden from lists but preserved in the database. Experiments pinned to a prompt version continue to reference that version after soft-deletion.

---

## Prompt-Experiment Integration

### Behaviors

- **PromptSelection:** When creating an experiment, the user must select a prompt from the list of active (non-deleted) prompts. Selection is required. Only active prompts are shown in the picker.

- **PromptVersionPinning:** When the user selects a prompt during experiment creation, the system records the ID of that prompt's latest version at the exact moment the experiment is created. Subsequent edits to the prompt (which create new versions) do not affect the experiment. The pinned version is immutable for the lifetime of the experiment.

- **LLMRunPhase:** Experiment execution uses a pipelined two-phase approach. Phase 1 (Generation): for each dataset item, the item's `input` value is substituted into the prompt version's `userPrompt` template (replacing the `{input}` placeholder) and sent to the prompt version's model with its `systemPrompt` and `modelParams`. The LLM response is the item's generated output. As each generation completes, that item's grading tasks are immediately enqueued — grading does not wait for all generations to finish. Phase 2 (Grading): the generated output is used as the response being judged. The item's `expected_output` is still passed to the judge as reference context.

- **OutputStorage:** After Phase 1 completes for an item, the generated output is stored and associated with that item within the experiment. Stored outputs are never overwritten by reruns — each experiment owns its own set of outputs.

- **OutputDisplay:** The results table shows a dedicated column containing each item's generated output. The column appears between the item's input attributes and the grader verdict columns. The full output text is accessible (not truncated to an unusable length) — a popover or expandable cell is acceptable.

- **GradingWithOutput:** The LLM judge receives the generated output (from Phase 1) as the response to evaluate. The item's `expected_output` remains visible to the judge as reference context but is not the primary response under evaluation. The judge's task is explicitly framed as evaluating the generated output against the rubric, with `expected_output` as a reference standard.

- **GenerationFailure:** If the LLM generation call fails for an item during Phase 1, that item's output is stored as an error state. Grading cells for that item are still created but are stored as `verdict: "error"` with the generation error as the reason — no grading call is made for items whose generation failed. Other items continue processing unaffected.

- **PromptVersionDisplay:** When viewing an experiment that has a pinned prompt version, the experiment header displays the prompt name and the pinned version number so the user can identify exactly which prompt configuration produced the results.

- **RerunPromptCarryover:** When the user reruns an experiment that had a prompt, the new experiment pins the latest version of the same prompt at the time of rerun — not the originally pinned version. The rerun respects the same prompt selection as the original, but always pins the current latest version, consistent with how dataset revisions are handled.

### Contracts

**ExperimentOutput (new entity — one per dataset item per experiment)**

- `experimentId` — UUID, the owning experiment
- `datasetRevisionItemId` — UUID, the item whose `input` was used
- `output` — string, the raw text returned by the LLM during Phase 1; empty string on generation failure
- `error` — string or null; the error message if generation failed; null on success

**CSV Export (modification — adds output column)**

- When the experiment has a prompt: an `output` column appears after `expected_output` and before the first grader verdict column
- The `output` column contains the generated text for each item, or the literal string `"error"` if generation failed

### Error Cases

- **PromptNotFound:** The user selects a prompt ID that does not exist or has been soft-deleted → experiment creation is rejected with a message indicating the prompt was not found.
- **PromptHasNoVersions:** The selected prompt exists but has no versions → experiment creation is rejected with a message indicating the prompt has no content to pin.
- **GenerationFailurePartial:** One or more items fail during Phase 1 (LLM generation) → those items' outputs are stored as errors; their grading cells are marked as `verdict: "error"` with the generation error as the reason. Remaining items continue through both phases unaffected. Experiment status follows the same rules as today: `"complete"` if any cells succeeded, `"failed"` if all cells error.
- **GenerationFailureTotal:** All items fail during Phase 1 → experiment is marked as `"failed"`. No grading calls are made.
- **TemplatePlaceholderMissing:** The prompt's `userPrompt` does not contain the `{input}` placeholder → experiment creation is rejected with a message indicating the template must include `{input}`.
- **GenerationOutputEmpty:** The LLM generation call succeeds but returns an empty string → the output is stored as an empty string; grading proceeds with the empty string as the response. The judge may produce a `"fail"` verdict in this case — no special handling is applied.

### Resolved Decisions (Prompt-Experiment Integration)

1. **Prompt is required:** Selecting a prompt on experiment creation is required. Every experiment runs the prompt against the dataset to generate outputs, then grades those outputs.
2. **Latest version pinned at creation:** When a prompt is selected, the system always pins the latest version at the moment of experiment creation. There is no UI for selecting a specific past version during experiment creation.
3. **Template convention:** The `{input}` placeholder in the prompt's `userPrompt` is the only substitution performed. No other dataset attributes are substituted into the prompt template. Custom attributes remain available only to the judge, not to the generation model.
4. **Pipelined execution:** As each item's generation completes, its grading tasks are immediately enqueued. Generation and grading run concurrently across items — grading does not wait for all generations to finish. Each item's grading always uses that item's finalized output.
5. **Output stored separately:** Generated outputs are stored in a dedicated entity (not inside `ExperimentResult`), because one output is shared across all graders for that item.
6. **Generation model comes from the prompt version:** The model used in Phase 1 is the one stored on the pinned `PromptVersion` (its `modelId` and `modelParams`). The experiment's `modelId` continues to identify the judge model used in Phase 2.
7. **Rerun pins latest version:** Reruns always pin the latest version of the original prompt — they do not preserve the originally pinned version. This is consistent with how reruns reference the dataset's latest revision.
8. **Judge template change:** When a prompt is present, the judge's user message labels the generated output as "Response" and includes `expected_output` as "Reference Output" or equivalent context. The judge is told it is evaluating the generated response, not the reference. When no prompt is present, the judge template is unchanged.

---

## Prompt Playground

### Behaviors

- **PlaygroundOpen:** When the user is viewing a prompt's detail and clicks the playground button, a slide-over panel opens from the right side of the screen. The panel shows a chat interface for testing the prompt. The prompt detail view remains visible underneath.

- **PlaygroundVersionSelect:** When the playground opens, it defaults to the prompt's latest version. The user can select any saved version from a version picker within the playground panel. Changing the version clears the current conversation and resets the playground to its initial state.

- **PlaygroundInitialState:** When the playground opens or the version is changed, the user sees the selected version's system prompt displayed as read-only context at the top of the panel, an empty chat area, and an input field. The input field is labeled to indicate the user's message will be substituted into the `{input}` placeholder of the `userPrompt` template.

- **PlaygroundFirstMessage:** When the user types a message and sends it, the system substitutes the message into the selected version's `userPrompt` template (replacing `{input}`) and sends it to the version's model with the version's `systemPrompt` as the system message and the version's `modelParams`. The user's original message (not the substituted template) is displayed as the user message in the chat. The LLM response streams token-by-token into an assistant message bubble.

- **PlaygroundFollowUp:** After the first exchange, the user can type and send follow-up messages. Follow-up messages are sent as plain user messages — the `userPrompt` template is not re-applied. The full conversation history (system prompt + all previous messages) is sent with each request. The LLM response streams token-by-token.

- **PlaygroundStreaming:** All LLM responses in the playground stream token-by-token as they are generated. The user sees text appear incrementally in the assistant message bubble. While a response is streaming, the input field is disabled and a stop button is available.

- **PlaygroundStop:** When the user clicks the stop button during streaming, the generation is cancelled. The partial response received so far is kept in the chat as the assistant's message. The user can continue the conversation from that point.

- **PlaygroundModelFromVersion:** The playground always uses the selected version's `modelId` and `modelParams` (temperature, maxTokens, topP). There is no option to override model or parameters within the playground.

- **PlaygroundEphemeral:** Conversations are not persisted. When the user closes the playground panel, the conversation is lost. Reopening the playground starts fresh. No data is saved to the database.

- **PlaygroundReset:** The user can clear the current conversation at any time via a reset button. This returns the playground to its initial state — empty chat area with the input field ready for a new first message.

- **PlaygroundClose:** The user can close the playground panel by clicking a close button or clicking outside the panel. The prompt detail view returns to its full width.

- **PlaygroundSystemPromptDisplay:** The selected version's system prompt is displayed at the top of the playground panel as read-only context, so the user can see what instructions the model is operating under. If the system prompt is long, it is collapsed by default with an option to expand.

### Contracts

These describe what the user provides and what the system surfaces — not internal representations.

**Playground state (ephemeral, client-side only)**

- `promptId` — UUID, the prompt being tested
- `selectedVersionId` — UUID, the version currently in use
- `messages` — ordered list of chat messages, each with `role` ("user" or "assistant") and `content` (string)
- `isStreaming` — boolean, whether a response is currently being generated

**Playground first message (sent to API)**

- `versionId` — UUID, the version to use
- `message` — string, the user's input text (substituted into `{input}` placeholder of `userPrompt`)

**Playground follow-up message (sent to API)**

- `versionId` — UUID, the version to use
- `messages` — the full conversation history (system prompt derived from version, all user and assistant messages)

**Playground response (streamed from API)**

- Token-by-token text stream
- Final complete message text when streaming ends

### Error Cases

- **PlaygroundGenerationFailure:** The LLM call fails during a playground message → the error is displayed inline in the chat as a system error message. The user can retry by sending the same or a different message. The conversation history up to the error is preserved.
- **PlaygroundEmptyMessage:** The user attempts to send an empty message → the send button is disabled; no API call is made.
- **PlaygroundVersionDeleted:** The user has the playground open and the prompt is deleted in another tab → the playground continues to function with the already-loaded version data since conversations are ephemeral and client-side. No new conversations can be started after navigating away.
- **PlaygroundStreamInterrupted:** The streaming connection is interrupted (network error) → the partial response is kept; an error message is shown. The user can retry or continue.

### Resolved Decisions (Prompt Playground)

1. **Template application:** The `userPrompt` template with `{input}` substitution is applied only to the first message. All subsequent messages are plain user messages with no template processing. This matches the industry-standard pattern used by OpenAI Playground, Anthropic Console, LangSmith, and Braintrust.
2. **System prompt handling:** The system prompt from the selected version is sent as the system message on every request. It remains constant throughout the conversation and is never modified.
3. **Conversation display:** The user's first message is displayed as-is (the raw input text), not as the substituted template. The template substitution happens server-side and is transparent to the user.
4. **Version switching clears conversation:** Changing the selected version resets the entire conversation. There is no way to continue a conversation with a different version — the system prompt and template may have changed, making prior context potentially incoherent.
5. **No persistence:** Conversations exist only in browser memory. There is no database table, no API endpoint for saving or loading conversations, and no conversation history across sessions.
6. **No model override:** The playground strictly uses the version's model and parameters. This ensures the user is testing the prompt under the exact conditions it would run in an experiment.
7. **Streaming is required:** All playground responses stream. There is no option for non-streaming responses.
8. **No grading in playground:** The playground is for testing generation only. There is no grading, scoring, or evaluation in the playground — that is the experiment's responsibility.
9. **API endpoint:** The playground requires a new streaming API endpoint. This endpoint is separate from the experiment runner and does not use the experiment queue — playground messages are processed immediately with no queuing.
10. **Stop behavior:** Stopping a stream keeps the partial response. The user can continue the conversation as if the partial response were the full response.
