import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDatasetRouter } from '../router.js'

// ─── mock service ────────────────────────────────────────────────────────────

const mockService = {
  listDatasets: vi.fn(),
  getDataset: vi.fn(),
  createDataset: vi.fn(),
  updateDataset: vi.fn(),
  deleteDataset: vi.fn(),
  addAttribute: vi.fn(),
  removeAttribute: vi.fn(),
  listItems: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  getCsvTemplate: vi.fn(),
  exportCsv: vi.fn(),
  importCsv: vi.fn(),
  previewCsv: vi.fn(),
  listRevisions: vi.fn(),
  getRevision: vi.fn(),
}

const app = createDatasetRouter(mockService)

beforeEach(() => {
  vi.resetAllMocks()
})

// ─── helpers ─────────────────────────────────────────────────────────────────

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

function del(path: string) {
  return app.request(path, { method: 'DELETE' })
}

// ─── POST /datasets ───────────────────────────────────────────────────────────

describe('POST /datasets', () => {
  it('returns 201 with valid body', async () => {
    const created = { id: '1', name: 'my-ds', attributes: ['input', 'expected_output'] }
    mockService.createDataset.mockResolvedValue({ success: true, data: created })

    const res = await jsonPost('/datasets', { name: 'my-ds' })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toEqual(created)
  })

  it('returns 400 when name is empty', async () => {
    const res = await jsonPost('/datasets', { name: '' })
    expect(res.status).toBe(400)
    expect(mockService.createDataset).not.toHaveBeenCalled()
  })

  it('returns 400 when service fails (name exists)', async () => {
    mockService.createDataset.mockResolvedValue({
      success: false,
      error: 'Dataset name already exists',
    })
    const res = await jsonPost('/datasets', { name: 'dup' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toEqual({ error: 'Dataset name already exists' })
  })
})

// ─── GET /datasets ────────────────────────────────────────────────────────────

describe('GET /datasets', () => {
  it('returns 200 with datasets array', async () => {
    const datasets = [{ id: '1', name: 'ds1', attributes: ['input', 'expected_output'] }]
    mockService.listDatasets.mockResolvedValue({ success: true, data: datasets })

    const res = await app.request('/datasets')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(datasets)
  })
})

// ─── GET /datasets/:id ────────────────────────────────────────────────────────

describe('GET /datasets/:id', () => {
  it('returns 200 when found', async () => {
    const dataset = { id: '1', name: 'ds1', attributes: ['input', 'expected_output'], items: [] }
    mockService.getDataset.mockResolvedValue({ success: true, data: dataset })

    const res = await app.request('/datasets/1')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(dataset)
  })

  it('returns 404 when not found', async () => {
    mockService.getDataset.mockResolvedValue({ success: false, error: 'Dataset not found' })

    const res = await app.request('/datasets/999')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body).toEqual({ error: 'Dataset not found' })
  })
})

// ─── PATCH /datasets/:id ──────────────────────────────────────────────────────

describe('PATCH /datasets/:id', () => {
  it('returns 200 on successful update', async () => {
    const updated = { id: '1', name: 'renamed', attributes: ['input', 'expected_output'] }
    mockService.updateDataset.mockResolvedValue({ success: true, data: updated })

    const res = await jsonPatch('/datasets/1', { name: 'renamed' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(updated)
  })

  it('returns 400 when name is empty', async () => {
    const res = await jsonPatch('/datasets/1', { name: '' })
    expect(res.status).toBe(400)
    expect(mockService.updateDataset).not.toHaveBeenCalled()
  })

  it('returns 404 when service fails with not found', async () => {
    mockService.updateDataset.mockResolvedValue({ success: false, error: 'Dataset not found' })
    const res = await jsonPatch('/datasets/999', { name: 'new' })
    expect(res.status).toBe(404)
  })

  it('returns 400 when service fails with other error', async () => {
    mockService.updateDataset.mockResolvedValue({
      success: false,
      error: 'Dataset name already exists',
    })
    const res = await jsonPatch('/datasets/1', { name: 'dup' })
    expect(res.status).toBe(400)
  })
})

// ─── DELETE /datasets/:id ─────────────────────────────────────────────────────

describe('DELETE /datasets/:id', () => {
  it('returns 200 on successful delete', async () => {
    mockService.deleteDataset.mockResolvedValue({ success: true, data: { deleted: true } })

    const res = await del('/datasets/1')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ deleted: true })
  })

  it('returns 404 when not found', async () => {
    mockService.deleteDataset.mockResolvedValue({ success: false, error: 'Dataset not found' })

    const res = await del('/datasets/999')
    expect(res.status).toBe(404)
  })
})

// ─── POST /datasets/:id/attributes ───────────────────────────────────────────

describe('POST /datasets/:id/attributes', () => {
  it('returns 201 on successful add', async () => {
    const updated = { id: '1', name: 'ds1', attributes: ['input', 'expected_output', 'context'] }
    mockService.addAttribute.mockResolvedValue({ success: true, data: updated })

    const res = await jsonPost('/datasets/1/attributes', { name: 'context' })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toEqual(updated)
  })

  it('returns 400 with empty name', async () => {
    const res = await jsonPost('/datasets/1/attributes', { name: '' })
    expect(res.status).toBe(400)
    expect(mockService.addAttribute).not.toHaveBeenCalled()
  })

  it('returns 400 when service fails (duplicate)', async () => {
    mockService.addAttribute.mockResolvedValue({
      success: false,
      error: 'Attribute already exists',
    })
    const res = await jsonPost('/datasets/1/attributes', { name: 'input' })
    expect(res.status).toBe(400)
  })
})

// ─── DELETE /datasets/:id/attributes/:name ────────────────────────────────────

describe('DELETE /datasets/:id/attributes/:name', () => {
  it('returns 200 on successful remove', async () => {
    const updated = { id: '1', name: 'ds1', attributes: ['input', 'expected_output'] }
    mockService.removeAttribute.mockResolvedValue({ success: true, data: updated })

    const res = await del('/datasets/1/attributes/context')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(updated)
  })

  it('returns 400 when service fails', async () => {
    mockService.removeAttribute.mockResolvedValue({
      success: false,
      error: 'Cannot remove built-in attribute',
    })
    const res = await del('/datasets/1/attributes/input')
    expect(res.status).toBe(400)
  })
})

// ─── GET /datasets/:id/items ──────────────────────────────────────────────────

describe('GET /datasets/:id/items', () => {
  it('returns 200 with items array', async () => {
    const items = [{ id: 'i1', datasetId: '1', values: { input: 'hi', expected_output: 'hello' } }]
    mockService.listItems.mockResolvedValue({ success: true, data: items })

    const res = await app.request('/datasets/1/items')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(items)
  })
})

// ─── POST /datasets/:id/items ─────────────────────────────────────────────────

describe('POST /datasets/:id/items', () => {
  it('returns 201 on successful create', async () => {
    const item = { id: 'i1', datasetId: '1', values: { input: 'hi', expected_output: 'hello' } }
    mockService.createItem.mockResolvedValue({ success: true, data: item })

    const res = await jsonPost('/datasets/1/items', {
      values: { input: 'hi', expected_output: 'hello' },
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toEqual(item)
  })

  it('returns 400 when values is missing', async () => {
    const res = await jsonPost('/datasets/1/items', {})
    expect(res.status).toBe(400)
    expect(mockService.createItem).not.toHaveBeenCalled()
  })

  it('returns 400 when service fails', async () => {
    mockService.createItem.mockResolvedValue({ success: false, error: 'Dataset not found' })
    const res = await jsonPost('/datasets/999/items', {
      values: { input: 'x', expected_output: 'y' },
    })
    expect(res.status).toBe(400)
  })
})

// ─── PATCH /datasets/:id/items/:itemId ───────────────────────────────────────

describe('PATCH /datasets/:id/items/:itemId', () => {
  it('returns 200 on successful update', async () => {
    const updated = { id: 'i1', datasetId: '1', values: { input: 'new', expected_output: 'val' } }
    mockService.updateItem.mockResolvedValue({ success: true, data: updated })

    const res = await jsonPatch('/datasets/1/items/i1', {
      values: { input: 'new', expected_output: 'val' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(updated)
  })

  it('returns 400 when values is missing', async () => {
    const res = await jsonPatch('/datasets/1/items/i1', {})
    expect(res.status).toBe(400)
    expect(mockService.updateItem).not.toHaveBeenCalled()
  })
})

// ─── DELETE /datasets/:id/items/:itemId ──────────────────────────────────────

describe('DELETE /datasets/:id/items/:itemId', () => {
  it('returns 200 on successful delete', async () => {
    mockService.deleteItem.mockResolvedValue({ success: true, data: { deleted: true } })

    const res = await del('/datasets/1/items/i1')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ deleted: true })
  })

  it('returns 404 when not found', async () => {
    mockService.deleteItem.mockResolvedValue({ success: false, error: 'Item not found' })
    const res = await del('/datasets/1/items/i999')
    expect(res.status).toBe(404)
  })
})

// ─── GET /datasets/:id/csv/template ──────────────────────────────────────────

describe('GET /datasets/:id/csv/template', () => {
  it('returns 200 with text/csv content type and Content-Disposition', async () => {
    mockService.getCsvTemplate.mockResolvedValue({
      success: true,
      data: { csv: 'input,expected_output,context', name: 'my-ds' },
    })

    const res = await app.request('/datasets/1/csv/template')
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/csv')
    expect(res.headers.get('Content-Disposition')).toContain('my-ds-template.csv')
    const text = await res.text()
    expect(text).toBe('input,expected_output,context')
  })

  it('returns 404 when dataset not found', async () => {
    mockService.getCsvTemplate.mockResolvedValue({ success: false, error: 'Dataset not found' })
    const res = await app.request('/datasets/999/csv/template')
    expect(res.status).toBe(404)
  })
})

// ─── GET /datasets/:id/csv/export ────────────────────────────────────────────

describe('GET /datasets/:id/csv/export', () => {
  it('returns 200 with text/csv content type and Content-Disposition', async () => {
    mockService.exportCsv.mockResolvedValue({
      success: true,
      data: { csv: 'input,expected_output\nhello,world', name: 'my-ds' },
    })

    const res = await app.request('/datasets/1/csv/export')
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/csv')
    expect(res.headers.get('Content-Disposition')).toContain('my-ds-export.csv')
    const text = await res.text()
    expect(text).toBe('input,expected_output\nhello,world')
  })

  it('returns 404 when dataset not found', async () => {
    mockService.exportCsv.mockResolvedValue({ success: false, error: 'Dataset not found' })
    const res = await app.request('/datasets/999/csv/export')
    expect(res.status).toBe(404)
  })
})

// ─── POST /datasets/:id/csv/preview ──────────────────────────────────────────

describe('POST /datasets/:id/csv/preview', () => {
  it('returns 200 with reshaped preview result', async () => {
    const dataset = { id: '1', name: 'my-ds', attributes: ['input', 'expected_output'], items: [] }
    mockService.getDataset.mockResolvedValue({ success: true, data: dataset })
    mockService.previewCsv.mockResolvedValue({
      success: true,
      data: {
        validRows: [{ input: 'hello', expected_output: 'world' }],
        skippedRows: [{ row: 3, reason: 'Empty required field: input' }],
      },
    })

    const res = await app.request('/datasets/1/csv/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: 'input,expected_output\nhello,world\n,foo',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).not.toHaveProperty('totalRows')
    expect(body).toEqual({
      headers: ['input', 'expected_output'],
      rows: [{ input: 'hello', expected_output: 'world' }],
      validRowCount: 1,
      skippedRows: [{ row: 3, reason: 'Empty required field: input' }],
    })
  })

  it('returns 400 when service fails', async () => {
    const dataset = { id: '1', name: 'my-ds', attributes: ['input', 'expected_output'], items: [] }
    mockService.getDataset.mockResolvedValue({ success: true, data: dataset })
    mockService.previewCsv.mockResolvedValue({ success: false, error: 'Unknown columns: wrong' })
    const res = await app.request('/datasets/1/csv/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: 'wrong,columns\nval1,val2',
    })
    expect(res.status).toBe(400)
  })
})

// ─── POST /datasets/:id/csv/import ───────────────────────────────────────────

describe('POST /datasets/:id/csv/import', () => {
  it('returns 200 on successful import', async () => {
    mockService.importCsv.mockResolvedValue({ success: true, data: { imported: 2 } })

    const res = await app.request('/datasets/1/csv/import', {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: 'input,expected_output\nhello,world\nfoo,bar',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ imported: 2 })
  })

  it('returns 400 when service fails', async () => {
    mockService.importCsv.mockResolvedValue({
      success: false,
      error: 'CSV columns do not match dataset attributes',
    })
    const res = await app.request('/datasets/1/csv/import', {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: 'wrong,columns\nval1,val2',
    })
    expect(res.status).toBe(400)
  })
})

// ─── GET /datasets/:id/revisions ──────────────────────────────────────────

describe('GET /datasets/:id/revisions', () => {
  it('returns 200 with revisions array', async () => {
    const revisions = [
      {
        id: 'rev1',
        schemaVersion: 1,
        attributes: ['input', 'expected_output'],
        createdAt: '2024-01-01T00:00:00Z',
        itemCount: 2,
      },
    ]
    mockService.listRevisions.mockResolvedValue({ success: true, data: revisions })

    const res = await app.request('/datasets/1/revisions')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(revisions)
  })

  it('returns 404 when dataset not found', async () => {
    mockService.listRevisions.mockResolvedValue({ success: false, error: 'Dataset not found' })

    const res = await app.request('/datasets/999/revisions')
    expect(res.status).toBe(404)
  })
})

// ─── GET /datasets/:id/revisions/:revisionId ─────────────────────────────

describe('GET /datasets/:id/revisions/:revisionId', () => {
  it('returns 200 with revision detail', async () => {
    const revision = {
      id: 'rev1',
      schemaVersion: 1,
      attributes: ['input', 'expected_output'],
      createdAt: '2024-01-01T00:00:00Z',
      items: [],
    }
    mockService.getRevision.mockResolvedValue({ success: true, data: revision })

    const res = await app.request('/datasets/1/revisions/rev1')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(revision)
  })

  it('returns 404 when revision not found', async () => {
    mockService.getRevision.mockResolvedValue({ success: false, error: 'Revision not found' })

    const res = await app.request('/datasets/1/revisions/rev999')
    expect(res.status).toBe(404)
  })
})
