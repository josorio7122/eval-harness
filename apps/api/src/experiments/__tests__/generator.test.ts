import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: vi.fn(() => vi.fn((model: string) => ({ model }))),
}))

import { generateText } from 'ai'
import { generateOutput } from '../generator.js'

const mockGenerateText = vi.mocked(generateText)

beforeEach(() => {
  vi.resetAllMocks()
})

describe('generateOutput', () => {
  it('substitutes {input} in userPrompt correctly', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'some output',
    } as Awaited<ReturnType<typeof generateText>>)

    await generateOutput({
      systemPrompt: 'You are helpful.',
      userPrompt: 'Answer this: {input}',
      modelId: 'test/model',
      modelParams: {},
      input: 'What is 2+2?',
    })

    const call = mockGenerateText.mock.calls[0][0]
    const messages = call.messages!
    expect(messages[1].content).toBe('Answer this: What is 2+2?')
  })

  it('substitutes multiple {input} occurrences', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'output',
    } as Awaited<ReturnType<typeof generateText>>)

    await generateOutput({
      systemPrompt: 'system',
      userPrompt: '{input} and also {input}',
      modelId: 'test/model',
      modelParams: {},
      input: 'hello',
    })

    const call = mockGenerateText.mock.calls[0][0]
    const messages = call.messages!
    expect(messages[1].content).toBe('hello and also hello')
  })

  it('returns output text on success', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'generated answer',
    } as Awaited<ReturnType<typeof generateText>>)

    const result = await generateOutput({
      systemPrompt: 'system',
      userPrompt: '{input}',
      modelId: 'test/model',
      modelParams: {},
      input: 'hello',
    })

    expect(result).toEqual({ output: 'generated answer', error: null })
  })

  it('returns error on LLM failure', async () => {
    mockGenerateText.mockRejectedValue(new Error('API timeout'))

    const result = await generateOutput({
      systemPrompt: 'system',
      userPrompt: '{input}',
      modelId: 'test/model',
      modelParams: {},
      input: 'hello',
    })

    expect(result).toEqual({ output: '', error: 'API timeout' })
  })

  it('returns error with "Unknown error" for non-Error throws', async () => {
    mockGenerateText.mockRejectedValue('string error')

    const result = await generateOutput({
      systemPrompt: 'system',
      userPrompt: '{input}',
      modelId: 'test/model',
      modelParams: {},
      input: 'hello',
    })

    expect(result).toEqual({ output: '', error: 'Unknown error' })
  })

  it('passes temperature from modelParams', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'output',
    } as Awaited<ReturnType<typeof generateText>>)

    await generateOutput({
      systemPrompt: 'system',
      userPrompt: '{input}',
      modelId: 'test/model',
      modelParams: { temperature: 0.7 },
      input: 'hello',
    })

    const call = mockGenerateText.mock.calls[0][0]
    expect(call.temperature).toBe(0.7)
  })

  it('passes maxTokens from modelParams as maxOutputTokens', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'output',
    } as Awaited<ReturnType<typeof generateText>>)

    await generateOutput({
      systemPrompt: 'system',
      userPrompt: '{input}',
      modelId: 'test/model',
      modelParams: { maxTokens: 512 },
      input: 'hello',
    })

    const call = mockGenerateText.mock.calls[0][0]
    expect(call.maxOutputTokens).toBe(512)
  })

  it('passes topP from modelParams', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'output',
    } as Awaited<ReturnType<typeof generateText>>)

    await generateOutput({
      systemPrompt: 'system',
      userPrompt: '{input}',
      modelId: 'test/model',
      modelParams: { topP: 0.9 },
      input: 'hello',
    })

    const call = mockGenerateText.mock.calls[0][0]
    expect(call.topP).toBe(0.9)
  })

  it('does not pass temperature/maxOutputTokens/topP when absent from modelParams', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'output',
    } as Awaited<ReturnType<typeof generateText>>)

    await generateOutput({
      systemPrompt: 'system',
      userPrompt: '{input}',
      modelId: 'test/model',
      modelParams: {},
      input: 'hello',
    })

    const call = mockGenerateText.mock.calls[0][0]
    expect(call.temperature).toBeUndefined()
    expect(call.maxOutputTokens).toBeUndefined()
    expect(call.topP).toBeUndefined()
  })

  it('passes systemPrompt as system message', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'output',
    } as Awaited<ReturnType<typeof generateText>>)

    await generateOutput({
      systemPrompt: 'You are a helpful assistant.',
      userPrompt: '{input}',
      modelId: 'test/model',
      modelParams: {},
      input: 'hello',
    })

    const call = mockGenerateText.mock.calls[0][0]
    const messages = call.messages!
    expect(messages[0].role).toBe('system')
    expect(messages[0].content).toBe('You are a helpful assistant.')
  })
})
