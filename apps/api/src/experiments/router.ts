import { Hono } from 'hono'
import { createExperimentSchema } from './validator.js'
import type { createExperimentService } from './service.js'

type ExperimentService = ReturnType<typeof createExperimentService>

export function createExperimentRouter(service: ExperimentService) {
  const app = new Hono()

  app.get('/experiments', async (c) => {
    const result = await service.listExperiments()
    if (!result.success) return c.json(result, 400)
    return c.json(result)
  })

  app.post('/experiments', async (c) => {
    const body = await c.req.json()
    const parsed = createExperimentSchema.safeParse(body)
    if (!parsed.success) return c.json({ success: false, error: parsed.error.flatten() }, 400)
    const result = await service.createExperiment(parsed.data)
    if (!result.success) return c.json(result, 400)
    return c.json(result, 201)
  })

  app.get('/experiments/:id', async (c) => {
    const result = await service.getExperiment(c.req.param('id'))
    if (!result.success) return c.json(result, 404)
    return c.json(result)
  })

  app.delete('/experiments/:id', async (c) => {
    const result = await service.deleteExperiment(c.req.param('id'))
    if (!result.success) return c.json(result, 404)
    return c.json(result)
  })

  app.post('/experiments/:id/rerun', async (c) => {
    const result = await service.rerunExperiment(c.req.param('id'))
    if (!result.success) return c.json(result, 404)
    return c.json(result, 201)
  })

  return app
}
