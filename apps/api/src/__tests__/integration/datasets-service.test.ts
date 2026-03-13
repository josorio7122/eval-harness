import { describe, it, expect } from 'vitest'
import { datasetRepository } from '../../datasets/repository.js'
import { createDatasetService } from '../../datasets/service.js'

const service = createDatasetService(datasetRepository)

let counter = 0
function uid(prefix: string) {
  return `${prefix}-${++counter}`
}

describe('datasets service (integration)', () => {
  // 1. createDataset ok → row exists in DB via repo.findById
  it('createDataset creates a dataset that is retrievable via repo.findById', async () => {
    const name = uid('svc-ds')
    const result = await service.createDataset({ name })

    expect(result.success).toBe(true)
    if (!result.success) return

    const found = await datasetRepository.findById(result.data.id)
    expect(found).not.toBeNull()
    expect(found!.name).toBe(name)
    expect(found!.attributes).toEqual(['input', 'expected_output'])
    expect(found!.schemaVersion).toBe(1)
  })

  // 2. createDataset duplicate name → returns fail('Dataset name already exists')
  it('createDataset with duplicate name returns fail', async () => {
    const name = uid('svc-dup')
    await service.createDataset({ name })

    const result = await service.createDataset({ name })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('Dataset name already exists')
  })

  // 3. addAttribute → items in DB have new key backfilled with ''
  it('addAttribute backfills existing items with empty string', async () => {
    const ds = await datasetRepository.create(uid('svc-attr-ds'))
    const item1 = await datasetRepository.createItem(ds.id, { input: 'q1', expected_output: 'a1' })
    const item2 = await datasetRepository.createItem(ds.id, { input: 'q2', expected_output: 'a2' })

    const result = await service.addAttribute(ds.id, { name: 'context' })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.schemaVersion).toBe(2)

    const found1 = await datasetRepository.findItemById(item1.itemId)
    const found2 = await datasetRepository.findItemById(item2.itemId)
    expect((found1!.values as Record<string, string>).context).toBe('')
    expect((found2!.values as Record<string, string>).context).toBe('')
  })

  // 4. removeAttribute rejects built-in 'input' → returns fail
  it('removeAttribute on built-in attribute returns fail', async () => {
    const ds = await datasetRepository.create(uid('svc-rm-builtin'))

    const result = await service.removeAttribute(ds.id, 'input')

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('Cannot remove built-in attribute')
  })

  // 5. createItem with correct schema → item persisted in DB
  it('createItem with correct values persists item in DB', async () => {
    const ds = await datasetRepository.create(uid('svc-item-ok'))

    const result = await service.createItem(ds.id, {
      values: { input: 'hello', expected_output: 'world' },
    })

    expect(result.success).toBe(true)
    if (!result.success) return

    const found = await datasetRepository.findItemById(result.data.itemId)
    expect(found).not.toBeNull()
    expect(found!.values).toEqual({ input: 'hello', expected_output: 'world' })
  })

  // 6. createItem with unknown keys → extra keys are ignored, item is created
  it('createItem with unknown keys ignores extras and creates item', async () => {
    const ds = await datasetRepository.create(uid('svc-item-bad'))

    const result = await service.createItem(ds.id, {
      values: { input: 'hi', expected_output: 'there', bogus: 'extra' },
    })

    expect(result.success).toBe(true)

    const items = await datasetRepository.findItemsByDatasetId(ds.id)
    expect(items).toHaveLength(1)
    expect((items[0].values as Record<string, string>).input).toBe('hi')
    expect((items[0].values as Record<string, string>).expected_output).toBe('there')
    expect((items[0].values as Record<string, string>).bogus).toBeUndefined()
  })

  // 7. importCsv creates items → items exist in DB with correct values, single new revision
  it('importCsv creates items in DB with correct values', async () => {
    const ds = await datasetRepository.create(uid('svc-csv-ok'))
    const csv = `input,expected_output\nhello,world\nfoo,bar`

    const revisionsBefore = await datasetRepository.findRevisions(ds.id)

    const result = await service.importCsv(ds.id, csv)

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.imported).toBe(2)
    expect(result.data.skipped).toBe(0)

    const items = await datasetRepository.findItemsByDatasetId(ds.id)
    expect(items).toHaveLength(2)
    const values = items.map((i) => i.values as Record<string, string>)
    expect(values).toEqual(
      expect.arrayContaining([
        { input: 'hello', expected_output: 'world' },
        { input: 'foo', expected_output: 'bar' },
      ]),
    )

    const revisionsAfter = await datasetRepository.findRevisions(ds.id)
    expect(revisionsAfter.length).toBe(revisionsBefore.length + 1)
  })

  // 8. importCsv with mixed-case headers → items created (case-insensitive)
  it('importCsv with mixed-case headers creates items', async () => {
    const ds = await datasetRepository.create(uid('svc-csv-case'))
    const csv = `Input,Expected_Output\nhello,world`

    const result = await service.importCsv(ds.id, csv)

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.imported).toBe(1)

    const items = await datasetRepository.findItemsByDatasetId(ds.id)
    expect(items).toHaveLength(1)
    expect(items[0].values as Record<string, string>).toEqual({
      input: 'hello',
      expected_output: 'world',
    })
  })
})
