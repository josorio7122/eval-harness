import { describe, it, expect, beforeEach } from 'vitest'
import { type Result } from '@eval-harness/shared'
import { prisma } from '../../lib/prisma.js'

// These imports will fail until implementation exists — that's the RED phase
import { createPromptRepository } from '../../prompts/repository.js'
import { createPromptService } from '../../prompts/service.js'
import { createPromptRouter } from '../../prompts/router.js'

const repo = createPromptRepository(prisma)
const service = createPromptService(repo)
const app = createPromptRouter(service)

/** Extract data from Result, fail test if not successful */
function unwrap<T>(result: Result<T>): T {
  expect(result.success).toBe(true)
  if (!result.success) throw new Error(result.error)
  return result.data
}

function jsonPost(path: string, body: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function jsonPatch(path: string, body: unknown) {
  return app.request(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const basePrompt = {
  name: 'test-prompt',
  systemPrompt: 'You are a helpful assistant.',
  userPrompt: 'Answer the question: {{input}}',
  modelId: 'openai/gpt-4o',
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "PromptVersion", "Prompt" CASCADE')
})

// ─── Repository tests ────────────────────────────────────────────────────────

describe('prompts repository (integration)', () => {
  it('create returns prompt with version 1', async () => {
    const result = await repo.create(basePrompt)
    const created = unwrap(result)

    expect(created.id).toBeTruthy()
    expect(created.name).toBe('test-prompt')
    expect(created.versions).toHaveLength(1)
    expect(created.versions[0].version).toBe(1)
    expect(created.versions[0].systemPrompt).toBe('You are a helpful assistant.')
    expect(created.versions[0].userPrompt).toBe('Answer the question: {{input}}')
    expect(created.versions[0].modelId).toBe('openai/gpt-4o')
  })

  it('create stores modelParams when provided', async () => {
    const result = await repo.create({
      ...basePrompt,
      modelParams: { temperature: 0.7, maxTokens: 500 },
    })
    const created = unwrap(result)
    const params = created.versions[0].modelParams as Record<string, unknown>

    expect(params['temperature']).toBe(0.7)
    expect(params['maxTokens']).toBe(500)
  })

  it('findAll returns non-deleted prompts with versionCount and latestVersion', async () => {
    const p1 = unwrap(await repo.create({ ...basePrompt, name: 'prompt-alpha' }))
    const p2 = unwrap(await repo.create({ ...basePrompt, name: 'prompt-beta' }))

    const all = unwrap(await repo.findAll())
    const ids = all.map((p) => p.id)

    expect(ids).toContain(p1.id)
    expect(ids).toContain(p2.id)

    const found = all.find((p) => p.id === p1.id)!
    expect(found.versionCount).toBe(1)
    expect(found.latestVersion).toBeDefined()
    expect(found.latestVersion!.version).toBe(1)
  })

  it('findAll orders by latest version createdAt DESC', async () => {
    const p1 = unwrap(await repo.create({ ...basePrompt, name: 'first-created' }))
    const p2 = unwrap(await repo.create({ ...basePrompt, name: 'second-created' }))

    const all = unwrap(await repo.findAll())
    const ids = all.map((p) => p.id)

    // second-created should appear before first-created (newer first)
    expect(ids.indexOf(p2.id)).toBeLessThan(ids.indexOf(p1.id))
  })

  it('findById returns prompt with all versions ordered DESC', async () => {
    const created = unwrap(await repo.create(basePrompt))
    // Create a second version
    unwrap(
      await repo.createVersion(created.id, {
        systemPrompt: 'Updated system',
        userPrompt: 'Updated user',
        modelId: 'openai/gpt-4o',
      }),
    )

    const found = unwrap(await repo.findById(created.id))
    expect(found.versions).toHaveLength(2)
    expect(found.versions[0].version).toBe(2)
    expect(found.versions[1].version).toBe(1)
  })

  it('findById fails for non-existent id', async () => {
    const result = await repo.findById('00000000-0000-0000-0000-000000000000')
    expect(result.success).toBe(false)
  })

  it('findById fails for soft-deleted prompt', async () => {
    const created = unwrap(await repo.create(basePrompt))
    unwrap(await repo.remove(created.id))

    const result = await repo.findById(created.id)
    expect(result.success).toBe(false)
  })

  it('findByName returns null for non-existent name', async () => {
    const found = await repo.findByName('no-such-prompt')
    expect(found).toBeNull()
  })

  it('findByName returns null for soft-deleted prompt', async () => {
    const created = unwrap(await repo.create(basePrompt))
    unwrap(await repo.remove(created.id))

    const found = await repo.findByName(basePrompt.name)
    expect(found).toBeNull()
  })

  it('findByName returns the prompt when it exists', async () => {
    const created = unwrap(await repo.create(basePrompt))
    const found = await repo.findByName(basePrompt.name)

    expect(found).not.toBeNull()
    expect(found!.id).toBe(created.id)
  })

  it('updateName changes the prompt name', async () => {
    const created = unwrap(await repo.create(basePrompt))
    unwrap(await repo.updateName(created.id, 'new-name'))

    const found = unwrap(await repo.findById(created.id))
    expect(found.name).toBe('new-name')
  })

  it('updateName fails for non-existent id', async () => {
    const result = await repo.updateName('00000000-0000-0000-0000-000000000000', 'name')
    expect(result.success).toBe(false)
  })

  it('createVersion increments version number', async () => {
    const created = unwrap(await repo.create(basePrompt))

    const v2 = unwrap(
      await repo.createVersion(created.id, {
        systemPrompt: 'System v2',
        userPrompt: 'User v2',
        modelId: 'openai/gpt-4o',
      }),
    )

    expect(v2.version).toBe(2)
    expect(v2.systemPrompt).toBe('System v2')
    expect(v2.promptId).toBe(created.id)
  })

  it('createVersion assigns version 3 after two existing versions', async () => {
    const created = unwrap(await repo.create(basePrompt))
    unwrap(
      await repo.createVersion(created.id, {
        systemPrompt: 'v2',
        userPrompt: 'v2',
        modelId: 'openai/gpt-4o',
      }),
    )
    const v3 = unwrap(
      await repo.createVersion(created.id, {
        systemPrompt: 'v3',
        userPrompt: 'v3',
        modelId: 'openai/gpt-4o',
      }),
    )

    expect(v3.version).toBe(3)
  })

  it('remove soft-deletes so findById returns fail', async () => {
    const created = unwrap(await repo.create(basePrompt))
    unwrap(await repo.remove(created.id))

    const result = await repo.findById(created.id)
    expect(result.success).toBe(false)
  })

  it('remove fails for non-existent id', async () => {
    const result = await repo.remove('00000000-0000-0000-0000-000000000000')
    expect(result.success).toBe(false)
  })

  it('soft-deleted prompt does not appear in findAll', async () => {
    const created = unwrap(await repo.create(basePrompt))
    unwrap(await repo.remove(created.id))

    const all = unwrap(await repo.findAll())
    const ids = all.map((p) => p.id)
    expect(ids).not.toContain(created.id)
  })

  it('soft-deleted name can be reused to create a new prompt', async () => {
    const original = unwrap(await repo.create(basePrompt))
    unwrap(await repo.remove(original.id))

    const reused = unwrap(await repo.create(basePrompt))
    expect(reused.id).not.toBe(original.id)
    expect(reused.name).toBe(basePrompt.name)
  })
})

// ─── Service tests ────────────────────────────────────────────────────────────

describe('prompts service (integration)', () => {
  it('createPrompt creates successfully', async () => {
    const result = await service.createPrompt(basePrompt)
    const created = unwrap(result)

    expect(created.name).toBe(basePrompt.name)
    expect(created.versions).toHaveLength(1)
  })

  it('createPrompt rejects duplicate name', async () => {
    unwrap(await service.createPrompt(basePrompt))
    const result = await service.createPrompt(basePrompt)

    expect(result.success).toBe(false)
    expect(result.success === false && result.error).toMatch(/already exists/i)
  })

  it('createPrompt allows name reuse after soft-delete', async () => {
    const first = unwrap(await service.createPrompt(basePrompt))
    unwrap(await service.deletePrompt(first.id))

    const second = unwrap(await service.createPrompt(basePrompt))
    expect(second.id).not.toBe(first.id)
  })

  it('updatePromptName rejects duplicate name from another prompt', async () => {
    unwrap(await service.createPrompt({ ...basePrompt, name: 'name-a' }))
    const p2 = unwrap(await service.createPrompt({ ...basePrompt, name: 'name-b' }))

    const result = await service.updatePromptName(p2.id, 'name-a')
    expect(result.success).toBe(false)
    expect(result.success === false && result.error).toMatch(/already exists/i)
  })

  it('updatePromptName allows updating to the same name', async () => {
    const created = unwrap(await service.createPrompt(basePrompt))
    const result = await service.updatePromptName(created.id, basePrompt.name)

    expect(result.success).toBe(true)
  })

  it('createVersion requires prompt to exist', async () => {
    const result = await service.createVersion('00000000-0000-0000-0000-000000000000', {
      systemPrompt: 'x',
      userPrompt: 'y',
      modelId: 'openai/gpt-4o',
    })
    expect(result.success).toBe(false)
  })
})

// ─── HTTP integration tests ───────────────────────────────────────────────────

describe('POST /prompts', () => {
  it('returns 201 with valid body', async () => {
    const res = await jsonPost('/prompts', basePrompt)
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body.name).toBe(basePrompt.name)
    expect(body.versions).toHaveLength(1)
  })

  it('returns 400 when name is empty', async () => {
    const res = await jsonPost('/prompts', { ...basePrompt, name: '' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when modelId is missing', async () => {
    const res = await jsonPost('/prompts', {
      name: basePrompt.name,
      systemPrompt: basePrompt.systemPrompt,
      userPrompt: basePrompt.userPrompt,
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when name already exists', async () => {
    await jsonPost('/prompts', basePrompt)
    const res = await jsonPost('/prompts', basePrompt)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/already exists/i)
  })
})

describe('GET /prompts', () => {
  it('returns 200 with prompts array', async () => {
    await jsonPost('/prompts', { ...basePrompt, name: 'list-test-1' })
    await jsonPost('/prompts', { ...basePrompt, name: 'list-test-2' })

    const res = await app.request('/prompts')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    const names = body.map((p: { name: string }) => p.name)
    expect(names).toContain('list-test-1')
    expect(names).toContain('list-test-2')
  })

  it('returns versionCount and latestVersion in list', async () => {
    await jsonPost('/prompts', { ...basePrompt, name: 'version-count-test' })

    const res = await app.request('/prompts')
    const body = await res.json()
    const found = body.find((p: { name: string }) => p.name === 'version-count-test')

    expect(found).toBeDefined()
    expect(found.versionCount).toBe(1)
    expect(found.latestVersion).toBeDefined()
  })
})

describe('GET /prompts/:id', () => {
  it('returns 200 with all versions', async () => {
    const created = await (await jsonPost('/prompts', basePrompt)).json()

    const res = await app.request(`/prompts/${created.id}`)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.id).toBe(created.id)
    expect(body.versions).toHaveLength(1)
  })

  it('returns 404 for non-existent id', async () => {
    const res = await app.request('/prompts/00000000-0000-0000-0000-000000000000')
    expect(res.status).toBe(404)
  })
})

describe('PATCH /prompts/:id', () => {
  it('returns 200 on successful name update', async () => {
    const created = await (await jsonPost('/prompts', basePrompt)).json()

    const res = await jsonPatch(`/prompts/${created.id}`, { name: 'renamed-prompt' })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.name).toBe('renamed-prompt')
  })

  it('returns 400 when name is empty', async () => {
    const created = await (await jsonPost('/prompts', basePrompt)).json()
    const res = await jsonPatch(`/prompts/${created.id}`, { name: '' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when name conflicts with another prompt', async () => {
    await jsonPost('/prompts', { ...basePrompt, name: 'existing-name' })
    const p2 = await (await jsonPost('/prompts', { ...basePrompt, name: 'to-rename' })).json()

    const res = await jsonPatch(`/prompts/${p2.id}`, { name: 'existing-name' })
    expect(res.status).toBe(400)
  })

  it('returns 404 for non-existent id', async () => {
    const res = await jsonPatch('/prompts/00000000-0000-0000-0000-000000000000', {
      name: 'whatever',
    })
    expect(res.status).toBe(404)
  })
})

describe('POST /prompts/:id/versions', () => {
  it('returns 201 with new version', async () => {
    const created = await (await jsonPost('/prompts', basePrompt)).json()

    const res = await jsonPost(`/prompts/${created.id}/versions`, {
      systemPrompt: 'New system prompt',
      userPrompt: 'New user prompt',
      modelId: 'openai/gpt-4o',
    })
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body.version).toBe(2)
    expect(body.systemPrompt).toBe('New system prompt')
  })

  it('returns 400 when modelId is missing', async () => {
    const created = await (await jsonPost('/prompts', basePrompt)).json()
    const res = await jsonPost(`/prompts/${created.id}/versions`, {
      systemPrompt: 'x',
      userPrompt: 'y',
    })
    expect(res.status).toBe(400)
  })

  it('returns 404 for non-existent prompt', async () => {
    const res = await jsonPost('/prompts/00000000-0000-0000-0000-000000000000/versions', {
      systemPrompt: 'x',
      userPrompt: 'y',
      modelId: 'openai/gpt-4o',
    })
    expect(res.status).toBe(404)
  })

  it('version numbers increment correctly across multiple versions', async () => {
    const created = await (await jsonPost('/prompts', basePrompt)).json()

    await jsonPost(`/prompts/${created.id}/versions`, {
      systemPrompt: 'v2',
      userPrompt: 'v2',
      modelId: 'openai/gpt-4o',
    })

    const v3Res = await jsonPost(`/prompts/${created.id}/versions`, {
      systemPrompt: 'v3',
      userPrompt: 'v3',
      modelId: 'openai/gpt-4o',
    })

    const v3Body = await v3Res.json()
    expect(v3Body.version).toBe(3)
  })
})

describe('DELETE /prompts/:id', () => {
  it('returns 200 on successful delete', async () => {
    const created = await (await jsonPost('/prompts', basePrompt)).json()

    const res = await app.request(`/prompts/${created.id}`, { method: 'DELETE' })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toEqual({ deleted: true })
  })

  it('returns 404 for non-existent id', async () => {
    const res = await app.request('/prompts/00000000-0000-0000-0000-000000000000', {
      method: 'DELETE',
    })
    expect(res.status).toBe(404)
  })

  it('deleted prompt does not appear in GET /prompts', async () => {
    const created = await (await jsonPost('/prompts', basePrompt)).json()
    await app.request(`/prompts/${created.id}`, { method: 'DELETE' })

    const res = await app.request('/prompts')
    const body = await res.json()
    const ids = body.map((p: { id: string }) => p.id)
    expect(ids).not.toContain(created.id)
  })
})
