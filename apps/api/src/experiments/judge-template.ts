const SYSTEM_TEMPLATE = `You are an expert evaluator assessing the quality of a customer support response.

You will receive:
- **Input**: the customer's message
- **Response**: a candidate reply to that customer

Your job is to judge whether the response meets the quality criteria below. Evaluate the response on its own merits — treat it as a real reply that would be sent to the customer.

## Evaluation Criteria

{rubric}

## Instructions

Apply the criteria above to the test case you will receive. Think through your evaluation carefully, then reach a verdict.`

const USER_TEMPLATE = `## Input

{input}

## Response

{expected_output}{context}

Evaluate the response above against the criteria and return your assessment.`

const USER_TEMPLATE_WITH_OUTPUT = `## Input

{input}

## Response

{output}

## Reference Output

{expected_output}{context}

Evaluate the generated response above against the criteria. Use the reference output as a quality standard for comparison.`

const CONTEXT_TEMPLATE = `

## Additional Context

{attributes}`

export function buildSystemPrompt(rubric: string) {
  return SYSTEM_TEMPLATE.replace('{rubric}', rubric)
}

export function buildUserMessage(itemAttributes: Record<string, string>, output?: string) {
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

  if (output !== undefined) {
    return USER_TEMPLATE_WITH_OUTPUT.replace('{input}', input)
      .replace('{output}', output)
      .replace('{expected_output}', expectedOutput)
      .replace('{context}', contextSection)
  }

  return USER_TEMPLATE.replace('{input}', input)
    .replace('{expected_output}', expectedOutput)
    .replace('{context}', contextSection)
}
