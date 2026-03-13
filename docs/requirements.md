# Problem

Build a lightweight eval harness for running graders against test cases.

## User Flow

1. **Create a dataset**: Navigate to the Dataset tab. Add rows to a table, each representing a test case with an input and expected output.
2. **Define graders**: Switch to the Graders tab. Create evaluation criteria by specifying a name, description, and rubric. Each grader will score test cases as pass or fail with a reason.
3. **Run an experiment**: Go to the Experiment tab. Select a dataset and one or more graders, then click Run. The system evaluates each test case against the selected graders.
4. **Review results**: View the results table. Each row is a test case; each grader is a column showing pass/fail and the reason (on hover).

# Assignment

Create a Next.js app with three tabs for managing datasets, graders, and experiments.

## Tabs

### Dataset

- Table where each row is a test case
- User can add/edit/delete rows
- Columns: `input`, `expected_output`, plus any custom fields

### Graders

- Define evaluation criteria
- Each grader has: `name`, `description`, `rubric`
- Grader returns: `pass/fail` score and `reason`

### Experiment

- Select a dataset and one or more graders
- Run evaluation: each grader becomes a column
- Display results (pass/fail + reason per cell)

# Acceptance Criteria

- [ ] Dataset tab: CRUD for test case rows
- [ ] Graders tab: CRUD for grader definitions
- [ ] Experiment tab: run selected graders against dataset
- [ ] Results table shows pass/fail and reason per grader
- [ ] State persists across tab switches (in-memory is fine)

# Stretch Goals

- [ ] Persist data to a SQL database
- [ ] Aggregate stats (pass rate per grader)
- [ ] Export results as CSV

# Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [Mastra Documentation](https://mastra.ai/docs)

# Deliverables

Send an email with:

- 🔗 **GitHub Repo**: Public repository with README instructions
- 📹 **Loom**: Walkthrough of the flow end-to-end (< 5 mins)

# Next Steps

1. **Submission**: Send completed assignment via email
2. **Review**: We will meet to review the submission and ask questions
