import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, buildUserMessage } from '../judge-template.js'

describe('buildSystemPrompt', () => {
  it('includes the rubric text inside the Evaluation Criteria section', () => {
    const prompt = buildSystemPrompt('The response must be factually correct.')
    expect(prompt).toContain('## Evaluation Criteria\n\nThe response must be factually correct.')
  })

  it('includes the role declaration at the start', () => {
    const prompt = buildSystemPrompt('any rubric')
    expect(prompt).toMatch(
      /^You are an expert evaluator assessing the quality of a customer support response\./,
    )
  })

  it('includes an Instructions section', () => {
    const prompt = buildSystemPrompt('any rubric')
    expect(prompt).toContain('## Instructions')
  })
})

describe('buildUserMessage', () => {
  it('renders input under Input heading and expected_output under Response heading', () => {
    const msg = buildUserMessage({ input: 'hello', expected_output: 'world' })
    expect(msg).toContain('## Input\n\nhello')
    expect(msg).toContain('## Response\n\nworld')
  })

  it('omits the Additional Context section when no custom attributes', () => {
    const msg = buildUserMessage({ input: 'hello', expected_output: 'world' })
    expect(msg).not.toContain('## Additional Context')
  })

  it('renders custom attributes under Additional Context when present', () => {
    const msg = buildUserMessage({
      input: 'hello',
      expected_output: 'world',
      tone: 'formal',
      language: 'english',
    })
    expect(msg).toContain('## Additional Context')
    expect(msg).toContain('tone: formal')
    expect(msg).toContain('language: english')
  })

  it('throws when input is missing', () => {
    expect(() => buildUserMessage({ expected_output: 'world' })).toThrow(
      'Missing required field: input',
    )
  })

  it('throws when expected_output is missing', () => {
    expect(() => buildUserMessage({ input: 'hello' })).toThrow(
      'Missing required field: expected_output',
    )
  })

  it('ends with the evaluation request sentence', () => {
    const msg = buildUserMessage({ input: 'hello', expected_output: 'world' })
    expect(msg).toMatch(
      /Evaluate the response above against the criteria and return your assessment\.\s*$/,
    )
  })

  it('does not include input or expected_output in Additional Context', () => {
    const msg = buildUserMessage({ input: 'hello', expected_output: 'world', extra: 'data' })
    const contextSection = msg.split('## Additional Context')[1] ?? ''
    expect(contextSection).not.toContain('input:')
    expect(contextSection).not.toContain('expected_output:')
  })
})

describe('buildUserMessage with output', () => {
  it('uses generated output as Response and expected_output as Reference Output', () => {
    const msg = buildUserMessage({ input: 'hello', expected_output: 'world' }, 'generated response')
    expect(msg).toContain('## Response\n\ngenerated response')
    expect(msg).toContain('## Reference Output\n\nworld')
  })

  it('does not use expected_output as the Response when output is provided', () => {
    const msg = buildUserMessage({ input: 'hello', expected_output: 'world' }, 'generated response')
    // Response section should contain generated response, not expected_output
    const responseSection = msg.split('## Response\n\n')[1]?.split('\n\n')[0]
    expect(responseSection).toBe('generated response')
  })

  it('includes input under Input heading', () => {
    const msg = buildUserMessage({ input: 'hello', expected_output: 'world' }, 'my output')
    expect(msg).toContain('## Input\n\nhello')
  })

  it('ends with the quality standard sentence', () => {
    const msg = buildUserMessage({ input: 'hello', expected_output: 'world' }, 'my output')
    expect(msg).toMatch(/Use the reference output as a quality standard for comparison\.\s*$/)
  })

  it('includes context section when custom attributes exist', () => {
    const msg = buildUserMessage(
      { input: 'hello', expected_output: 'world', tone: 'formal' },
      'my output',
    )
    expect(msg).toContain('## Additional Context')
    expect(msg).toContain('tone: formal')
  })

  it('omits Additional Context section when no custom attributes', () => {
    const msg = buildUserMessage({ input: 'hello', expected_output: 'world' }, 'my output')
    expect(msg).not.toContain('## Additional Context')
  })

  it('throws when input is missing even with output provided', () => {
    expect(() => buildUserMessage({ expected_output: 'world' }, 'output')).toThrow(
      'Missing required field: input',
    )
  })

  it('throws when expected_output is missing even with output provided', () => {
    expect(() => buildUserMessage({ input: 'hello' }, 'output')).toThrow(
      'Missing required field: expected_output',
    )
  })
})
