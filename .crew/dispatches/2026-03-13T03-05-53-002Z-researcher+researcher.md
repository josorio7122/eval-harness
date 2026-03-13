# researcher+researcher dispatch

## Task
[researcher] ## Objective
Research how **Braintrust** displays experiment/eval results in their UI. I need to understand the results table layout specifically.

## Specific Questions
1. How does Braintrust display experiment results? What does the results table look like — rows, columns, cell contents?
2. How do they show pass/fail or scores per grader/scorer per test case?
3. How do they show the reason/rationale from the LLM judge?
4. Do they use hover, expand, modal, or inline to show detaile

## Output
## Researcher #1: ## Objective
Research how **Braintrust** displays experiment/eval results in their UI. I need to understand the results table layout specifically.

## Specific Questions
1. How does Braintrust display experiment results? What does the results table look like — rows, columns, cell contents?
2. How do they show pass/fail or scores per grader/scorer per test case?
3. How do they show the reason/rationale from the LLM judge?
4. Do they use hover, expand, modal, or inline to show detailed results?
5. Any screenshots or UI descriptions from their docs?

## Output
Concise summary of the results display UX — focus on the table layout and how individual cell results (score + reason) are surfaced to the user.
Perfect! I now have comprehensive information about Braintrust's experiment results display. Let me compile this into a structured research report.

---

## Research: Braintrust Experiment Results UI Display

### Answer

Braintrust displays experiment results as a **table of test cases** where each row represents a complete trace. Each test case shows:
- **Input, output, and expected values** (expandable)
- **Score columns** (one per scorer, showing the numerical score)
- **Metric columns** (duration, token usage, cost)
- **Metadata columns** (user-configurable)

**Click any row to open the trace view** (modal/side panel) where score explanations and rationale are displayed. The score explanations come from the scorer (LLM judge's rationale, or code-based scoring logic).

### Key Findings

1. **Table Layout (List View — Default)**
   - Rows = one row per test case (trace with root span)
   - Columns: Input | Output | Expected | [Score columns] | [Metric columns] | [Metadata]
   - **Summary statistics in column headers** show aggregate score/metric data and allow sorting by regressions
   - Column width and visibility is customizable; columns can be pinned, reordered, shown/hidden
   - Table density adjustable (Compact, Tall)
   - (source: https://www.braintrust.dev/docs/evaluate/interpret-results)

2. **Alternative Layout Views**
   - **Grid layout**: Compare outputs side-by-side when running multiple experiments; select fields to display in cells
   - **Summary layout**: Large-type reporting view of aggregate scores/metrics across all experiments
   - **Span view**: Individual operations instead of full traces (not used for experiment comparison)
   - (source: https://www.braintrust.dev/docs/evaluate/interpret-results)

3. **Individual Cell Contents (Score Column)**
   - Each score cell displays: **numeric value** (0-1 or 0-100 depending on scorer)
   - Cell is **clickable** — selecting the row opens the **trace view**
   - Trace view shows: score **value + explanation/rationale** from the LLM judge
   - For code-based scorers: rationale may be minimal or not present; for LLM-as-a-judge scorers, rationale is typically a 1-2 sentence explanation of why the score was assigned
   - (source: https://www.braintrust.dev/docs/best-practices/scorers)

4. **How Score Reasoning is Surfaced**
   - **Click row → opens side panel (trace view)** showing full span tree
   - **Scores section** in trace view displays each score with:
     - Scorer name
     - Score value (0-1 or 0-100)
     - Rationale/explanation text (if scorer provides it)
   - Trace view also shows: input, output, expected, metadata, timing, token counts
   - Can view **raw JSON** of the scoring span to see full scorer output
   - (source: https://www.braintrust.dev/docs/evaluate/interpret-results, https://www.braintrust.dev/docs/guides/traces/view)

5. **Filtering & Grouping**
   - Default table views: "Assigned to me", "Unreviewed", "Scorer errors", "Errors", "Non-errors", "Default view"
   - Custom SQL filters via Filter menu
   - **Group by** metadata fields to see patterns (e.g., group by dataset type)
   - **Order by regressions** to highlight test cases where scores decreased vs baseline
   - (source: https://www.braintrust.dev/docs/evaluate/interpret-results)

6. **Custom Columns**
   - Extract specific values from input, output, expected, or metadata using SQL expressions or inferred fields
   - Example: create `User ID` column with expression `metadata.user_id`
   - Filter and sort by custom columns
   - (source: https://www.braintrust.dev/docs/guides/experiments/interpret)

7. **Diff Mode (Multi-Experiment Comparison)**
   - Highlight improvements/regressions across experiments
   - **Trials column** shows matching test case rows when same input appears in multiple experiments
   - Can customize comparison key (defaults to input field) in project Configuration
   - (source: https://www.braintrust.dev/docs/guides/experiments/interpret)

8. **UI Responsiveness & Performance**
   - Experiments UI is **10x faster** (powered by Brainstore, Braintrust's proprietary database optimized for AI workflows)
   - Results stream into the grid as evaluations complete
   - Real-time updates for large experiment runs
   - (source: https://braintrust.dev/blog/faster-experiments)

### Recommended Approach

**For your own eval results UI**, match Braintrust's proven patterns:

1. **Base table layout**:
   ```
   [Input preview] | [Output preview] | [Expected] | [Score1] [Score2] ... | [Duration] [Tokens] | [Metadata...]
   ```
   - Column headers show aggregate stats (mean, std dev) + sort by regression option
   - Each cell clickable or with click on row

2. **Row detail view** (modal or side panel):
   - Show full input, output, expected (expandable/collapsible)
   - **Scores section**: List each score with `{name: string, value: number, rationale?: string}`
   - Metrics section: duration, tokens, cost
   - Metadata section
   - Raw JSON toggle

3. **Score rationale display**:
   - Store `rationale` field in scoring span metadata
   - Display as 1-2 line explanation inline in trace view
   - Link to full scorer details/configuration if needed

4. **Filtering & grouping**:
   - Pre-build 3-5 default views (e.g., "Failed cases", "High regression")
   - Allow SQL-like filtering on any column
   - Group by metadata fields to aggregate scores across categories

5. **Customization**:
   - Drag-reorder columns
   - Pin/hide columns
   - Custom column creation via SQL expression or JSON path

### Sources

- [Interpret evaluation results - Braintrust](https://www.braintrust.dev/docs/evaluate/interpret-results) — Main docs on table layout, filtering, trace view, and score display
- [Visualize and interpret eval results](https://www.braintrust.dev/docs/guides/experiments/interpret) — Detailed UI features: diff mode, grouping, custom columns, aggregate scores
- [View your logs - Braintrust](https://www.braintrust.dev/docs/guides/traces/view) — Trace view modes (Timeline, Thread, custom views) and data format options
- [Writing scorers - Braintrust](https://www.braintrust.dev/docs/best-practices/scorers) — How scorers produce rationale and chain-of-thought output
- [Experiments UI: Now 10x faster - Braintrust Blog](https://braintrust.dev/blog/faster-experiments) — Performance optimization via Brainstore database

## Researcher #2: ## Objective
Research how **LangSmith** (by LangChain) displays experiment/eval results in their UI. I need to understand the results table layout specifically.

## Specific Questions
1. How does LangSmith display experiment results? What does the results table look like — rows, columns, cell contents?
2. How do they show pass/fail or scores per evaluator per test case?
3. How do they show the reason/rationale/feedback from evaluators?
4. Do they use hover, expand, modal, or inline to show detailed results?
5. Any screenshots or UI descriptions from their docs?

## Output
Concise summary of the results display UX — focus on the table layout and how individual cell results (score + reason) are surfaced to the user.
Perfect! Now I have comprehensive information. Let me compile the research findings:

---

## Research: LangSmith Experiment/Eval Results UI

### Answer

LangSmith displays experiment evaluation results in a **data table with rows per example** and **columns per feedback key**, using **color-coded "score chips"** (red/green heat map). Evaluator scores and detailed feedback are shown as **clickable feedback tags** — click a tag to open a modal with the score, evaluator details, and optional comment/explanation text. More context is accessed via **hovering (trace icons, evaluator source links)** or **modal expansion (detailed view modal with full feedback per cell)**.

### Key Findings

1. **Table Structure & Layout** — Rows = examples/test cases; columns = inputs, outputs, reference outputs, feedback scores, metrics (cost, tokens, latency). Feedback scores render as color-coded **chips** (red = lower score, green = higher score based on heat map threshold). (source: https://docs.langchain.com/langsmith/analyze-an-experiment)

2. **Per-Evaluator Display** — Each feedback **key gets its own column** in the table. Feedback scores are rendered as clickable tags/chips. (source: https://changelog.langchain.com/announcements/new-langsmith-experiment-view-for)

3. **Score + Reason Surfacing** — Click on any **feedback tag/chip → opens a modal with feedback details** (score, comment/explanation, edit capability). In comparison view, click feedback tag → feedback details modal. In runs table, find "Feedback" column → click tag → feedback details. (source: https://docs.langchain.com/langsmith/audit-evaluator-scores)

4. **Interaction Patterns**:
   - **Hover over feedback score cell** → click arrow icon to view the source evaluator run (the LLM-as-judge prompt itself if applicable) in a side panel
   - **Click any cell** → opens detailed view modal showing full feedback keys and scores for that example
   - **Hover over output cells** → click trace icon to open the application execution trace in a side panel
   - **Expand button** on long content (if in Full view) → inline expansion
   - (source: https://docs.langchain.com/langsmith/analyze-an-experiment)

5. **View Modes** — Three table formats available: **Compact** (one-line rows, glance comparison), **Full** (complete text of inputs/outputs/references), and **Diff** (text differences between reference and actual output). (source: https://docs.langchain.com/langsmith/analyze-an-experiment)

6. **Visual Affordances** — Heat map highlighting with configurable thresholds (high/middle/low), color-coded chips (red = lower, green = higher), feedback tags as interactive elements, column headers with filter/sort actions. (source: https://docs.langchain.com/langsmith/analyze-an-experiment)

### Recommended Approach

**Results table cell design pattern:**
- **Row**: One per test case/example
- **Column header**: Feedback key name (e.g., "accuracy", "relevance", "coherence")
- **Cell content**: Score chip (numeric or categorical, color-coded, clickable)
- **Primary interaction**: Click score chip → **modal overlay** showing:
  - Metric name & value
  - Evaluator info (name, type if LLM-as-judge)
  - Comment/explanation text
  - Edit button (if corrections enabled)
- **Secondary interactions**:
  - Hover → tooltip showing truncated comment
  - Arrow icon in cell → open evaluator run trace in side panel
  - Full-screen "expand detailed view" button → modal with all feedback for that row
- **Optional heat map**: Color background of cell (red = low, green = high)
- **Repetitions support**: If multiple runs, show average score in cell, click to expand showing individual scores + std deviation

**Feedback structure (per cell):**
```
{
  key: "accuracy",
  score: 0.85,
  comment: "Response contains accurate information based on reference.",
  evaluator_info: { type: "llm-as-judge", source_run_id: "..." },
  correction: null  // if human-audited, populated with user's corrected score
}
```

### Sources

- [Analyze an experiment](https://docs.langchain.com/langsmith/analyze-an-experiment) — Table views, cell interactions, heat maps, hover patterns, evaluator score viewing
- [How to compare experiment results](https://docs.langchain.com/langsmith/compare-experiment-results) — Feedback column filtering, regression/improvement highlighting, detailed view expansion, cell click modals
- [How to audit evaluator scores](https://docs.langchain.com/langsmith/audit-evaluator-scores) — Feedback tag → modal flow, comment display, edit correction flow
- [New LangSmith experiment view (Feb 2025)](https://changelog.langchain.com/announcements/new-langsmith-experiment-view-for) — Each feedback key has own column, heat map view, filter/sort actions
- [Custom views feature](https://changelog.langchain.com/announcements/create-custom-views-when-viewing-evaluation-results) — Column customization, decimal precision control, field extraction
