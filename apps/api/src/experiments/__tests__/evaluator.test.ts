import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: {
    object: vi.fn(() => ({})),
  },
}))

vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: vi.fn(() => vi.fn((model: string) => ({ model }))),
}))

import { generateText } from 'ai'
import { evaluate } from '../evaluator.js'

const mockGenerateText = vi.mocked(generateText)

beforeEach(() => {
  vi.resetAllMocks()
  vi.unstubAllEnvs()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('evaluate', () => {
  it('returns pass verdict when LLM returns pass', async () => {
    mockGenerateText.mockResolvedValue({
      output: { verdict: 'pass', reason: 'Looks good' },
    } as unknown as Awaited<ReturnType<typeof generateText>>)

    const result = await evaluate(
      'Grade this response',
      { input: 'hello', expected_output: 'world' },
      'openai/gpt-4o',
    )

    expect(result).toEqual({ verdict: 'pass', reason: 'Looks good' })
    expect(mockGenerateText).toHaveBeenCalledOnce()
  })

  it('returns fail verdict when LLM returns fail', async () => {
    mockGenerateText.mockResolvedValue({
      output: { verdict: 'fail', reason: 'Does not match' },
    } as unknown as Awaited<ReturnType<typeof generateText>>)

    const result = await evaluate(
      'Grade this response',
      { input: 'hello', expected_output: 'bad' },
      'openai/gpt-4o',
    )

    expect(result).toEqual({ verdict: 'fail', reason: 'Does not match' })
  })

  it('passes rubric as system prompt and item attributes as prompt', async () => {
    mockGenerateText.mockResolvedValue({
      output: { verdict: 'pass', reason: 'ok' },
    } as unknown as Awaited<ReturnType<typeof generateText>>)

    await evaluate('Check quality', { input: 'foo', expected_output: 'bar' }, 'openai/gpt-4o')

    const call = mockGenerateText.mock.calls[0][0]
    const messages = call.messages!
    expect(messages[0].content).toContain('Check quality')
    expect(messages[1].content).toContain('## Input')
    expect(messages[1].content).toContain('foo')
    expect(messages[1].content).toContain('## Response')
    expect(messages[1].content).toContain('bar')
  })

  it('throws when generateText rejects', async () => {
    mockGenerateText.mockRejectedValue(new Error('API error'))

    await expect(
      evaluate('rubric', { input: 'test', expected_output: 'result' }, 'openai/gpt-4o'),
    ).rejects.toThrow('API error')
  })

  it('throws when input is missing from itemAttributes', async () => {
    await expect(
      evaluate('rubric', { expected_output: 'result' }, 'openai/gpt-4o'),
    ).rejects.toThrow('Missing required field: input')
  })

  it('throws when expected_output is missing from itemAttributes', async () => {
    await expect(evaluate('rubric', { input: 'hello' }, 'openai/gpt-4o')).rejects.toThrow(
      'Missing required field: expected_output',
    )
  })

  it('passes modelId directly to openrouter with no fallback', async () => {
    mockGenerateText.mockResolvedValue({
      output: { verdict: 'pass', reason: 'ok' },
    } as unknown as Awaited<ReturnType<typeof generateText>>)

    await evaluate(
      'rubric',
      { input: 'hello', expected_output: 'world' },
      'anthropic/claude-3-5-sonnet',
    )

    // The openrouter mock returns { model: modelId } — verify the model passed to generateText
    const call = mockGenerateText.mock.calls[0][0]
    expect((call.model as unknown as { model: string }).model).toBe('anthropic/claude-3-5-sonnet')
  })
})
