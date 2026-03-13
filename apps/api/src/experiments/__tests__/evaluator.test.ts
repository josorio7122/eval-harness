import { describe, it, expect, vi, beforeEach } from 'vitest'

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
import type { GenerateTextResult } from 'ai'
import { evaluate } from '../evaluator.js'

const mockGenerateText = vi.mocked(generateText)

beforeEach(() => {
  vi.resetAllMocks()
})

describe('evaluate', () => {
  it('returns pass verdict when LLM returns pass', async () => {
    mockGenerateText.mockResolvedValue({
      output: { verdict: 'pass', reason: 'Looks good' },
    } as unknown as GenerateTextResult<Record<string, never>, never>)

    const result = await evaluate('Grade this response', { input: 'hello', output: 'world' })

    expect(result).toEqual({ verdict: 'pass', reason: 'Looks good' })
    expect(mockGenerateText).toHaveBeenCalledOnce()
  })

  it('returns fail verdict when LLM returns fail', async () => {
    mockGenerateText.mockResolvedValue({
      output: { verdict: 'fail', reason: 'Does not match' },
    } as unknown as GenerateTextResult<Record<string, never>, never>)

    const result = await evaluate('Grade this response', { input: 'hello', output: 'bad' })

    expect(result).toEqual({ verdict: 'fail', reason: 'Does not match' })
  })

  it('passes rubric as system prompt and item attributes as prompt', async () => {
    mockGenerateText.mockResolvedValue({
      output: { verdict: 'pass', reason: 'ok' },
    } as unknown as GenerateTextResult<Record<string, never>, never>)

    await evaluate('Check quality', { input: 'foo', expected_output: 'bar' })

    const call = mockGenerateText.mock.calls[0][0]
    expect(call.system).toBe('Check quality')
    expect(call.prompt).toContain('input: foo')
    expect(call.prompt).toContain('expected_output: bar')
  })

  it('throws when generateText rejects', async () => {
    mockGenerateText.mockRejectedValue(new Error('API error'))

    await expect(evaluate('rubric', { input: 'test' })).rejects.toThrow('API error')
  })
})
