# How Eval Systems Display Experiment Results

## Braintrust
- **Table layout**: Rows = test cases, Columns = Input | Output | Expected | Score1 | Score2 | ...
- **Score cells**: Show numeric value (0-1), clickable
- **Click row → side panel (trace view)**: Shows full input/output/expected + scores section with scorer name, value, and rationale/explanation text
- **Column headers**: Show aggregate stats (mean, std dev)
- **Filtering**: Pre-built views (Failed cases, High regression), SQL-like filtering

## LangSmith
- **Table layout**: Rows = test cases, Columns = inputs | outputs | reference | feedback key columns
- **Score cells**: Color-coded chips (red=fail, green=pass), clickable
- **Click score chip → modal**: Shows metric name, value, evaluator info, comment/explanation text
- **Hover**: Tooltip with truncated comment; arrow icon → evaluator run trace
- **Heat map**: Color background (red=low, green=high)
- **View modes**: Compact (one-line), Full (complete text), Diff

## Common Pattern for Our System
Both use the same core pattern:
1. **Table**: rows = test cases, columns = graders/evaluators
2. **Cell**: shows verdict (pass/fail or score) with visual indicator
3. **Detail access**: click cell or row → expanded view showing the reason/rationale
4. Requirements say "reason on hover" — this maps to hover tooltip or click-to-expand
