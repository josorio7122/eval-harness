import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDatasetService } from '../service.js'

const mockRepo = {
  findAll: vi.fn(),
  findById: vi.fn(),
  findByName: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  addAttribute: vi.fn(),
  removeAttribute: vi.fn(),
  findItemsByDatasetId: vi.fn(),
  findItemById: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  removeItem: vi.fn(),
  countItems: vi.fn(),
  importItems: vi.fn(),
  findRevisions: vi.fn(),
  findRevisionById: vi.fn(),
}

const service = createDatasetService(mockRepo)

beforeEach(() => {
  vi.resetAllMocks()
})

describe('listDatasets', () => {
  it('returns ok with datasets array', async () => {
    const datasets = [{ id: '1', name: 'ds1', attributes: ['input', 'expected_output'] }]
    mockRepo.findAll.mockResolvedValue(datasets)
    const result = await service.listDatasets()
    expect(result).toEqual({ success: true, data: datasets })
  })
})

describe('getDataset', () => {
  it('returns ok when found', async () => {
    const dataset = { id: '1', name: 'ds1', attributes: ['input', 'expected_output'], items: [] }
    mockRepo.findById.mockResolvedValue(dataset)
    const result = await service.getDataset('1')
    expect(result).toEqual({ success: true, data: dataset })
  })

  it('returns fail when not found', async () => {
    mockRepo.findById.mockResolvedValue(null)
    const result = await service.getDataset('999')
    expect(result).toEqual({ success: false, error: 'Dataset not found' })
  })
})

describe('createDataset', () => {
  it('creates successfully', async () => {
    mockRepo.findByName.mockResolvedValue(null)
    const created = { id: '1', name: 'ds1', attributes: ['input', 'expected_output'] }
    mockRepo.create.mockResolvedValue(created)
    const result = await service.createDataset({ name: 'ds1' })
    expect(result).toEqual({ success: true, data: created })
  })

  it('fails on duplicate name', async () => {
    mockRepo.findByName.mockResolvedValue({ id: '1', name: 'ds1' })
    const result = await service.createDataset({ name: 'ds1' })
    expect(result).toEqual({ success: false, error: 'Dataset name already exists' })
  })
})

describe('updateDataset', () => {
  it('updates successfully', async () => {
    mockRepo.findById.mockResolvedValue({ id: '1', name: 'ds1', attributes: ['input', 'expected_output'] })
    mockRepo.findByName.mockResolvedValue(null)
    const updated = { id: '1', name: 'ds2', attributes: ['input', 'expected_output'] }
    mockRepo.update.mockResolvedValue(updated)
    const result = await service.updateDataset('1', { name: 'ds2' })
    expect(result).toEqual({ success: true, data: updated })
  })

  it('fails when not found', async () => {
    mockRepo.findById.mockResolvedValue(null)
    const result = await service.updateDataset('999', { name: 'ds2' })
    expect(result).toEqual({ success: false, error: 'Dataset not found' })
  })

  it('fails on duplicate name', async () => {
    mockRepo.findById.mockResolvedValue({ id: '1', name: 'ds1', attributes: ['input', 'expected_output'] })
    mockRepo.findByName.mockResolvedValue({ id: '2', name: 'ds2' })
    const result = await service.updateDataset('1', { name: 'ds2' })
    expect(result).toEqual({ success: false, error: 'Dataset name already exists' })
  })

  it('allows updating with same name', async () => {
    const existing = { id: '1', name: 'ds1', attributes: ['input', 'expected_output'] }
    mockRepo.findById.mockResolvedValue(existing)
    mockRepo.findByName.mockResolvedValue(existing)
    mockRepo.update.mockResolvedValue(existing)
    const result = await service.updateDataset('1', { name: 'ds1' })
    expect(result.success).toBe(true)
  })
})

describe('deleteDataset', () => {
  it('deletes successfully', async () => {
    mockRepo.findById.mockResolvedValue({ id: '1', name: 'ds1' })
    mockRepo.remove.mockResolvedValue({ id: '1' })
    const result = await service.deleteDataset('1')
    expect(result).toEqual({ success: true, data: { deleted: true } })
  })

  it('fails when not found', async () => {
    mockRepo.findById.mockResolvedValue(null)
    const result = await service.deleteDataset('999')
    expect(result).toEqual({ success: false, error: 'Dataset not found' })
  })
})

describe('addAttribute', () => {
  it('adds attribute successfully', async () => {
    const dataset = { id: '1', name: 'ds1', attributes: ['input', 'expected_output'] }
    mockRepo.findById.mockResolvedValue(dataset)
    const updated = { ...dataset, attributes: ['input', 'expected_output', 'context'] }
    mockRepo.addAttribute.mockResolvedValue(updated)
    const result = await service.addAttribute('1', { name: 'context' })
    expect(result).toEqual({ success: true, data: updated })
  })

  it('fails on duplicate attribute', async () => {
    const dataset = { id: '1', name: 'ds1', attributes: ['input', 'expected_output'] }
    mockRepo.findById.mockResolvedValue(dataset)
    const result = await service.addAttribute('1', { name: 'input' })
    expect(result).toEqual({ success: false, error: 'Attribute already exists' })
  })

  it('fails when dataset not found', async () => {
    mockRepo.findById.mockResolvedValue(null)
    const result = await service.addAttribute('999', { name: 'context' })
    expect(result).toEqual({ success: false, error: 'Dataset not found' })
  })
})

describe('removeAttribute', () => {
  it('removes custom attribute successfully', async () => {
    const dataset = { id: '1', name: 'ds1', attributes: ['input', 'expected_output', 'context'] }
    mockRepo.findById.mockResolvedValue(dataset)
    const updated = { ...dataset, attributes: ['input', 'expected_output'] }
    mockRepo.removeAttribute.mockResolvedValue(updated)
    const result = await service.removeAttribute('1', 'context')
    expect(result).toEqual({ success: true, data: updated })
  })

  it('fails on built-in attribute "input"', async () => {
    const dataset = { id: '1', name: 'ds1', attributes: ['input', 'expected_output'] }
    mockRepo.findById.mockResolvedValue(dataset)
    const result = await service.removeAttribute('1', 'input')
    expect(result).toEqual({ success: false, error: 'Cannot remove built-in attribute' })
  })

  it('fails on built-in attribute "expected_output"', async () => {
    const dataset = { id: '1', name: 'ds1', attributes: ['input', 'expected_output'] }
    mockRepo.findById.mockResolvedValue(dataset)
    const result = await service.removeAttribute('1', 'expected_output')
    expect(result).toEqual({ success: false, error: 'Cannot remove built-in attribute' })
  })

  it('fails when dataset not found', async () => {
    mockRepo.findById.mockResolvedValue(null)
    const result = await service.removeAttribute('999', 'context')
    expect(result).toEqual({ success: false, error: 'Dataset not found' })
  })

  it('fails when attribute does not exist', async () => {
    const dataset = { id: '1', name: 'ds1', attributes: ['input', 'expected_output'] }
    mockRepo.findById.mockResolvedValue(dataset)
    const result = await service.removeAttribute('1', 'nonexistent')
    expect(result).toEqual({ success: false, error: 'Attribute not found' })
  })
})

describe('createItem', () => {
  it('creates item with matching schema', async () => {
    const dataset = { id: '1', name: 'ds1', attributes: ['input', 'expected_output'] }
    mockRepo.findById.mockResolvedValue(dataset)
    const item = { id: 'i1', datasetId: '1', values: { input: 'hello', expected_output: 'world' } }
    mockRepo.createItem.mockResolvedValue(item)
    const result = await service.createItem('1', { values: { input: 'hello', expected_output: 'world' } })
    expect(result).toEqual({ success: true, data: item })
  })

  it('defaults missing attributes to empty string', async () => {
    mockRepo.findById.mockResolvedValue({
      id: '1', name: 'ds', attributes: ['input', 'expected_output', 'context'],
      schemaVersion: 1, items: [],
    })
    mockRepo.createItem.mockResolvedValue({ id: 'item1', itemId: 'itemId1', revisionId: 'rev1', values: {} })
    const result = await service.createItem('1', { values: { input: 'hello', expected_output: 'world' } })
    expect(result.success).toBe(true)
    const createCall = mockRepo.createItem.mock.calls[0]
    expect(createCall[1]).toEqual({ input: 'hello', expected_output: 'world', context: '' })
  })

  it('ignores extra keys not in schema', async () => {
    mockRepo.findById.mockResolvedValue({
      id: '1', name: 'ds', attributes: ['input', 'expected_output'],
      schemaVersion: 1, items: [],
    })
    mockRepo.createItem.mockResolvedValue({ id: 'item1', itemId: 'itemId1', revisionId: 'rev1', values: {} })
    const result = await service.createItem('1', { values: { input: 'hello', expected_output: 'world', extra: 'ignored' } })
    expect(result.success).toBe(true)
    const createCall = mockRepo.createItem.mock.calls[0]
    expect(createCall[1]).toEqual({ input: 'hello', expected_output: 'world' })
  })

  it('fails when dataset not found', async () => {
    mockRepo.findById.mockResolvedValue(null)
    const result = await service.createItem('999', { values: { input: 'hello', expected_output: 'world' } })
    expect(result).toEqual({ success: false, error: 'Dataset not found' })
  })
})

describe('updateItem', () => {
  it('updates item successfully', async () => {
    const dataset = { id: '1', name: 'ds1', attributes: ['input', 'expected_output'] }
    mockRepo.findById.mockResolvedValue(dataset)
    mockRepo.findItemById.mockResolvedValue({ id: 'i1', datasetId: '1', values: {} })
    const updated = { id: 'i1', datasetId: '1', values: { input: 'new', expected_output: 'val' } }
    mockRepo.updateItem.mockResolvedValue(updated)
    const result = await service.updateItem('1', 'i1', { values: { input: 'new', expected_output: 'val' } })
    expect(result).toEqual({ success: true, data: updated })
  })

  it('defaults missing attributes to empty string on update', async () => {
    mockRepo.findById.mockResolvedValue({
      id: '1', name: 'ds', attributes: ['input', 'expected_output', 'context'],
      schemaVersion: 1, items: [],
    })
    mockRepo.findItemById.mockResolvedValue({ id: 'i1', datasetId: '1', values: {} })
    const updated = { id: 'i1', datasetId: '1', values: {} }
    mockRepo.updateItem.mockResolvedValue(updated)
    const result = await service.updateItem('1', 'i1', { values: { input: 'new', expected_output: 'val' } })
    expect(result.success).toBe(true)
    const updateCall = mockRepo.updateItem.mock.calls[0]
    expect(updateCall[1]).toEqual({ input: 'new', expected_output: 'val', context: '' })
  })

  it('ignores extra keys not in schema on update', async () => {
    mockRepo.findById.mockResolvedValue({
      id: '1', name: 'ds', attributes: ['input', 'expected_output'],
      schemaVersion: 1, items: [],
    })
    mockRepo.findItemById.mockResolvedValue({ id: 'i1', datasetId: '1', values: {} })
    const updated = { id: 'i1', datasetId: '1', values: {} }
    mockRepo.updateItem.mockResolvedValue(updated)
    const result = await service.updateItem('1', 'i1', { values: { input: 'new', expected_output: 'val', extra: 'ignored' } })
    expect(result.success).toBe(true)
    const updateCall = mockRepo.updateItem.mock.calls[0]
    expect(updateCall[1]).toEqual({ input: 'new', expected_output: 'val' })
  })

  it('fails when item not found', async () => {
    const dataset = { id: '1', name: 'ds1', attributes: ['input', 'expected_output'] }
    mockRepo.findById.mockResolvedValue(dataset)
    mockRepo.findItemById.mockResolvedValue(null)
    const result = await service.updateItem('1', '999', { values: { input: 'x', expected_output: 'y' } })
    expect(result).toEqual({ success: false, error: 'Item not found' })
  })
})

describe('deleteItem', () => {
  it('deletes item successfully', async () => {
    mockRepo.findById.mockResolvedValue({ id: '1', name: 'ds1' })
    mockRepo.findItemById.mockResolvedValue({ id: 'i1', datasetId: '1' })
    mockRepo.removeItem.mockResolvedValue({ id: 'i1' })
    const result = await service.deleteItem('1', 'i1')
    expect(result).toEqual({ success: true, data: { deleted: true } })
  })

  it('fails when item not found', async () => {
    mockRepo.findById.mockResolvedValue({ id: '1', name: 'ds1' })
    mockRepo.findItemById.mockResolvedValue(null)
    const result = await service.deleteItem('1', '999')
    expect(result).toEqual({ success: false, error: 'Item not found' })
  })
})

describe('getCsvTemplate', () => {
  it('returns CSV header and dataset name', async () => {
    const dataset = { id: '1', name: 'ds1', attributes: ['input', 'expected_output', 'context'] }
    mockRepo.findById.mockResolvedValue(dataset)
    const result = await service.getCsvTemplate('1')
    expect(result).toEqual({ success: true, data: { csv: 'input,expected_output,context', name: 'ds1' } })
  })
})

describe('exportCsv', () => {
  it('returns CSV with header and rows plus dataset name', async () => {
    const dataset = { id: '1', name: 'ds1', attributes: ['input', 'expected_output'] }
    mockRepo.findById.mockResolvedValue(dataset)
    mockRepo.findItemsByDatasetId.mockResolvedValue([
      { id: 'i1', datasetId: '1', values: { input: 'hello', expected_output: 'world' } },
      { id: 'i2', datasetId: '1', values: { input: 'foo', expected_output: 'bar' } },
    ])
    const result = await service.exportCsv('1')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('ds1')
      const lines = result.data.csv.split('\n')
      expect(lines[0]).toBe('input,expected_output')
      expect(lines[1]).toBe('hello,world')
      expect(lines[2]).toBe('foo,bar')
    }
  })
})

describe('importCsv', () => {
  it('imports items from CSV', async () => {
    const dataset = { id: '1', name: 'ds1', attributes: ['input', 'expected_output'] }
    mockRepo.findById.mockResolvedValue(dataset)
    mockRepo.importItems.mockResolvedValue(undefined)
    const csv = 'input,expected_output\nhello,world\nfoo,bar'
    const result = await service.importCsv('1', csv)
    expect(result).toEqual({ success: true, data: { imported: 2, skipped: 0 } })
    expect(mockRepo.importItems).toHaveBeenCalledTimes(1)
    expect(mockRepo.importItems).toHaveBeenCalledWith('1', [
      { input: 'hello', expected_output: 'world' },
      { input: 'foo', expected_output: 'bar' },
    ])
  })

  it('skips rows with empty built-in fields and reports count', async () => {
    const dataset = { id: '1', name: 'ds1', attributes: ['input', 'expected_output'] }
    mockRepo.findById.mockResolvedValue(dataset)
    mockRepo.importItems.mockResolvedValue(undefined)
    const csv = 'input,expected_output\nhello,world\n,empty-input\nfoo,bar'
    const result = await service.importCsv('1', csv)
    expect(result).toEqual({ success: true, data: { imported: 2, skipped: 1 } })
    expect(mockRepo.importItems).toHaveBeenCalledTimes(1)
    expect(mockRepo.importItems).toHaveBeenCalledWith('1', [
      { input: 'hello', expected_output: 'world' },
      { input: 'foo', expected_output: 'bar' },
    ])
  })

  it('fails when CSV has header only (no data rows)', async () => {
    const dataset = { id: '1', name: 'ds1', attributes: ['input', 'expected_output'] }
    mockRepo.findById.mockResolvedValue(dataset)
    const csv = 'input,expected_output'
    const result = await service.importCsv('1', csv)
    expect(result).toEqual({ success: false, error: 'No data rows found in CSV' })
  })

  it('fails with distinct error for missing columns', async () => {
    const dataset = { id: '1', name: 'ds1', attributes: ['input', 'expected_output'] }
    mockRepo.findById.mockResolvedValue(dataset)
    const csv = 'input\nhello'
    const result = await service.importCsv('1', csv)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('Missing required columns')
  })

  it('fails with distinct error for unknown columns', async () => {
    const dataset = { id: '1', name: 'ds1', attributes: ['input', 'expected_output'] }
    mockRepo.findById.mockResolvedValue(dataset)
    // All required columns present, plus one unknown
    const csv = 'input,expected_output,extra_column\nhello,world,extra'
    const result = await service.importCsv('1', csv)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('Unknown columns')
  })
})

describe('importCsv - CRLF handling', () => {
  it('handles CRLF line endings in CSV import', async () => {
    mockRepo.findById.mockResolvedValue({
      id: '1', name: 'ds', attributes: ['input', 'expected_output'], schemaVersion: 1, items: [],
    })
    mockRepo.importItems.mockResolvedValue(undefined)
    const result = await service.importCsv('1', 'input,expected_output\r\nhello,world\r\nfoo,bar\r\n')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.imported).toBe(2)
    }
    // Verify the values passed to importItems don't contain \r
    const importCall = mockRepo.importItems.mock.calls[0]
    expect(importCall[1][0].expected_output).toBe('world') // NOT 'world\r'
    expect(importCall[1][1].expected_output).toBe('bar')
  })

  it('handles CR-only line endings in CSV import', async () => {
    mockRepo.findById.mockResolvedValue({
      id: '1', name: 'ds', attributes: ['input', 'expected_output'], schemaVersion: 1, items: [],
    })
    mockRepo.importItems.mockResolvedValue(undefined)
    const result = await service.importCsv('1', 'input,expected_output\rhello,world\rfoo,bar')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.imported).toBe(2)
    }
  })
})

describe('importCsv - non-CSV detection (C6)', () => {
  it('rejects JSON content as not valid CSV', async () => {
    mockRepo.findById.mockResolvedValue({ id: '1', name: 'ds', attributes: ['input', 'expected_output'], schemaVersion: 1, items: [] })
    const result = await service.importCsv('1', '{"foo":"bar"}')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('could not be parsed')
  })

  it('rejects JSON array content as not valid CSV', async () => {
    mockRepo.findById.mockResolvedValue({ id: '1', name: 'ds', attributes: ['input', 'expected_output'], schemaVersion: 1, items: [] })
    const result = await service.importCsv('1', '[{"foo":"bar"}]')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('could not be parsed')
  })

  it('rejects binary-looking content as not valid CSV', async () => {
    mockRepo.findById.mockResolvedValue({ id: '1', name: 'ds', attributes: ['input', 'expected_output'], schemaVersion: 1, items: [] })
    const result = await service.importCsv('1', '\x00\x01\x02\x03')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('could not be parsed')
  })

  it('returns missing columns error for single-column CSV with multi-column schema', async () => {
    mockRepo.findById.mockResolvedValue({ id: '1', name: 'ds', attributes: ['input', 'expected_output'], schemaVersion: 1, items: [] })
    const result = await service.importCsv('1', 'justonecolumn\nvalue1\nvalue2')
    expect(result.success).toBe(false)
    // Single-column CSV is ambiguous — we give the more precise "missing columns" error
    if (!result.success) expect(result.error).toContain('Missing required columns')
  })
})

describe('importCsv - case-insensitive headers', () => {
  it('accepts CSV with mixed-case headers', async () => {
    const dataset = { id: '1', name: 'ds1', attributes: ['input', 'expected_output'] }
    mockRepo.findById.mockResolvedValue(dataset)
    mockRepo.importItems.mockResolvedValue(undefined)
    const csv = 'Input,Expected_Output\nhello,world\nfoo,bar'
    const result = await service.importCsv('1', csv)
    expect(result).toEqual({ success: true, data: { imported: 2, skipped: 0 } })
    expect(mockRepo.importItems).toHaveBeenCalledTimes(1)
  })

  it('accepts CSV with ALL-CAPS headers', async () => {
    const dataset = { id: '1', name: 'ds1', attributes: ['input', 'expected_output'] }
    mockRepo.findById.mockResolvedValue(dataset)
    mockRepo.importItems.mockResolvedValue(undefined)
    const csv = 'INPUT,EXPECTED_OUTPUT\nhello,world'
    const result = await service.importCsv('1', csv)
    expect(result).toEqual({ success: true, data: { imported: 1, skipped: 0 } })
  })
})

describe('previewCsv', () => {
  it('returns valid and skipped rows without creating items', async () => {
    const dataset = { id: '1', name: 'ds1', attributes: ['input', 'expected_output'] }
    mockRepo.findById.mockResolvedValue(dataset)
    const csv = 'input,expected_output\nhello,world\n,missing-input\nfoo,bar'
    const result = await service.previewCsv('1', csv)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.validRows).toHaveLength(2)
      expect(result.data.skippedRows).toHaveLength(1)
      expect(result.data.skippedRows[0].row).toBe(3)
    }
    expect(mockRepo.createItem).not.toHaveBeenCalled()
  })

  it('handles quoted fields with commas', async () => {
    const dataset = { id: '1', name: 'ds1', attributes: ['input', 'expected_output'] }
    mockRepo.findById.mockResolvedValue(dataset)
    const csv = 'input,expected_output\n"hello, world","foo bar"'
    const result = await service.previewCsv('1', csv)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.validRows[0]['input']).toBe('hello, world')
      expect(result.data.validRows[0]['expected_output']).toBe('foo bar')
    }
  })

  it('fails when dataset not found', async () => {
    mockRepo.findById.mockResolvedValue(null)
    const result = await service.previewCsv('999', 'input,expected_output\nhello,world')
    expect(result).toEqual({ success: false, error: 'Dataset not found' })
  })
})

describe('listRevisions', () => {
  it('returns ok with revisions when dataset exists', async () => {
    mockRepo.findById.mockResolvedValue({ id: '1', name: 'ds1', attributes: ['input', 'expected_output'], schemaVersion: 1, items: [] })
    const revisions = [{ id: 'rev1', schemaVersion: 1, attributes: ['input', 'expected_output'], createdAt: new Date(), itemCount: 0, experimentCount: 0, isCurrent: true }]
    mockRepo.findRevisions.mockResolvedValue(revisions)
    const result = await service.listRevisions('1')
    expect(result).toEqual({ success: true, data: revisions })
    expect((result as { success: true; data: typeof revisions }).data[0].isCurrent).toBe(true)
  })

  it('returns fail when dataset not found', async () => {
    mockRepo.findById.mockResolvedValue(null)
    const result = await service.listRevisions('999')
    expect(result).toEqual({ success: false, error: 'Dataset not found' })
  })
})

describe('getRevision', () => {
  it('returns ok with revision detail', async () => {
    mockRepo.findById.mockResolvedValue({ id: '1', name: 'ds1', attributes: ['input', 'expected_output'], schemaVersion: 1, items: [] })
    const revision = { id: 'rev1', schemaVersion: 1, attributes: ['input', 'expected_output'], createdAt: new Date(), items: [], experiments: [] }
    mockRepo.findRevisionById.mockResolvedValue(revision)
    const result = await service.getRevision('1', 'rev1')
    expect(result).toEqual({ success: true, data: revision })
  })

  it('returns fail when revision not found', async () => {
    mockRepo.findById.mockResolvedValue({ id: '1', name: 'ds1', attributes: ['input', 'expected_output'], schemaVersion: 1, items: [] })
    mockRepo.findRevisionById.mockResolvedValue(null)
    const result = await service.getRevision('1', 'rev999')
    expect(result).toEqual({ success: false, error: 'Revision not found' })
  })

  it('returns fail when dataset not found', async () => {
    mockRepo.findById.mockResolvedValue(null)
    const result = await service.getRevision('999', 'rev1')
    expect(result).toEqual({ success: false, error: 'Dataset not found' })
  })
})
