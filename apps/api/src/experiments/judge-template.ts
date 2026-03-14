const SYSTEM_TEMPLATE = `You are an expert evaluator tasked with assessing whether a response meets defined quality criteria. You will be given an input and a response — your role is to judge the response against the criteria, not to generate one yourself.

## Evaluation Criteria

{rubric}

## Instructions

Apply the criteria above to the test case you will receive. Consider whether the response satisfies each aspect of the criteria, then reach a verdict.

Think through your evaluation carefully before concluding. Analyze what the response does well, where it falls short, and whether any shortcomings are significant enough to constitute a failure under the given criteria.`

const USER_TEMPLATE = `## Input

{input}

## Response

{expected_output}{context}

Evaluate the response above against the criteria and return your assessment.`

const CONTEXT_TEMPLATE = `

## Additional Context

{attributes}`

export function buildSystemPrompt(rubric: string) {
  return SYSTEM_TEMPLATE.replace('{rubric}', rubric)
}

export function buildUserMessage(itemAttributes: Record<string, string>) {
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
      ? CONTEXT_TEMPLATE.replace(
          '{attributes}',
          customAttributes.map(([k, v]) => `${k}: ${v}`).join('\n'),
        )
      : ''

  return USER_TEMPLATE.replace('{input}', input)
    .replace('{expected_output}', expectedOutput)
    .replace('{context}', contextSection)
}
