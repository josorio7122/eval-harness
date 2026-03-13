import { Hono } from 'hono'
import {
  createDatasetSchema,
  updateDatasetSchema,
  addAttributeSchema,
  createItemSchema,
  updateItemSchema,
} from './validator.js'
import type { createDatasetService } from './service.js'

type DatasetService = ReturnType<typeof createDatasetService>

export function createDatasetRouter(service: DatasetService) {
  const app = new Hono()

  // ─── Datasets ─────────────────────────────────────────────────────────────

  app.get('/datasets', async (c) => {
    const result = await service.listDatasets()
    if (!result.success) return c.json(result, 400)
    return c.json(result)
  })

  app.post('/datasets', async (c) => {
    const body = await c.req.json()
    const parsed = createDatasetSchema.safeParse(body)
    if (!parsed.success) return c.json({ success: false, error: parsed.error.flatten() }, 400)
    const result = await service.createDataset(parsed.data)
    if (!result.success) return c.json(result, 400)
    return c.json(result, 201)
  })

  app.get('/datasets/:id', async (c) => {
    const result = await service.getDataset(c.req.param('id'))
    if (!result.success) return c.json(result, 404)
    return c.json(result)
  })

  app.patch('/datasets/:id', async (c) => {
    const body = await c.req.json()
    const parsed = updateDatasetSchema.safeParse(body)
    if (!parsed.success) return c.json({ success: false, error: parsed.error.flatten() }, 400)
    const result = await service.updateDataset(c.req.param('id'), parsed.data)
    if (!result.success) return c.json(result, 400)
    return c.json(result)
  })

  app.delete('/datasets/:id', async (c) => {
    const result = await service.deleteDataset(c.req.param('id'))
    if (!result.success) return c.json(result, 404)
    return c.json(result)
  })

  // ─── Attributes ───────────────────────────────────────────────────────────

  app.post('/datasets/:id/attributes', async (c) => {
    const body = await c.req.json()
    const parsed = addAttributeSchema.safeParse(body)
    if (!parsed.success) return c.json({ success: false, error: parsed.error.flatten() }, 400)
    const result = await service.addAttribute(c.req.param('id'), parsed.data)
    if (!result.success) return c.json(result, 400)
    return c.json(result, 201)
  })

  app.delete('/datasets/:id/attributes/:name', async (c) => {
    const result = await service.removeAttribute(c.req.param('id'), c.req.param('name'))
    if (!result.success) return c.json(result, 400)
    return c.json(result)
  })

  // ─── Revisions ────────────────────────────────────────────────────────────

  app.get('/datasets/:id/revisions', async (c) => {
    const result = await service.listRevisions(c.req.param('id'))
    if (!result.success) return c.json(result, 404)
    return c.json(result)
  })

  app.get('/datasets/:id/revisions/:revisionId', async (c) => {
    const result = await service.getRevision(c.req.param('id'), c.req.param('revisionId'))
    if (!result.success) return c.json(result, 404)
    return c.json(result)
  })

  // ─── CSV ──────────────────────────────────────────────────────────────────

  app.get('/datasets/:id/csv/template', async (c) => {
    const result = await service.getCsvTemplate(c.req.param('id'))
    if (!result.success) return c.json(result, 404)
    const filename = `${result.data.name}-template.csv`
    return c.text(result.data.csv, 200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    })
  })

  app.get('/datasets/:id/csv/export', async (c) => {
    const result = await service.exportCsv(c.req.param('id'))
    if (!result.success) return c.json(result, 404)
    const filename = `${result.data.name}-export.csv`
    return c.text(result.data.csv, 200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    })
  })

  app.post('/datasets/:id/csv/preview', async (c) => {
    const id = c.req.param('id')
    const csv = await c.req.text()
    const datasetResult = await service.getDataset(id)
    if (!datasetResult.success) return c.json(datasetResult, 404)
    const result = await service.previewCsv(id, csv)
    if (!result.success) return c.json(result, 400)
    return c.json({
      success: true,
      data: {
        headers: datasetResult.data.attributes,
        rows: result.data.validRows,
        totalRows: result.data.validRows.length,
        skippedRows: result.data.skippedRows,
      },
    })
  })

  app.post('/datasets/:id/csv/import', async (c) => {
    const csv = await c.req.text()
    const result = await service.importCsv(c.req.param('id'), csv)
    if (!result.success) return c.json(result, 400)
    return c.json(result)
  })

  // ─── Items ────────────────────────────────────────────────────────────────

  app.get('/datasets/:id/items', async (c) => {
    const result = await service.listItems(c.req.param('id'))
    if (!result.success) return c.json(result, 400)
    return c.json(result)
  })

  app.post('/datasets/:id/items', async (c) => {
    const body = await c.req.json()
    const parsed = createItemSchema.safeParse(body)
    if (!parsed.success) return c.json({ success: false, error: parsed.error.flatten() }, 400)
    const result = await service.createItem(c.req.param('id'), parsed.data)
    if (!result.success) return c.json(result, 400)
    return c.json(result, 201)
  })

  app.patch('/datasets/:id/items/:itemId', async (c) => {
    const body = await c.req.json()
    const parsed = updateItemSchema.safeParse(body)
    if (!parsed.success) return c.json({ success: false, error: parsed.error.flatten() }, 400)
    const result = await service.updateItem(c.req.param('id'), c.req.param('itemId'), parsed.data)
    if (!result.success) return c.json(result, 400)
    return c.json(result)
  })

  app.delete('/datasets/:id/items/:itemId', async (c) => {
    const result = await service.deleteItem(c.req.param('id'), c.req.param('itemId'))
    if (!result.success) return c.json(result, 404)
    return c.json(result)
  })

  return app
}
