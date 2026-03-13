export function buildSystemPrompt(rubric: string): string {
  return `You are an expert evaluator tasked with assessing whether an AI system's output meets defined quality criteria. Your role is to act as an objective, impartial judge — not to generate responses yourself.

## Evaluation Criteria

${rubric}

## Instructions

Apply the criteria above to the test case you will receive. Consider whether the output satisfies each aspect of the criteria, then reach a verdict.

Think through your evaluation carefully before concluding. Analyze what the output does well, where it falls short, and whether any shortcomings are significant enough to constitute a failure under the given criteria.`
}

export function buildUserMessage(itemAttributes: Record<string, string>): string {
  const input = itemAttributes['input']
  if (input === undefined) {
    throw new Error('Missing required field: input')
  }

  const expectedOutput = itemAttributes['expected_output']
  if (expectedOutput === undefined) {
    throw new Error('Missing required field: expected_output')
  }

  const customAttributes = Object.entries(itemAttributes).filter(
    ([key]) => key !== 'input' && key !== 'expected_output',
  )

  const contextSection =
    customAttributes.length > 0
      ? `\n\n## Additional Context\n\n${customAttributes.map(([k, v]) => `${k}: ${v}`).join('\n')}`
      : ''

  return `## Input

${input}

## Expected Output

${expectedOutput}${contextSection}

Evaluate the output above against the criteria and return your assessment.`
}
