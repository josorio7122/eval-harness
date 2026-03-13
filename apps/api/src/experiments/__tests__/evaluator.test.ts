import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}))

vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: vi.fn(() => vi.fn((model: string) => ({ model }))),
}))

import { generateObject } from 'ai'
import type { GenerateObjectResult } from 'ai'
import { evaluate } from '../evaluator.js'

const mockGenerateObject = vi.mocked(generateObject)

beforeEach(() => {
  vi.resetAllMocks()
})

describe('evaluate', () => {
  it('returns pass verdict when LLM returns pass', async () => {
    mockGenerateObject.mockResolvedValue({
      object: { verdict: 'pass', reason: 'Looks good' },
    } as unknown as GenerateObjectResult<{ verdict: string; reason: string }, never>)

    const result = await evaluate('Grade this response', { input: 'hello', output: 'world' })

    expect(result).toEqual({ verdict: 'pass', reason: 'Looks good' })
    expect(mockGenerateObject).toHaveBeenCalledOnce()
  })

  it('returns fail verdict when LLM returns fail', async () => {
    mockGenerateObject.mockResolvedValue({
      object: { verdict: 'fail', reason: 'Does not match' },
    } as unknown as GenerateObjectResult<{ verdict: string; reason: string }, never>)

    const result = await evaluate('Grade this response', { input: 'hello', output: 'bad' })

    expect(result).toEqual({ verdict: 'fail', reason: 'Does not match' })
  })

  it('passes rubric as system prompt and item attributes as prompt', async () => {
    mockGenerateObject.mockResolvedValue({
      object: { verdict: 'pass', reason: 'ok' },
    } as unknown as GenerateObjectResult<{ verdict: string; reason: string }, never>)

    await evaluate('Check quality', { input: 'foo', expected_output: 'bar' })

    const call = mockGenerateObject.mock.calls[0][0]
    expect(call.system).toBe('Check quality')
    expect(call.prompt).toContain('input: foo')
    expect(call.prompt).toContain('expected_output: bar')
  })

  it('throws when generateObject rejects', async () => {
    mockGenerateObject.mockRejectedValue(new Error('API error'))

    await expect(evaluate('rubric', { input: 'test' })).rejects.toThrow('API error')
  })
})
