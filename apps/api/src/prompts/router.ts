import { Hono } from 'hono'
import { createPromptSchema, updatePromptSchema, createVersionSchema } from './validator.js'
import { type createPromptService } from './service.js'

type PromptService = ReturnType<typeof createPromptService>

export function createPromptRouter(service: PromptService) {
  const app = new Hono()

  app.post('/prompts', async (c) => {
    const body = await c.req.json()
    const parsed = createPromptSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)
    const result = await service.createPrompt(parsed.data)
    if (!result.success) return c.json({ error: result.error }, 400)
    return c.json(result.data, 201)
  })

  app.get('/prompts', async (c) => {
    const result = await service.listPrompts()
    if (!result.success) return c.json({ error: result.error }, 400)
    return c.json(result.data)
  })

  app.get('/prompts/:id', async (c) => {
    const result = await service.getPrompt(c.req.param('id'))
    if (!result.success) return c.json({ error: result.error }, 404)
    return c.json(result.data)
  })

  app.patch('/prompts/:id', async (c) => {
    const body = await c.req.json()
    const parsed = updatePromptSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)
    const result = await service.updatePromptName(c.req.param('id'), parsed.data.name)
    if (!result.success) {
      const status = result.error.toLowerCase().includes('not found') ? 404 : 400
      return c.json({ error: result.error }, status)
    }
    return c.json(result.data)
  })

  app.post('/prompts/:id/versions', async (c) => {
    const body = await c.req.json()
    const parsed = createVersionSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)
    const result = await service.createVersion(c.req.param('id'), parsed.data)
    if (!result.success) {
      const status = result.error.toLowerCase().includes('not found') ? 404 : 400
      return c.json({ error: result.error }, status)
    }
    return c.json(result.data, 201)
  })

  app.delete('/prompts/:id', async (c) => {
    const result = await service.deletePrompt(c.req.param('id'))
    if (!result.success) return c.json({ error: result.error }, 404)
    return c.json(result.data)
  })

  return app
}
