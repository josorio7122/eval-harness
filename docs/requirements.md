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

### Prompt-Experiment Integration

- [x] Prompts are a standalone entity with versioning (system prompt, user prompt, model, model params)
- [x] Select a prompt when creating an experiment (required — every experiment must have a prompt)
- [x] When a prompt is selected, pin its latest version at experiment creation time
- [x] For each dataset item, substitute the item's `input` into the prompt's user prompt template and call the LLM — producing an actual generated output
- [x] Grade the LLM-generated output, not the dataset's `expected_output` (the `expected_output` becomes reference context for the judge, not the response being evaluated)
- [x] Store and display the generated output per dataset item in the results table

### Prompt Playground

- [x] Playground button on prompt detail view opens a slide-over chat panel from the right
- [x] User can select any saved prompt version to test (defaults to latest)
- [x] First message substitutes user input into the `userPrompt` template (`{input}` placeholder) and sends with `systemPrompt` as system message
- [x] Follow-up messages are plain text — no template re-application; full conversation history sent with each request
- [x] LLM responses stream token-by-token
- [x] User can stop streaming mid-response; partial response is kept
- [x] Uses the version's `modelId` and `modelParams` — no model override in playground
- [x] Conversations are ephemeral — not persisted to database; lost when panel closes
- [x] User can reset conversation and start fresh
- [x] System prompt displayed as read-only context at the top of the panel
- [x] Changing version clears the conversation
- [x] New streaming API endpoint (`POST /prompts/:id/playground`) — separate from experiment runner, no queuing
