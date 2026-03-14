# Requirements

## Original Assignment

Build a lightweight eval harness for running LLM graders against test cases.

### User Flow

1. **Create a dataset** — Add rows to a table, each with an input and expected output
2. **Define graders** — Create evaluation criteria with a name, description, and rubric
3. **Run an experiment** — Select a dataset and graders, run LLM evaluation
4. **Review results** — View pass/fail verdicts per item × grader in a results table

### Core Requirements

- Dataset CRUD (rows with input, expected_output, custom fields)
- Grader CRUD (name, description, rubric → pass/fail + reason)
- Experiment execution (graders × dataset items)
- Results table (rows = items, columns = graders, cells = verdict + reason on hover)

### Stretch Goals (All Implemented)

- [x] Persist data to PostgreSQL
- [x] Aggregate stats (pass rate per grader, overall experiment stats)
- [x] Export results as CSV
- [x] Dataset versioning via immutable revisions
- [x] Real-time progress via SSE
- [x] CSV import/export for datasets
