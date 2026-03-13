import { describe, it, expect } from 'vitest'
import { datasetRepository as repo } from '../../datasets/repository.js'

describe('datasets repository (integration)', () => {
  // 1. create → initial revision with schemaVersion=1, default attributes, 0 items
  it('create creates dataset with initial revision', async () => {
    const created = await repo.create('test-ds-1')
    expect(created.id).toBeDefined()
    expect(created.name).toBe('test-ds-1')
    expect(created.attributes).toEqual(['input', 'expected_output'])
    expect(created.schemaVersion).toBe(1)
    expect(created.items).toEqual([])
  })

  // 2. findById returns dataset with latest revision's attributes and items
  it('findById returns dataset with latest revision data', async () => {
    const created = await repo.create('find-ds')
    const found = await repo.findById(created.id)
    expect(found).not.toBeNull()
    expect(found!.name).toBe('find-ds')
    expect(found!.attributes).toEqual(['input', 'expected_output'])
    expect(found!.schemaVersion).toBe(1)
    expect(found!.items).toEqual([])
  })

  // 3. findAll returns datasets with item count from latest revision
  it('findAll returns datasets with correct item counts', async () => {
    const ds1 = await repo.create('findall-ds1')
    const ds2 = await repo.create('findall-ds2')
    await repo.createItem(ds1.id, { input: 'a', expected_output: 'b' })
    await repo.createItem(ds1.id, { input: 'c', expected_output: 'd' })

    const all = await repo.findAll()
    const r1 = all.find((d) => d.id === ds1.id)
    const r2 = all.find((d) => d.id === ds2.id)
    expect(r1).toBeDefined()
    expect(r2).toBeDefined()
    expect(r1!.itemCount).toBe(2)
    expect(r2!.itemCount).toBe(0)
  })

  // 4. findByName
  it('findByName returns the dataset with matching name', async () => {
    const created = await repo.create('alpha')
    const found = await repo.findByName('alpha')
    expect(found).not.toBeNull()
    expect(found!.id).toBe(created.id)
  })

  it('findByName returns null for non-existent name', async () => {
    const found = await repo.findByName('nonexistent-xyzzy')
    expect(found).toBeNull()
  })

  // 5. update changes name
  it('update changes the dataset name', async () => {
    const created = await repo.create('old-name')
    await repo.update(created.id, 'new-name')
    const found = await repo.findById(created.id)
    expect(found!.name).toBe('new-name')
  })

  // 6. remove cascades to revisions and items
  it('remove deletes the dataset and cascades to revisions', async () => {
    const ds = await repo.create('cascade-ds')
    await repo.createItem(ds.id, { input: 'x', expected_output: 'y' })
    await repo.remove(ds.id)
    const found = await repo.findById(ds.id)
    expect(found).toBeNull()
  })

  // 7. createItem → new revision with item, previous revision unchanged
  it('createItem creates a new revision with the item', async () => {
    const ds = await repo.create('item-ds')
    const item = await repo.createItem(ds.id, { input: 'hello', expected_output: 'world' })

    expect(item.itemId).toBeDefined()
    expect(item.values).toEqual({ input: 'hello', expected_output: 'world' })

    const found = await repo.findById(ds.id)
    expect(found!.items).toHaveLength(1)
    expect(found!.items[0].itemId).toBe(item.itemId)
    expect(found!.schemaVersion).toBe(1) // unchanged

    // Previous revision (initial) still has 0 items
    const revisions = await repo.findRevisions(ds.id)
    expect(revisions).toHaveLength(2) // initial + after create
    expect(revisions[0].itemCount).toBe(1) // latest
    expect(revisions[1].itemCount).toBe(0) // initial
  })

  // 8. Creating two items creates two revisions; latest has both
  it('creating two items results in latest revision having both', async () => {
    const ds = await repo.create('two-items-ds')
    const item1 = await repo.createItem(ds.id, { input: 'a', expected_output: 'b' })
    const item2 = await repo.createItem(ds.id, { input: 'c', expected_output: 'd' })

    const found = await repo.findById(ds.id)
    expect(found!.items).toHaveLength(2)
    const itemIds = found!.items.map((i: { itemId: string }) => i.itemId).sort()
    expect(itemIds).toEqual([item1.itemId, item2.itemId].sort())

    const revisions = await repo.findRevisions(ds.id)
    expect(revisions).toHaveLength(3) // initial + 2 creates
  })

  // 9. updateItem → new revision with updated values, same itemId
  it('updateItem creates new revision with updated values and same itemId', async () => {
    const ds = await repo.create('update-item-ds')
    const item = await repo.createItem(ds.id, { input: 'old', expected_output: 'old-out' })

    const updated = await repo.updateItem(item.itemId, { input: 'new', expected_output: 'new-out' })
    expect(updated.itemId).toBe(item.itemId)
    expect(updated.values).toEqual({ input: 'new', expected_output: 'new-out' })

    const found = await repo.findById(ds.id)
    expect(found!.items).toHaveLength(1)
    expect((found!.items[0].values as Record<string, string>).input).toBe('new')

    // Previous revision still has old values
    const revisions = await repo.findRevisions(ds.id)
    const oldRevision = revisions[revisions.length - 2] // second from last
    const oldDetail = await repo.findRevisionById(ds.id, oldRevision.id)
    expect((oldDetail!.items[0].values as Record<string, string>).input).toBe('old')
  })

  // 10. removeItem → new revision without the item, previous still has it
  it('removeItem creates new revision without the deleted item', async () => {
    const ds = await repo.create('remove-item-ds')
    const item1 = await repo.createItem(ds.id, { input: 'keep', expected_output: 'me' })
    const item2 = await repo.createItem(ds.id, { input: 'delete', expected_output: 'me' })

    await repo.removeItem(item2.itemId)

    const found = await repo.findById(ds.id)
    expect(found!.items).toHaveLength(1)
    expect(found!.items[0].itemId).toBe(item1.itemId)

    // Previous revision still has both items
    const revisions = await repo.findRevisions(ds.id)
    const prevRevision = revisions[1] // second most recent
    expect(prevRevision.itemCount).toBe(2)
  })

  // 11. addAttribute → new revision with schemaVersion+1, items backfilled
  it('addAttribute creates new revision with incremented schemaVersion and backfilled items', async () => {
    const ds = await repo.create('add-attr-ds')
    await repo.createItem(ds.id, { input: 'a', expected_output: 'b' })

    const updated = await repo.addAttribute(ds.id, 'context')

    expect(updated.attributes).toContain('context')
    expect(updated.schemaVersion).toBe(2)

    const found = await repo.findById(ds.id)
    expect((found!.items[0].values as Record<string, string>).context).toBe('')

    // Previous revision does NOT have 'context'
    const revisions = await repo.findRevisions(ds.id)
    const prevSchemaVersion = revisions[1].schemaVersion
    expect(prevSchemaVersion).toBe(1)
  })

  // 12. addAttribute with zero items
  it('addAttribute works when dataset has no items', async () => {
    const ds = await repo.create('add-attr-empty-ds')
    const updated = await repo.addAttribute(ds.id, 'context')
    expect(updated.attributes).toContain('context')
    expect(updated.schemaVersion).toBe(2)
  })

  // 13. removeAttribute → new revision with schemaVersion+1, attribute stripped
  it('removeAttribute creates new revision with stripped attribute', async () => {
    const ds = await repo.create('remove-attr-ds')
    await repo.addAttribute(ds.id, 'context')
    await repo.createItem(ds.id, { input: 'q', expected_output: 'a', context: 'some context' })

    const updated = await repo.removeAttribute(ds.id, 'context')

    expect(updated.attributes).not.toContain('context')
    expect(updated.schemaVersion).toBe(3) // 1 (initial) + 1 (add) + 1 (remove)

    const found = await repo.findById(ds.id)
    expect((found!.items[0].values as Record<string, string>)).not.toHaveProperty('context')
  })

  // 14. add then remove round-trip
  it('addAttribute then removeAttribute returns item to original shape', async () => {
    const ds = await repo.create('roundtrip-attr-ds')
    const item = await repo.createItem(ds.id, { input: 'x', expected_output: 'y' })

    await repo.addAttribute(ds.id, 'extra')
    const afterAdd = await repo.findById(ds.id)
    expect((afterAdd!.items[0].values as Record<string, string>).extra).toBe('')

    await repo.removeAttribute(ds.id, 'extra')
    const afterRemove = await repo.findById(ds.id)
    expect(afterRemove!.items[0].values).toEqual({ input: 'x', expected_output: 'y' })
  })

  // 15. countItems returns count from latest revision
  it('countItems returns item count from latest revision', async () => {
    const ds = await repo.create('count-ds')
    expect(await repo.countItems(ds.id)).toBe(0)
    await repo.createItem(ds.id, { input: '1', expected_output: 'a' })
    await repo.createItem(ds.id, { input: '2', expected_output: 'b' })
    expect(await repo.countItems(ds.id)).toBe(2)
  })

  // 16. findRevisions returns all revisions ordered by createdAt DESC
  it('findRevisions returns revisions newest first', async () => {
    const ds = await repo.create('revisions-ds')
    await repo.createItem(ds.id, { input: 'a', expected_output: 'b' })
    await repo.addAttribute(ds.id, 'extra')

    const revisions = await repo.findRevisions(ds.id)
    expect(revisions.length).toBeGreaterThanOrEqual(3)
    // Newest first
    for (let i = 0; i < revisions.length - 1; i++) {
      expect(new Date(revisions[i].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(revisions[i + 1].createdAt).getTime(),
      )
    }
  })

  // 17. findRevisionById returns revision with items
  it('findRevisionById returns revision detail with items', async () => {
    const ds = await repo.create('rev-detail-ds')
    await repo.createItem(ds.id, { input: 'q', expected_output: 'a' })

    const revisions = await repo.findRevisions(ds.id)
    const latest = revisions[0]
    const detail = await repo.findRevisionById(ds.id, latest.id)

    expect(detail).not.toBeNull()
    expect(detail!.items).toHaveLength(1)
    expect(detail!.attributes).toEqual(['input', 'expected_output'])
  })

  // 18. importItems creates exactly one new revision
  it('importItems creates exactly one revision with all items', async () => {
    const ds = await repo.create('import-ds')
    await repo.createItem(ds.id, { input: 'existing', expected_output: 'item' })

    const beforeCount = (await repo.findRevisions(ds.id)).length

    await repo.importItems(ds.id, [
      { input: 'new1', expected_output: 'a1' },
      { input: 'new2', expected_output: 'a2' },
      { input: 'new3', expected_output: 'a3' },
    ])

    const afterRevisions = await repo.findRevisions(ds.id)
    expect(afterRevisions.length).toBe(beforeCount + 1) // exactly one new revision

    const found = await repo.findById(ds.id)
    expect(found!.items).toHaveLength(4) // 1 existing + 3 imported
  })

  // 19. findItemById returns item from latest revision by stable itemId
  it('findItemById returns item from latest revision by stable itemId', async () => {
    const ds = await repo.create('find-item-ds')
    const item = await repo.createItem(ds.id, { input: 'hello', expected_output: 'world' })

    const found = await repo.findItemById(item.itemId)
    expect(found).not.toBeNull()
    expect(found!.itemId).toBe(item.itemId)
    expect(found!.values).toEqual({ input: 'hello', expected_output: 'world' })
  })
})
