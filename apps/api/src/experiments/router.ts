import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { createExperimentSchema } from './validator.js'
import type { createExperimentService } from './service.js'
import { experimentEvents } from './runner.js'

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

  app.post('/experiments/:id/run', async (c) => {
    const result = await service.runExperiment(c.req.param('id'))
    if (!result.success) return c.json(result, 400)
    return c.json(result, 202)
  })

  app.get('/experiments/:id/events', async (c) => {
    const id = c.req.param('id')
    return streamSSE(c, async (stream) => {
      const handler = (event: unknown) => {
        const e = event as { type: string }
        stream.writeSSE({ data: JSON.stringify(event), event: e.type })
      }

      experimentEvents.on(id, handler)
      stream.onAbort(() => {
        experimentEvents.off(id, handler)
      })

      await stream.writeSSE({ data: JSON.stringify({ experimentId: id }), event: 'connected' })

      await new Promise<void>((resolve) => {
        const completeHandler = (event: unknown) => {
          const e = event as { type: string }
          if (e.type === 'completed') {
            experimentEvents.off(id, completeHandler)
            resolve()
          }
        }
        experimentEvents.on(id, completeHandler)
        stream.onAbort(() => resolve())
      })
    })
  })

  app.get('/experiments/:id/csv/export', async (c) => {
    const result = await service.exportCsv(c.req.param('id'))
    if (!result.success) return c.json(result, 400)
    c.header('Content-Type', 'text/csv')
    c.header('Content-Disposition', `attachment; filename="experiment-${c.req.param('id')}.csv"`)
    return c.body(result.data)
  })

  return app
}
