import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ok, fail } from '@eval-harness/shared'

vi.mock('ai', () => ({
  streamText: vi.fn(),
}))

vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: vi.fn(() => vi.fn((modelId: string) => ({ modelId }))),
}))

import { streamText } from 'ai'
import { Hono } from 'hono'
import { createPromptRouter } from '../router.js'
import { type createPromptService } from '../service.js'

type PromptService = ReturnType<typeof createPromptService>

const mockStreamText = vi.mocked(streamText)

const mockVersion = {
  id: 'v1',
  promptId: 'p1',
  version: 1,
  systemPrompt: 'You are helpful.',
  userPrompt: 'Answer: {input}',
  modelId: 'openai/gpt-4o',
  modelParams: { temperature: 0.7, maxTokens: 512, topP: 0.9 },
  createdAt: new Date('2024-01-01'),
}

const mockService = {
  listPrompts: vi.fn(),
  getPrompt: vi.fn(),
  createPrompt: vi.fn(),
  updatePromptName: vi.fn(),
  createVersion: vi.fn(),
  deletePrompt: vi.fn(),
  buildPlaygroundMessages: vi.fn(),
} as unknown as PromptService

const router = createPromptRouter(mockService)
const app = new Hono()
app.route('/', router)

beforeEach(() => {
  vi.resetAllMocks()
})

const VALID_VERSION_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
const PROMPT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

describe('POST /prompts/:id/playground', () => {
  it('returns 400 with "Messages required" when messages array is empty', async () => {
    const res = await app.request(`/prompts/${PROMPT_ID}/playground`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        versionId: VALID_VERSION_ID,
        messages: [],
        isFirstMessage: true,
      }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Messages required')
  })

  it('returns 400 with "Last message must be from user" when last message is assistant', async () => {
    const res = await app.request(`/prompts/${PROMPT_ID}/playground`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        versionId: VALID_VERSION_ID,
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' },
        ],
        isFirstMessage: false,
      }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Last message must be from user')
  })

  it('returns 404 when service fails with "not found" error', async () => {
    vi.mocked(mockService.buildPlaygroundMessages).mockResolvedValue(fail('Version not found'))

    const res = await app.request(`/prompts/${PROMPT_ID}/playground`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        versionId: VALID_VERSION_ID,
        messages: [{ role: 'user', content: 'Hello' }],
        isFirstMessage: true,
      }),
    })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Version not found')
  })

  it('returns 400 when service fails with a non-not-found error', async () => {
    vi.mocked(mockService.buildPlaygroundMessages).mockResolvedValue(fail('Some unexpected error'))

    const res = await app.request(`/prompts/${PROMPT_ID}/playground`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        versionId: VALID_VERSION_ID,
        messages: [{ role: 'user', content: 'Hello' }],
        isFirstMessage: true,
      }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Some unexpected error')
  })

  it('returns 200 with text/event-stream content-type on success', async () => {
    vi.mocked(mockService.buildPlaygroundMessages).mockResolvedValue(
      ok({ version: mockVersion, llmMessages: [{ role: 'user', content: 'Answer: Hello' }] }),
    )

    const fakeStreamResponse = new Response('data: hello\n\n', {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    })
    mockStreamText.mockReturnValue({
      toUIMessageStreamResponse: () => fakeStreamResponse,
    } as unknown as ReturnType<typeof streamText>)

    const res = await app.request(`/prompts/${PROMPT_ID}/playground`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        versionId: VALID_VERSION_ID,
        messages: [{ role: 'user', content: 'Hello' }],
        isFirstMessage: true,
      }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
  })

  it('returns 404 with "Prompt not found" when buildPlaygroundMessages returns that error', async () => {
    vi.mocked(mockService.buildPlaygroundMessages).mockResolvedValue(fail('Prompt not found'))

    const res = await app.request(`/prompts/${PROMPT_ID}/playground`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        versionId: VALID_VERSION_ID,
        messages: [{ role: 'user', content: 'Hello' }],
        isFirstMessage: true,
      }),
    })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Prompt not found')
  })

  it('calls buildPlaygroundMessages with promptId, versionId, and messages (not isFirstMessage)', async () => {
    vi.mocked(mockService.buildPlaygroundMessages).mockResolvedValue(
      ok({ version: mockVersion, llmMessages: [{ role: 'user', content: 'Answer: Hello' }] }),
    )

    const fakeStreamResponse = new Response('data: hello\n\n', {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    })
    mockStreamText.mockReturnValue({
      toUIMessageStreamResponse: () => fakeStreamResponse,
    } as unknown as ReturnType<typeof streamText>)

    await app.request(`/prompts/${PROMPT_ID}/playground`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        versionId: VALID_VERSION_ID,
        messages: [{ role: 'user', content: 'Hello' }],
        isFirstMessage: true,
      }),
    })

    expect(vi.mocked(mockService.buildPlaygroundMessages)).toHaveBeenCalledWith({
      promptId: PROMPT_ID,
      versionId: VALID_VERSION_ID,
      messages: [{ role: 'user', content: 'Hello' }],
    })
  })

  it('calls streamText with modelParams spread conditionally', async () => {
    vi.mocked(mockService.buildPlaygroundMessages).mockResolvedValue(
      ok({ version: mockVersion, llmMessages: [{ role: 'user', content: 'Answer: Hello' }] }),
    )

    const fakeStreamResponse = new Response('data: hello\n\n', {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    })
    mockStreamText.mockReturnValue({
      toUIMessageStreamResponse: () => fakeStreamResponse,
    } as unknown as ReturnType<typeof streamText>)

    await app.request(`/prompts/${PROMPT_ID}/playground`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        versionId: VALID_VERSION_ID,
        messages: [{ role: 'user', content: 'Hello' }],
        isFirstMessage: true,
      }),
    })

    const call = mockStreamText.mock.calls[0][0]
    expect(call.temperature).toBe(0.7)
    expect(call.maxOutputTokens).toBe(512)
    expect(call.topP).toBe(0.9)
  })
})
