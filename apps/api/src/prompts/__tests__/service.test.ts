import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ok, fail } from '@eval-harness/shared'
import { createPromptService } from '../service.js'

const mockVersion = {
  id: 'v1',
  promptId: 'p1',
  version: 1,
  systemPrompt: 'You are a helpful assistant.',
  userPrompt: 'Answer: {input}',
  modelId: 'openai/gpt-4o',
  modelParams: { temperature: 0.7 },
  createdAt: new Date('2024-01-01T00:00:00Z'),
}

const mockRepo = {
  findAll: vi.fn(),
  findById: vi.fn(),
  findByName: vi.fn(),
  create: vi.fn(),
  updateName: vi.fn(),
  createVersion: vi.fn(),
  findLatestVersion: vi.fn(),
  findVersionById: vi.fn(),
  remove: vi.fn(),
}

const service = createPromptService(
  mockRepo as unknown as Parameters<typeof createPromptService>[0],
)

beforeEach(() => {
  vi.resetAllMocks()
})

describe('buildPlaygroundMessages', () => {
  it('first message: substitutes {input} into userPrompt and returns system + user messages', async () => {
    mockRepo.findVersionById.mockResolvedValue(ok(mockVersion))

    const result = await service.buildPlaygroundMessages({
      promptId: 'p1',
      versionId: 'v1',
      messages: [{ role: 'user', content: 'hello' }],
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.version).toEqual(mockVersion)
      expect(result.data.llmMessages).toEqual([
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Answer: hello' },
      ])
    }
  })

  it('follow-up (3 messages): substitutes first user message and appends remaining verbatim', async () => {
    mockRepo.findVersionById.mockResolvedValue(ok(mockVersion))

    const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'tell me more' },
    ]

    const result = await service.buildPlaygroundMessages({
      promptId: 'p1',
      versionId: 'v1',
      messages,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.llmMessages).toEqual([
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Answer: hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'tell me more' },
      ])
      expect(result.data.llmMessages).toHaveLength(4)
    }
  })

  it('propagates failure when repo returns fail', async () => {
    mockRepo.findVersionById.mockResolvedValue(fail('Record not found'))

    const result = await service.buildPlaygroundMessages({
      promptId: 'p1',
      versionId: 'bad-version',
      messages: [{ role: 'user', content: 'hello' }],
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Record not found')
    }
  })

  it('empty systemPrompt: system message content is empty string', async () => {
    mockRepo.findVersionById.mockResolvedValue(ok({ ...mockVersion, systemPrompt: '' }))

    const result = await service.buildPlaygroundMessages({
      promptId: 'p1',
      versionId: 'v1',
      messages: [{ role: 'user', content: 'hello' }],
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.llmMessages[0]).toEqual({ role: 'system', content: '' })
    }
  })

  it('multiple {input} occurrences in userPrompt: all are replaced', async () => {
    mockRepo.findVersionById.mockResolvedValue(
      ok({ ...mockVersion, userPrompt: 'First: {input}. Second: {input}.' }),
    )

    const result = await service.buildPlaygroundMessages({
      promptId: 'p1',
      versionId: 'v1',
      messages: [{ role: 'user', content: 'world' }],
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.llmMessages[1]).toEqual({
        role: 'user',
        content: 'First: world. Second: world.',
      })
    }
  })
})
