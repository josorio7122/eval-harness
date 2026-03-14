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
