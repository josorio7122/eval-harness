# Rubrics in LLM-as-Judge Eval Systems

## What is a rubric?
A rubric is the instruction/scoring specification given to an LLM judge. It tells the judge HOW to evaluate a test case.

## Data model (from Braintrust, OpenAI Evals)
- **name** — identifier for the evaluator
- **description** — what the grader checks
- **prompt/rubric** — free-text instructions for the LLM judge, often with template variables (input, output, expected)
- **choice_strings** — discrete options the judge picks from (e.g., pass/fail, or A/B/C/D)
- **choice_scores** — mapping from choice to numeric score (0-1)

## Evaluation flow
1. Template variables (input, expected_output) are substituted into the rubric prompt
2. LLM judge receives the rendered prompt
3. Judge returns a choice + reasoning
4. Choice is mapped to a score via choice_scores
5. Result: score + reason/rationale

## For our system (simplified)
The requirements say pass/fail + reason. So our graders are simplified:
- name, description, rubric (free-text instruction for the LLM judge)
- The rubric is sent to the LLM along with the test case input and expected_output
- LLM returns pass/fail verdict + reason text
- No numeric scoring, no choice_scores mapping needed
