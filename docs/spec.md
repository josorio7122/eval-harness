# Lightweight Eval Harness — Specification

## Goal

When this system is complete, a user can manage datasets of structured test cases, define graders with rubrics that instruct an LLM judge, and run experiments that evaluate every dataset item against selected graders — producing a pass/fail verdict and reason for each item–grader pair. Results are displayed in a table with per-grader pass rates, per-item pass summaries, and overall experiment statistics. The user can filter results by outcome, import and export dataset items via CSV, and export experiment results as CSV. All state persists in-memory for the session.

## Behaviors

**Datasets**

- **DatasetList:** When the user navigates to the dataset area, they see a list of all existing datasets, each identified by its user-given name.
- **DatasetCreate:** When the user submits a name for a new dataset, that dataset appears in the list immediately. It starts with two built-in attributes — `input` and `expected_output` — and no items.
- **DatasetRename:** When the user edits the name of a dataset and confirms, the list reflects the new name immediately. All items in that dataset are preserved.
- **DatasetDelete:** When the user deletes a dataset, it is removed from the list immediately. All items belonging to that dataset and all experiments referencing that dataset (with their results) are also deleted. The operation is not reversible within the session.
- **DatasetDeleteExperimentWarning:** When the user attempts to delete a dataset that is referenced by one or more experiments, the system surfaces a warning before proceeding. The warning communicates that the associated experiments and all their results will also be deleted. The user must explicitly confirm the deletion. If the user does not confirm, no deletion occurs.
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
- **ItemSchemaConformance:** At all times, every item in a dataset carries exactly the set of attributes defined by the dataset's current schema — no more, no fewer. Adding an attribute to the schema retroactively adds that attribute (empty) to all existing items. Removing an attribute from the schema retroactively drops that attribute's value from all existing items.

**Import & Export**

- **DatasetCSVTemplateDownload:** When the user requests a CSV template for a dataset, they receive a file containing exactly one row — the header row — with columns in schema order: `input` and `expected_output` first, followed by custom attributes in insertion order. The file contains no data rows. The filename communicates which dataset it belongs to.
- **DatasetCSVImport:** When the user selects a CSV file and confirms the import, the system reads every data row and creates a new dataset item for each one. Items are appended after existing items in the order they appeared in the file. No existing items are modified or removed.
- **DatasetCSVImportPreview:** Before committing an import, the system shows the user a summary: the number of valid rows found and any rows that will be skipped (with a reason per skipped row). The user must explicitly confirm before items are created.
- **DatasetCSVExport:** When the user requests a CSV export of a dataset's items, they receive a file where the first row is the header (schema order) and each subsequent row is one item in insertion order. The filename communicates which dataset it belongs to.

## Contracts

These describe what the user provides and what the system surfaces — not internal representations.

**Dataset (summary, as shown in the list)**

- `name` — string, user-provided, non-empty
- `item_count` — integer, how many items currently exist in this dataset

**Dataset (detail view)**

- `name` — string
- `attributes` — ordered list of attribute names; always includes "input" and "expected_output"
- `items` — ordered list of Items

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
- Required columns: `input` and `expected_output` (case-insensitive match, normalized to lowercase)
- Column names must match the dataset's schema exactly — no extra columns, no missing schema columns
- Empty cells are treated as empty-string values

**CSV Import preview (system surfaces before commit)**

- `valid_row_count` — number of rows that will be created
- `skipped_rows` — list of row number + reason for any rows that will not be imported

**CSV Export file (user receives)**

- Format: UTF-8 encoded CSV
- Row 1: header in schema order
- Rows 2–N: one item per row in insertion order; empty values appear as empty cells
- Filename incorporates the dataset name

## Constraints

- `input` and `expected_output` are reserved attribute names. They are present on every dataset from creation and cannot be removed or renamed.
- All attribute values are strings. No numeric, boolean, or structured types are in scope for this phase.
- Attribute names within a dataset must be unique.
- A dataset's name must be non-empty and unique across all datasets.
- State persistence is in-memory for the session. No reads from or writes to a backend database are required for this phase.
- This is a single-user, single-session tool. No authentication or multi-tenancy constraints apply.

## Error Cases

- **EmptyDatasetName:** The user submits a dataset with an empty name → the dataset is not created and the user sees an inline validation message.
- **DuplicateDatasetName:** The user submits a dataset with a name that already exists → the dataset is not created and the user sees an inline validation message indicating the name is already in use.
- **EmptyAttributeName:** The user attempts to add an attribute with an empty name → the attribute is not added and the user sees an inline validation message.
- **DuplicateAttributeName:** The user attempts to add an attribute whose name already exists in this dataset's schema → the attribute is not added and the user sees an inline validation message indicating the name is already in use.
- **RemoveBuiltInAttribute:** The user attempts to remove `input` or `expected_output` → the request is rejected and the user sees a message indicating these attributes are required and cannot be removed.
- **ItemMissingBuiltIns:** The user submits a new or edited item without a value for `input` or `expected_output` → the system either prevents submission with a validation message, or stores an empty string for the missing attribute — this behavior is left to the implementor to decide consistently, but the item is always stored with both attributes present.
- **DatasetDeleteExperimentNoConfirm:** The user dismisses or cancels the warning about associated experiments → the dataset is not deleted and the system returns to its previous state unchanged.
- **ImportNotCSV:** The user provides a file that is not valid CSV → the import is rejected before preview and the user sees a message indicating the file could not be parsed.
- **ImportMissingBuiltIns:** The CSV header does not contain `input` or `expected_output` → the import is rejected before preview with a message listing the missing required columns.
- **ImportUnknownColumns:** The CSV header contains column names not in the dataset's schema → the import is rejected before preview. The user sees the unrecognized column names and is reminded to download the template.
- **ImportEmptyFile:** The CSV contains no data rows → the import is rejected with a message indicating no items were found.
- **ImportRowBlankBuiltIns:** A data row has an empty value for `input` or `expected_output` → that row is flagged in the preview as skipped with a reason. Other valid rows may still be imported.
- **ImportCancelled:** The user dismisses the preview without confirming → no items are created and the dataset is unchanged.
- **ExportEmptyDataset:** The user requests a CSV export of a dataset with no items → the system produces a valid file containing only the header row.

## Out of Scope

- Attribute types other than string (numbers, booleans, enums, structured objects).
- Importing or exporting in any format other than CSV.
- Versioning or history of datasets, graders, or schema changes.
- Validation of item values beyond schema conformance (no regex, length, or format constraints).
- Sorting or reordering items within a dataset beyond insertion order.
- Searching or filtering items within a dataset.
- Persisting any data to a SQL or external database.
- User authentication or multi-user sessions.
- Comparing results across multiple experiment runs.
- Streaming LLM responses into cells as they arrive (cells populate on completion).

## Resolved Decisions (Datasets)

1. **Dataset name uniqueness:** Dataset names must be unique. The system rejects duplicate names with a validation message.
2. **Attribute name casing:** All attribute names are lowercased automatically. `Input` and `input` are the same attribute.
3. **Item ordering:** Items appear in insertion order. No reordering or sorting.
4. **Attribute ordering:** Attributes appear in insertion order. No reordering. `input` and `expected_output` are always first.
5. **Deletion confirmation:** Deleting a dataset requires explicit confirmation. The confirmation explains what will be deleted: all items and all associated experiments with their results.
6. **Minimum item count:** A dataset with zero items is not valid for experiment selection. It does not appear as a selectable option when creating an experiment.

---

## Graders

### Behaviors

- **GraderList:** When the user navigates to the grader area, they see a list of all existing graders, each identified by its user-given name and description.
- **GraderCreate:** When the user submits a name, description, and rubric for a new grader, that grader appears in the list immediately.
- **GraderOpen:** When the user selects a grader from the list, they see the grader's full detail: its name, description, and rubric text.
- **GraderEdit:** When the user edits any field of a grader (name, description, or rubric) and confirms, the updated values are reflected immediately across the list and the detail view.
- **GraderDelete:** When the user deletes a grader, it is removed from the list immediately and is no longer accessible. All experiments referencing that grader and their results are also deleted. The user is warned and must confirm. The operation is not reversible within the session.
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

1. **Grader name uniqueness:** Grader names must be unique. The system rejects duplicate names with a validation message.
2. **Rubric role:** The rubric is a sub-prompt — it contains the judging instructions for the LLM. When running an experiment, the system constructs the LLM prompt as: system message contains the rubric (judging criteria), user message contains the dataset item attributes (`input`, `expected_output`, and any custom attributes). The rubric text is freeform with no enforced placeholder conventions.
3. **Rubric length limits:** No enforced limit on rubric length.
4. **Deletion safety:** Deleting a grader warns the user if the grader is referenced by experiments. Deletion cascades — all experiments referencing the grader and their results are also deleted. The user must explicitly confirm.
5. **Description optionality:** Description is optional. An empty description is treated the same as any other value — no visual distinction.

---

## Experiments

### Behaviors

- **ExperimentCreate:** When the user provides a name, selects a dataset, and selects one or more graders, the system creates an experiment in a "not yet run" state. The experiment is immediately visible in the experiment list.
- **ExperimentRun:** When the user runs an experiment, the system evaluates every grader against every dataset item using the current state of the dataset. For each evaluation, the system sends the rubric as judging instructions and the dataset item attributes as the data to judge. Each evaluation produces a verdict (pass or fail) and a reason. When the run completes, the results are available for inspection.
- **ExperimentRerun:** When the user re-runs an experiment, the system creates a new experiment with a new name (derived from the original) and runs it independently. The original experiment and its results are preserved.
- **ExperimentList:** The user can see a list of all experiments, each showing at minimum its name and the dataset it is associated with.
- **ExperimentResults:** When the user opens an experiment, they see a results table where rows are dataset items, columns are graders, and each cell displays the pass/fail verdict for that item–grader pair. The reason for each verdict is accessible on hover without leaving the table.
- **ExperimentDelete:** When the user deletes an experiment, the experiment record and all of its results are permanently removed. The dataset and graders are not affected.
- **ExperimentCSVExport:** When the user requests a CSV export of a completed experiment's results, they receive a file where the header contains all dataset attributes followed by one pair of columns per grader (`{grader_name}_verdict` and `{grader_name}_reason`). Each subsequent row is one dataset item's results. Verdicts are the literal strings `pass` or `fail`; cells in error state contain `error`. The action is only available when the experiment has at least one result.

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

**Experiment (as shown in the list)**

- `name` — string
- `dataset_name` — name of the associated dataset
- `status` — one of: "queued", "running", "complete", "failed"

**Experiment Results table**

- Rows are dataset items (identified by their content)
- Columns are graders (identified by name)
- Each cell contains:
  - `verdict` — "pass" or "fail"
  - `reason` — string, visible on hover

### Error Cases

- **MissingRequiredFields:** The user attempts to create an experiment without a name, without selecting a dataset, or without selecting at least one grader → creation is blocked and the missing fields are indicated.
- **EmptyDatasetRun:** The selected dataset contains no items at the time of running → the run fails with a clear message indicating the dataset is empty. No partial results are stored.
- **RunFailurePartial:** Evaluation fails for one or more cells (e.g. the LLM call errors) → those cells display an explicit error state rather than a verdict. The remaining cells that succeeded are still shown. The experiment is marked as partially failed.
- **RunFailureTotal:** The run cannot start or all cells fail → the experiment is marked as failed and the user is informed. No misleading "complete" status is shown.
- **ConcurrentRun:** The system allows up to two experiments to run in parallel. If both slots are occupied, additional experiments are queued and wait until a slot becomes available.
- **ExportNoResults:** The user attempts to export experiment results when the experiment has no results → the export action is unavailable with a clear indication that results must exist before export.

### Resolved Decisions (Experiments)

1. **Re-runnability:** Re-running an experiment creates a new experiment with new results. The original experiment and its results are preserved. This maintains full run history.
2. **Dataset reference:** Experiments use a live reference to the dataset, not a snapshot. If the dataset is edited after a run, results reference the current dataset state. This keeps the system simple and leaves the door open for dataset versioning in the future.
3. **Grader cap:** No cap on graders per experiment. Unbounded selection.
4. **Timestamps:** No timestamps for now.
5. **Experiment statuses:** Experiments have four statuses: "queued" (waiting for a slot), "running" (actively evaluating), "complete" (all cells evaluated), "failed" (run could not complete). Up to two experiments may run in parallel; additional experiments queue until a slot is available.
