import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '../../lib/prisma.js'
import { unwrap } from './helpers.js'
import { createPromptRepository } from '../../prompts/repository.js'
import { createPromptService } from '../../prompts/service.js'
import { createPromptRouter } from '../../prompts/router.js'

// Mock the 'ai' module so no real LLM calls are made
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return {
    ...actual,
    streamText: vi.fn(() => ({
      toUIMessageStreamResponse: () =>
        new Response('data: hello\n\n', {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
        }),
    })),
  }
})

const repo = createPromptRepository(prisma)
const service = createPromptService(repo)
const app = createPromptRouter(service)

const basePrompt = {
  name: 'playground-test-prompt',
  systemPrompt: 'You are a helpful assistant.',
  userPrompt: 'Answer the following: {input}',
  modelId: 'openai/gpt-4o',
}

function jsonPost(path: string, body: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "PromptVersion", "Prompt" CASCADE')
})

describe('POST /prompts/:id/playground', () => {
  it('streams response for valid first message', async () => {
    const prompt = unwrap(await repo.create(basePrompt))
    const versionId = prompt.versions[0].id

    const res = await jsonPost(`/prompts/${prompt.id}/playground`, {
      versionId,
      messages: [{ role: 'user', content: 'What is the capital of France?' }],
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
  })

  it('streams response for valid follow-up conversation (3 messages)', async () => {
    const prompt = unwrap(await repo.create(basePrompt))
    const versionId = prompt.versions[0].id

    const res = await jsonPost(`/prompts/${prompt.id}/playground`, {
      versionId,
      messages: [
        { role: 'user', content: 'What is the capital of France?' },
        { role: 'assistant', content: 'The capital of France is Paris.' },
        { role: 'user', content: 'What about Germany?' },
      ],
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
  })

  it('returns 400 with "Messages required" for empty messages array', async () => {
    const prompt = unwrap(await repo.create(basePrompt))
    const versionId = prompt.versions[0].id

    const res = await jsonPost(`/prompts/${prompt.id}/playground`, {
      versionId,
      messages: [],
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Messages required')
  })

  it('returns 404 with "Version not found" for non-existent versionId', async () => {
    const prompt = unwrap(await repo.create(basePrompt))

    const res = await jsonPost(`/prompts/${prompt.id}/playground`, {
      versionId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      messages: [{ role: 'user', content: 'Hello' }],
    })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Version not found')
  })

  it('returns 404 with "Version not found" when versionId belongs to a different prompt', async () => {
    const prompt1 = unwrap(await repo.create({ ...basePrompt, name: 'prompt-one' }))
    const prompt2 = unwrap(await repo.create({ ...basePrompt, name: 'prompt-two' }))
    const otherVersionId = prompt2.versions[0].id

    // Send version from prompt2 to prompt1's endpoint
    const res = await jsonPost(`/prompts/${prompt1.id}/playground`, {
      versionId: otherVersionId,
      messages: [{ role: 'user', content: 'Hello' }],
    })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Version not found')
  })

  it('returns 404 with "Prompt not found" for non-existent prompt id', async () => {
    const res = await jsonPost('/prompts/00000000-0000-0000-0000-000000000000/playground', {
      versionId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      messages: [{ role: 'user', content: 'Hello' }],
    })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Prompt not found')
  })

  it('returns 400 when last message is from assistant', async () => {
    const prompt = unwrap(await repo.create(basePrompt))
    const versionId = prompt.versions[0].id

    const res = await jsonPost(`/prompts/${prompt.id}/playground`, {
      versionId,
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ],
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Last message must be from user')
  })
})
