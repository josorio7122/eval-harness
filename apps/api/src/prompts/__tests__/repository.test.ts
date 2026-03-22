import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPromptRepository } from '../repository.js'

const mockPromptVersion = {
  findFirstOrThrow: vi.fn(),
}

const mockPrisma = {
  promptVersion: mockPromptVersion,
} as unknown as Parameters<typeof createPromptRepository>[0]

const repo = createPromptRepository(mockPrisma)

beforeEach(() => {
  vi.resetAllMocks()
})

describe('findVersionById', () => {
  it('returns ok(version) when version exists and promptId matches', async () => {
    const version = {
      id: 'v1',
      promptId: 'p1',
      version: 1,
      systemPrompt: 'You are helpful.',
      userPrompt: 'Answer: {{input}}',
      modelId: 'openai/gpt-4o',
      modelParams: { temperature: 0.7 },
      createdAt: new Date('2024-01-01T00:00:00Z'),
    }
    mockPromptVersion.findFirstOrThrow.mockResolvedValue(version)

    const result = await repo.findVersionById('p1', 'v1')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(version)
    }
    expect(mockPromptVersion.findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: 'v1', promptId: 'p1' },
      select: {
        id: true,
        promptId: true,
        version: true,
        systemPrompt: true,
        userPrompt: true,
        modelId: true,
        modelParams: true,
        createdAt: true,
      },
    })
  })

  it('returns fail when versionId exists but belongs to a different promptId', async () => {
    const notFoundError = new Error('No PromptVersion found')
    notFoundError.name = 'NotFoundError'
    mockPromptVersion.findFirstOrThrow.mockRejectedValue(notFoundError)

    const result = await repo.findVersionById('p-other', 'v1')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Record not found')
    }
  })

  it('returns fail when versionId does not exist at all', async () => {
    const notFoundError = new Error('No PromptVersion found')
    notFoundError.name = 'NotFoundError'
    mockPromptVersion.findFirstOrThrow.mockRejectedValue(notFoundError)

    const result = await repo.findVersionById('p1', 'nonexistent-id')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Record not found')
    }
  })
})
