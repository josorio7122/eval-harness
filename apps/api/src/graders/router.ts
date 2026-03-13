import { Hono } from 'hono'
import { createGraderSchema, updateGraderSchema } from './validator.js'
import type { createGraderService } from './service.js'

type GraderService = ReturnType<typeof createGraderService>

export function createGraderRouter(service: GraderService) {
  const app = new Hono()

  app.get('/graders', async (c) => {
    const result = await service.listGraders()
    if (!result.success) return c.json({ error: result.error }, 400)
    return c.json(result.data)
  })

  app.post('/graders', async (c) => {
    const body = await c.req.json()
    const parsed = createGraderSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)
    const result = await service.createGrader(parsed.data)
    if (!result.success) return c.json({ error: result.error }, 400)
    return c.json(result.data, 201)
  })

  app.get('/graders/:id', async (c) => {
    const result = await service.getGrader(c.req.param('id'))
    if (!result.success) return c.json({ error: result.error }, 404)
    return c.json(result.data)
  })

  app.patch('/graders/:id', async (c) => {
    const body = await c.req.json()
    const parsed = updateGraderSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)
    const result = await service.updateGrader(c.req.param('id'), parsed.data)
    if (!result.success) {
      const status = result.error.toLowerCase().includes('not found') ? 404 : 400
      return c.json({ error: result.error }, status)
    }
    return c.json(result.data)
  })

  app.delete('/graders/:id', async (c) => {
    const result = await service.deleteGrader(c.req.param('id'))
    if (!result.success) return c.json({ error: result.error }, 404)
    return c.json(result.data)
  })

  return app
}
