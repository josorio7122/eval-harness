# researcher+researcher dispatch

## Task
[researcher] ## Objective
Research how eval platforms construct the prompt sent to the LLM judge when evaluating a test case. Specifically: how do they combine the grader's rubric with the dataset item's attributes (input, expected_output, etc.)?

## Specific Questions
1. How do Braintrust, Promptfoo, and OpenAI Evals structure the prompt to the LLM judge?
2. Is the rubric sent as a system prompt, user prompt, or something else?
3. Where do the dataset attributes (input, expected_output, custom 

## Output
## Researcher #1: ## Objective
Research how eval platforms construct the prompt sent to the LLM judge when evaluating a test case. Specifically: how do they combine the grader's rubric with the dataset item's attributes (input, expected_output, etc.)?

## Specific Questions
1. How do Braintrust, Promptfoo, and OpenAI Evals structure the prompt to the LLM judge?
2. Is the rubric sent as a system prompt, user prompt, or something else?
3. Where do the dataset attributes (input, expected_output, custom fields) go — system prompt, user prompt, or templated into the rubric?
4. Do they use a fixed prompt template that wraps the rubric + data, or does the rubric itself contain template variables?
5. What is the best practice — rubric as sub-prompt inside a structured system prompt, or rubric as the entire prompt?

## Output
Concise summary of prompt construction patterns. Focus on the separation between rubric (judging instructions) and dataset attributes (the data being judged).
Perfect! Now let me create a final concise summary:

---

## Research: LLM Eval Platform Prompt Construction

### Answer

All three platforms—**Braintrust, Promptfoo, and OpenAI Evals**—separate the rubric (evaluation criteria) from dataset attributes using a **three-part message structure**: system/developer message (rubric as task instructions), user message (templated dataset items), and structured response parsing. The rubric is **never templated as a variable**; instead, it forms the structural context while dataset attributes (`{{input}}`, `{{output}}`, `{{expected}}`) are interpolated into placeholders.

### Key Findings

1. **Rubric placement varies slightly by platform** (source: [Promptfoo LLM Rubric docs](https://promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric), [OpenAI Evals](https://platform.openai.com/docs/guides/evals))
   - **Promptfoo**: Rubric typically in user prompt alongside templated variables; can be moved to system via custom `rubricPrompt`
   - **OpenAI Evals**: Rubric as explicit developer/system message; dataset attributes templated in user message
   - **Braintrust**: Rubric as prompt template body (task instructions); dataset attributes templated directly

2. **Template variable usage is standardized** (source: [Promptfoo reference](https://www.promptfoo.dev/docs/configuration/reference), [Braintrust Autoevals](https://github.com/braintrustdata/autoevals))
   - `{{input}}`, `{{output}}`, `{{expected}}` — dataset item attributes only
   - `{{rubric}}` — single interpolation point (the rubric itself, not broken into sub-variables)
   - `{{ item.field }}` — OpenAI's scoped dataset references

3. **All platforms use fixed template wrappers** (source: documentation across all three)
   - Promptfoo: Fixed `llm-rubric` template with `rubricPrompt` override option
   - OpenAI: Fixed `developer + user` message structure with templated variables
   - Braintrust: Per-scorer fixed templates; custom `LLMClassifier` allows full prompt control

4. **Rubric is static, dataset attributes are dynamic** — this separation enables:
   - Reuse of criteria across multiple test cases
   - Audit trail of what was being evaluated
   - Easier iteration (change data without changing rubric)
   - Better caching for production systems

### Recommended Approach

**Best practice: Rubric as context/instructions in system message; dataset attributes as templated placeholders in user message.**

Structure your judge prompt as:
```
[System/Developer] "You are evaluating outputs against these criteria: [rubric]"
[User] "Input: {{input}} | Output: {{output}} | Expected: {{expected}}"
[Parse response as] {score: 0-1, reason: "...", pass: boolean}
```

Use `use_cot=True` (Braintrust) or chain-of-thought prompting to improve consistency. Template variables should **only** interpolate data from the test case, never the rubric itself.

### Sources

- [Promptfoo LLM Rubric](https://promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric) — Variable syntax, default template structure
- [Promptfoo Model-graded Closed QA](https://promptfoo.dev/docs/configuration/expected-outputs/model-graded/model-graded-closedqa) — Y/N binary eval pattern
- [OpenAI Evals API Guide](https://platform.openai.com/docs/guides/evals) — Message template structure, item schema separation
- [Braintrust Autoevals GitHub](https://github.com/braintrustdata/autoevals) — Unified template approach, custom scorer examples
- [Braintrust LLM-as-Judge Guide](https://braintrust.dev/articles/what-is-llm-as-a-judge) — Prompt design best practices, calibration strategies

## Researcher #2: ## Objective
Research whether eval platforms snapshot dataset items when an experiment runs, or reference the live dataset.

## Specific Questions
1. How do Braintrust, LangSmith, and Promptfoo handle dataset changes after an experiment has run?
2. Do they snapshot/copy the dataset items at run time so results are tied to the original data?
3. Or do they reference the live dataset, meaning edits to items after the run change what's displayed in results?
4. What is the recommended approach for a lightweight eval system?
5. What are the tradeoffs of snapshot vs. live reference?

## Output
Concise summary with a clear recommendation for a lightweight eval harness.
Perfect! I now have comprehensive research findings. Let me compile and synthesize this into a clear research report.

---

## Research: Evaluation Platform Dataset Handling (Snapshot vs. Live Reference)

### Answer

**Braintrust and LangSmith both use live references with version tracking.** Datasets are stored centrally and experiments reference the current version by name/ID, not snapshots. However, Braintrust explicitly supports pinning to specific dataset versions—meaning you can lock an experiment to a historical dataset state. LangSmith's approach is less explicit about versioning but stores dataset state at run time. **Promptfoo and Evidently snapshot datasets at eval time**, storing the test data embedded with results. For a lightweight system, **live references with optional snapshots for immutability** is the optimal approach: minimal storage, maximum flexibility, with explicit versioning when needed.

### Key Findings

1. **Braintrust: Live Reference with Explicit Versioning** — Datasets are "versioned collections" stored in a cloud data warehouse. Experiments reference datasets by name, and every change is tracked. Critically: "experiments can pin to specific versions" — this means evaluations *can* lock to historical versions, but by default use the current (live) dataset. If dataset records are updated/deleted after a run, existing experiment results link to the live dataset, and the platform provides row-by-row performance tracking across experiments. (source: https://www.braintrust.dev/docs/platform/datasets)

2. **LangSmith: Live Reference without Explicit Version Control** — Datasets are created and updated via the SDK/UI (e.g., `create_examples()`, `update()` methods). When you run an evaluation, you pass a dataset reference by ID or name. The evaluation creates a snapshot of results at that moment, but the dataset itself remains mutable. Edits to dataset items after the run are immediately reflected when viewing the dataset—old results don't preserve the original input state unless explicitly exported. LangSmith emphasizes "online" and "offline" evaluation modes but doesn't document dataset snapshots on runs. (source: https://docs.smith.langchain.com/evaluation/how_to_guides/manage_datasets_programmatically)

3. **Promptfoo: Test Data Snapshots** — Promptfoo stores test cases in YAML/CSV files (e.g., `promptfooconfig.yaml`) or datasets uploaded via CLI. When you run `promptfoo eval`, results are written to `~/.promptfoo` with the test data embedded in the eval output. Results are immutable once saved; the test data is baked into the eval record. This is implicit snapshotting—no version management, but results never drift from their original inputs. (source: https://www.promptfoo.dev/docs/usage/command-line/)

4. **Evidently: Explicit Snapshots** — Evidently calls the evaluation+dataset output a "snapshot"—a JSON summary of metrics and results. Snapshots are versioned by timestamp and include optional dataset data (`include_data=True`). This is explicit snapshotting: results are permanently tied to the dataset state at run time. You can upload datasets separately or embed them. Snapshots are immutable once sent to the platform. (source: https://docs-old.evidentlyai.com/user-guide/evaluations/snapshots)

5. **Recommended Approach for Lightweight Systems** — **Live reference with optional snapshots**:
   - Store datasets as immutable records in a simple JSON/YAML database (versioned by commit hash or timestamp)
   - Experiments reference dataset IDs/names + optional version pinning
   - At eval time, optionally snapshot the dataset items with results for reproducibility
   - Serialize results with a `dataset_version_id` field for traceability
   - **Cost/storage**: Live refs = O(1) per run; snapshots = O(n) per run where n = dataset size (trade-off: immutability vs. storage)

### Tradeoffs: Snapshot vs. Live Reference

| Dimension | Live Reference (Braintrust/LangSmith) | Snapshot (Promptfoo/Evidently) |
|-----------|-------|----------|
| **Storage** | Minimal per run; metadata-only | Higher; embeds full dataset with each result |
| **Reproducibility** | Requires version control discipline | Guaranteed; results always show original data |
| **Flexibility** | Easy to run same eval on new dataset version | Breaking change requires re-running eval |
| **Discovery** | One source of truth; UI can show current + historical performance | Each eval is self-contained; no live "current" state |
| **Debugging** | If dataset is edited, old results may drift | Results always match their inputs; no surprises |
| **Best For** | Iterative development, continuous improvement loops | Compliance, audit trails, published benchmarks |

### Recommended Approach

**For a lightweight eval harness, use live references + optional snapshot on write:**

```python
# Eval runs reference dataset by ID + version
run_result = eval(
    dataset_id="my-dataset",
    dataset_version="v1.2",  # optional pin; omit for "latest"
    task_fn=my_task,
    scorers=[scorer1, scorer2]
)

# On save, snapshot is optional (leave empty for live reference)
run_result.save(
    snapshot_dataset=None,  # or dataset_items if immutability needed
)
```

**Implementation:**
- **Live mode** (default): Store only dataset ID + version hash in result metadata. Viewers fetch current dataset on demand.
- **Snapshot mode**: When high confidence or publishing, embed dataset items in result JSON for full reproducibility.
- **Storage**: ~10KB metadata + optional ~100KB–1MB dataset snapshot per run.

**Why this wins:**
- **Minimal overhead** for active development (live refs)
- **Immutability on demand** when needed (snapshots)
- **Flexibility** to update datasets without invalidating old runs
- **Backward compatible** with both patterns simultaneously

### Sources

- [Braintrust Datasets](https://www.braintrust.dev/docs/platform/datasets) — Versioned collections with explicit version pinning for experiments
- [LangSmith Dataset Management](https://docs.smith.langchain.com/evaluation/how_to_guides/manage_datasets_programmatically) — Mutable datasets, live reference model
- [Promptfoo CLI](https://www.promptfoo.dev/docs/usage/command-line/) — Implicit snapshotting via embedded test data in results
- [Evidently Snapshots](https://docs-old.evidentlyai.com/user-guide/evaluations/snapshots) — Explicit JSON snapshots with timestamp-based versioning
