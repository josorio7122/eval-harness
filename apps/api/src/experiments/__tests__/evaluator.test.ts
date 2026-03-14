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

    const result = await evaluate('Grade this response', {
      input: 'hello',
      expected_output: 'world',
    })

    expect(result).toEqual({ verdict: 'pass', reason: 'Looks good' })
    expect(mockGenerateText).toHaveBeenCalledOnce()
  })

  it('returns fail verdict when LLM returns fail', async () => {
    mockGenerateText.mockResolvedValue({
      output: { verdict: 'fail', reason: 'Does not match' },
    } as unknown as Awaited<ReturnType<typeof generateText>>)

    const result = await evaluate('Grade this response', { input: 'hello', expected_output: 'bad' })

    expect(result).toEqual({ verdict: 'fail', reason: 'Does not match' })
  })

  it('passes rubric as system prompt and item attributes as prompt', async () => {
    mockGenerateText.mockResolvedValue({
      output: { verdict: 'pass', reason: 'ok' },
    } as unknown as Awaited<ReturnType<typeof generateText>>)

    await evaluate('Check quality', { input: 'foo', expected_output: 'bar' })

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

    await expect(evaluate('rubric', { input: 'test', expected_output: 'result' })).rejects.toThrow(
      'API error',
    )
  })

  it('throws when input is missing from itemAttributes', async () => {
    await expect(evaluate('rubric', { expected_output: 'result' })).rejects.toThrow(
      'Missing required field: input',
    )
  })

  it('throws when expected_output is missing from itemAttributes', async () => {
    await expect(evaluate('rubric', { input: 'hello' })).rejects.toThrow(
      'Missing required field: expected_output',
    )
  })

  it('uses provided modelId instead of env var', async () => {
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

  it('falls back to env var when modelId is not provided', async () => {
    mockGenerateText.mockResolvedValue({
      output: { verdict: 'pass', reason: 'ok' },
    } as unknown as Awaited<ReturnType<typeof generateText>>)

    vi.stubEnv('LLM_JUDGE_MODEL', 'env-model/test')
    await evaluate('rubric', { input: 'hello', expected_output: 'world' })

    const call = mockGenerateText.mock.calls[0][0]
    expect((call.model as unknown as { model: string }).model).toBe('env-model/test')
  })

  it('falls back to hardcoded default when modelId is undefined and LLM_JUDGE_MODEL is unset', async () => {
    mockGenerateText.mockResolvedValue({
      output: { verdict: 'pass', reason: 'ok' },
    } as unknown as Awaited<ReturnType<typeof generateText>>)

    vi.stubEnv('LLM_JUDGE_MODEL', '')
    await evaluate('rubric', { input: 'hello', expected_output: 'world' })

    const call = mockGenerateText.mock.calls[0][0]
    expect((call.model as unknown as { model: string }).model).toBe('google/gemini-2.5-flash')
  })
})
