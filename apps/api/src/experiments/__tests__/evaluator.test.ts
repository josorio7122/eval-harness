import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}))

vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: vi.fn(() => vi.fn((model: string) => ({ model }))),
}))

import { generateObject } from 'ai'
import { evaluate } from '../evaluator.js'

const mockGenerateObject = vi.mocked(generateObject)

beforeEach(() => {
  vi.resetAllMocks()
  vi.unstubAllEnvs()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('evaluate', () => {
  it('calls generateObject with correct model and messages', async () => {
    mockGenerateObject.mockResolvedValue({
      object: { verdict: 'pass', reason: 'good' },
    } as Awaited<ReturnType<typeof generateObject>>)

    await evaluate({
      rubric: 'Check quality',
      itemAttributes: { input: 'foo', expected_output: 'bar' },
      modelId: 'openai/gpt-4o',
    })

    expect(mockGenerateObject).toHaveBeenCalledOnce()
    const call = mockGenerateObject.mock.calls[0][0]
    // CAST: openrouter mock returns { model: string }, not a real LanguageModel
    expect((call.model as unknown as { model: string }).model).toBe('openai/gpt-4o')
    const messages = call.messages!
    expect(messages[0].content).toContain('Check quality')
    expect(messages[1].content).toContain('## Input')
    expect(messages[1].content).toContain('foo')
    expect(messages[1].content).toContain('## Response')
    expect(messages[1].content).toContain('bar')
  })

  it('returns the verdict object directly from generateObject', async () => {
    mockGenerateObject.mockResolvedValue({
      object: { verdict: 'pass', reason: 'Looks good' },
    } as Awaited<ReturnType<typeof generateObject>>)

    const result = await evaluate({
      rubric: 'Grade this response',
      itemAttributes: { input: 'hello', expected_output: 'world' },
      modelId: 'openai/gpt-4o',
    })

    expect(result).toEqual({ verdict: 'pass', reason: 'Looks good' })
  })

  it('returns fail verdict from generateObject', async () => {
    mockGenerateObject.mockResolvedValue({
      object: { verdict: 'fail', reason: 'Does not match' },
    } as Awaited<ReturnType<typeof generateObject>>)

    const result = await evaluate({
      rubric: 'Grade this response',
      itemAttributes: { input: 'hello', expected_output: 'bad' },
      modelId: 'openai/gpt-4o',
    })

    expect(result).toEqual({ verdict: 'fail', reason: 'Does not match' })
  })

  it('passes output to buildUserMessage when provided', async () => {
    mockGenerateObject.mockResolvedValue({
      object: { verdict: 'pass', reason: 'ok' },
    } as Awaited<ReturnType<typeof generateObject>>)

    await evaluate({
      rubric: 'Check quality',
      itemAttributes: { input: 'question', expected_output: 'reference answer' },
      modelId: 'openai/gpt-4o',
      output: 'generated response from LLM',
    })

    const call = mockGenerateObject.mock.calls[0][0]
    const messages = call.messages!
    expect(messages[1].content).toContain('## Response\n\ngenerated response from LLM')
    expect(messages[1].content).toContain('## Reference Output\n\nreference answer')
  })

  it('does not include Reference Output section when no output provided', async () => {
    mockGenerateObject.mockResolvedValue({
      object: { verdict: 'pass', reason: 'ok' },
    } as Awaited<ReturnType<typeof generateObject>>)

    await evaluate({
      rubric: 'Check quality',
      itemAttributes: { input: 'question', expected_output: 'reference answer' },
      modelId: 'openai/gpt-4o',
    })

    const call = mockGenerateObject.mock.calls[0][0]
    const messages = call.messages!
    expect(messages[1].content).toContain('## Response\n\nreference answer')
    expect(messages[1].content).not.toContain('## Reference Output')
  })

  it('throws when generateObject rejects', async () => {
    mockGenerateObject.mockRejectedValue(new Error('API error'))

    await expect(
      evaluate({
        rubric: 'rubric',
        itemAttributes: { input: 'test', expected_output: 'result' },
        modelId: 'openai/gpt-4o',
      }),
    ).rejects.toThrow('API error')
  })

  it('throws when input is missing from itemAttributes', async () => {
    await expect(
      evaluate({
        rubric: 'rubric',
        itemAttributes: { expected_output: 'result' },
        modelId: 'openai/gpt-4o',
      }),
    ).rejects.toThrow('Missing required field: input')
  })

  it('throws when expected_output is missing from itemAttributes', async () => {
    await expect(
      evaluate({ rubric: 'rubric', itemAttributes: { input: 'hello' }, modelId: 'openai/gpt-4o' }),
    ).rejects.toThrow('Missing required field: expected_output')
  })

  it('passes modelId directly to openrouter with no fallback', async () => {
    mockGenerateObject.mockResolvedValue({
      object: { verdict: 'pass', reason: 'ok' },
    } as Awaited<ReturnType<typeof generateObject>>)

    await evaluate({
      rubric: 'rubric',
      itemAttributes: { input: 'hello', expected_output: 'world' },
      modelId: 'anthropic/claude-3-5-sonnet',
    })

    const call = mockGenerateObject.mock.calls[0][0]
    // CAST: openrouter mock returns { model: string }, not a real LanguageModel
    expect((call.model as unknown as { model: string }).model).toBe('anthropic/claude-3-5-sonnet')
  })
})
