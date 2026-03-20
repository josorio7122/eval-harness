import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('ai', () => ({
  generateText: vi.fn(),
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
  it('returns pass verdict when LLM returns clean JSON', async () => {
    mockGenerateText.mockResolvedValue({
      text: '{"reason": "Looks good", "verdict": "pass"}',
    } as Awaited<ReturnType<typeof generateText>>)

    const result = await evaluate({
      rubric: 'Grade this response',
      itemAttributes: { input: 'hello', expected_output: 'world' },
      modelId: 'openai/gpt-4o',
    })

    expect(result).toEqual({ verdict: 'pass', reason: 'Looks good' })
    expect(mockGenerateText).toHaveBeenCalledOnce()
  })

  it('returns fail verdict when LLM returns clean JSON', async () => {
    mockGenerateText.mockResolvedValue({
      text: '{"reason": "Does not match", "verdict": "fail"}',
    } as Awaited<ReturnType<typeof generateText>>)

    const result = await evaluate({
      rubric: 'Grade this response',
      itemAttributes: { input: 'hello', expected_output: 'bad' },
      modelId: 'openai/gpt-4o',
    })

    expect(result).toEqual({ verdict: 'fail', reason: 'Does not match' })
  })

  it('parses JSON embedded in prose text', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'After reviewing the response, I conclude: {"reason": "Solid answer", "verdict": "pass"}',
    } as Awaited<ReturnType<typeof generateText>>)

    const result = await evaluate({
      rubric: 'Grade this response',
      itemAttributes: { input: 'hello', expected_output: 'world' },
      modelId: 'openai/gpt-4o',
    })

    expect(result).toEqual({ verdict: 'pass', reason: 'Solid answer' })
  })

  it('falls back to keyword detection when no valid JSON found — fail keyword', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'The response is missing key information. verdict: fail — it does not address the question.',
    } as Awaited<ReturnType<typeof generateText>>)

    const result = await evaluate({
      rubric: 'Grade this response',
      itemAttributes: { input: 'hello', expected_output: 'world' },
      modelId: 'openai/gpt-4o',
    })

    expect(result.verdict).toBe('fail')
  })

  it('falls back to keyword detection when no valid JSON found — pass keyword', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'The response looks correct. verdict: pass — it answers the question well.',
    } as Awaited<ReturnType<typeof generateText>>)

    const result = await evaluate({
      rubric: 'Grade this response',
      itemAttributes: { input: 'hello', expected_output: 'world' },
      modelId: 'openai/gpt-4o',
    })

    expect(result.verdict).toBe('pass')
  })

  it('throws when response contains no parseable verdict', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'I am unable to evaluate this response.',
    } as Awaited<ReturnType<typeof generateText>>)

    await expect(
      evaluate({
        rubric: 'rubric',
        itemAttributes: { input: 'test', expected_output: 'result' },
        modelId: 'openai/gpt-4o',
      }),
    ).rejects.toThrow('Could not parse verdict from response')
  })

  it('passes rubric as system prompt and item attributes as prompt', async () => {
    mockGenerateText.mockResolvedValue({
      text: '{"reason": "ok", "verdict": "pass"}',
    } as Awaited<ReturnType<typeof generateText>>)

    await evaluate({
      rubric: 'Check quality',
      itemAttributes: { input: 'foo', expected_output: 'bar' },
      modelId: 'openai/gpt-4o',
    })

    const call = mockGenerateText.mock.calls[0][0]
    const messages = call.messages!
    expect(messages[0].content).toContain('Check quality')
    expect(messages[1].content).toContain('## Input')
    expect(messages[1].content).toContain('foo')
    expect(messages[1].content).toContain('## Response')
    expect(messages[1].content).toContain('bar')
  })

  it('system prompt asks for JSON output format', async () => {
    mockGenerateText.mockResolvedValue({
      text: '{"reason": "ok", "verdict": "pass"}',
    } as Awaited<ReturnType<typeof generateText>>)

    await evaluate({
      rubric: 'Check quality',
      itemAttributes: { input: 'foo', expected_output: 'bar' },
      modelId: 'openai/gpt-4o',
    })

    const call = mockGenerateText.mock.calls[0][0]
    const messages = call.messages!
    expect(messages[0].content).toContain('{"reason"')
  })

  it('throws when generateText rejects', async () => {
    mockGenerateText.mockRejectedValue(new Error('API error'))

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
    mockGenerateText.mockResolvedValue({
      text: '{"reason": "ok", "verdict": "pass"}',
    } as Awaited<ReturnType<typeof generateText>>)

    await evaluate({
      rubric: 'rubric',
      itemAttributes: { input: 'hello', expected_output: 'world' },
      modelId: 'anthropic/claude-3-5-sonnet',
    })

    const call = mockGenerateText.mock.calls[0][0]
    // CAST: openrouter mock returns { model: string }, not a real LanguageModel
    expect((call.model as unknown as { model: string }).model).toBe('anthropic/claude-3-5-sonnet')
  })

  it('passes output to buildUserMessage when provided', async () => {
    mockGenerateText.mockResolvedValue({
      text: '{"reason": "ok", "verdict": "pass"}',
    } as Awaited<ReturnType<typeof generateText>>)

    await evaluate({
      rubric: 'Check quality',
      itemAttributes: { input: 'question', expected_output: 'reference answer' },
      modelId: 'openai/gpt-4o',
      output: 'generated response from LLM',
    })

    const call = mockGenerateText.mock.calls[0][0]
    const messages = call.messages!
    expect(messages[1].content).toContain('## Response\n\ngenerated response from LLM')
    expect(messages[1].content).toContain('## Reference Output\n\nreference answer')
  })

  it('uses expected_output as Response when no output provided (backward compat)', async () => {
    mockGenerateText.mockResolvedValue({
      text: '{"reason": "ok", "verdict": "pass"}',
    } as Awaited<ReturnType<typeof generateText>>)

    await evaluate({
      rubric: 'Check quality',
      itemAttributes: { input: 'question', expected_output: 'reference answer' },
      modelId: 'openai/gpt-4o',
    })

    const call = mockGenerateText.mock.calls[0][0]
    const messages = call.messages!
    expect(messages[1].content).toContain('## Response\n\nreference answer')
    expect(messages[1].content).not.toContain('## Reference Output')
  })

  it('does not use Output.object — no structured output mode', async () => {
    mockGenerateText.mockResolvedValue({
      text: '{"reason": "ok", "verdict": "pass"}',
    } as Awaited<ReturnType<typeof generateText>>)

    await evaluate({
      rubric: 'rubric',
      itemAttributes: { input: 'hello', expected_output: 'world' },
      modelId: 'openai/gpt-4o',
    })

    const call = mockGenerateText.mock.calls[0][0]
    // The new implementation must NOT pass an `output` option to generateText
    expect(call).not.toHaveProperty('output')
  })
})
