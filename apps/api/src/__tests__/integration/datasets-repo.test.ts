import { datasetRepository as repo } from '../../datasets/repository.js'

describe('datasets repository (integration)', () => {
  // 1. create → findById round-trip
  it('create then findById returns dataset with correct name and default attributes', async () => {
    const created = await repo.create('test-dataset-1')
    const found = await repo.findById(created.id)

    expect(found).not.toBeNull()
    expect(found!.id).toBe(created.id)
    expect(found!.name).toBe('test-dataset-1')
    expect(found!.attributes).toEqual(['input', 'expected_output'])
  })

  // 2. findAll returns datasets with item count
  it('findAll returns all datasets with correct item counts', async () => {
    const ds1 = await repo.create('findall-ds1')
    const ds2 = await repo.create('findall-ds2')
    await repo.createItem(ds1.id, { input: 'a', expected_output: 'b' })
    await repo.createItem(ds1.id, { input: 'c', expected_output: 'd' })

    const all = await repo.findAll()
    const r1 = all.find((d) => d.id === ds1.id)
    const r2 = all.find((d) => d.id === ds2.id)

    expect(r1).toBeDefined()
    expect(r2).toBeDefined()
    expect(r1!._count.items).toBe(2)
    expect(r2!._count.items).toBe(0)
  })

  // 3. findByName returns correct row
  it('findByName returns the dataset with the matching name', async () => {
    const created = await repo.create('alpha')
    const found = await repo.findByName('alpha')

    expect(found).not.toBeNull()
    expect(found!.id).toBe(created.id)
    expect(found!.name).toBe('alpha')
  })

  // 4. findByName returns null for unknown
  it('findByName returns null for a non-existent name', async () => {
    const found = await repo.findByName('nonexistent-xyzzy')
    expect(found).toBeNull()
  })

  // 5. update changes name
  it('update changes the dataset name', async () => {
    const created = await repo.create('old-name')
    await repo.update(created.id, 'new-name')
    const found = await repo.findById(created.id)

    expect(found).not.toBeNull()
    expect(found!.name).toBe('new-name')
  })

  // 6. remove cascades to items
  it('remove deletes the dataset and cascades to its items', async () => {
    const ds = await repo.create('cascade-ds')
    const item1 = await repo.createItem(ds.id, { input: 'x', expected_output: 'y' })
    const item2 = await repo.createItem(ds.id, { input: 'a', expected_output: 'b' })

    await repo.remove(ds.id)

    const found1 = await repo.findItemById(item1.id)
    const found2 = await repo.findItemById(item2.id)
    expect(found1).toBeNull()
    expect(found2).toBeNull()
  })

  // 7. createItem → findItemById
  it('createItem then findItemById returns the item with correct JSONB values', async () => {
    const ds = await repo.create('item-roundtrip-ds')
    const item = await repo.createItem(ds.id, { input: 'hello', expected_output: 'world' })
    const found = await repo.findItemById(item.id)

    expect(found).not.toBeNull()
    expect(found!.id).toBe(item.id)
    expect(found!.datasetId).toBe(ds.id)
    expect(found!.values).toEqual({ input: 'hello', expected_output: 'world' })
  })

  // 8. updateItem replaces values
  it('updateItem replaces the item values', async () => {
    const ds = await repo.create('update-item-ds')
    const item = await repo.createItem(ds.id, { input: 'old', expected_output: 'old-out' })
    await repo.updateItem(item.id, { input: 'new', expected_output: 'new-out' })
    const found = await repo.findItemById(item.id)

    expect(found).not.toBeNull()
    expect(found!.values).toEqual({ input: 'new', expected_output: 'new-out' })
  })

  // 9. removeItem leaves siblings
  it('removeItem deletes only the target item and leaves siblings', async () => {
    const ds = await repo.create('remove-item-ds')
    const item1 = await repo.createItem(ds.id, { input: 'keep', expected_output: 'me' })
    const item2 = await repo.createItem(ds.id, { input: 'delete', expected_output: 'me' })

    await repo.removeItem(item2.id)

    const remaining = await repo.findItemsByDatasetId(ds.id)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(item1.id)
  })

  // 10. countItems accuracy
  it('countItems returns accurate count as items are added', async () => {
    const ds = await repo.create('count-ds')

    expect(await repo.countItems(ds.id)).toBe(0)

    await repo.createItem(ds.id, { input: '1', expected_output: 'a' })
    await repo.createItem(ds.id, { input: '2', expected_output: 'b' })
    await repo.createItem(ds.id, { input: '3', expected_output: 'c' })

    expect(await repo.countItems(ds.id)).toBe(3)
  })

  // 11. addAttribute backfills items
  it('addAttribute adds the attribute to the dataset and backfills existing items with empty string', async () => {
    const ds = await repo.create('add-attr-ds')
    const item1 = await repo.createItem(ds.id, { input: 'a', expected_output: 'b' })
    const item2 = await repo.createItem(ds.id, { input: 'c', expected_output: 'd' })

    const updated = await repo.addAttribute(ds.id, 'context')

    expect(updated.attributes).toContain('context')

    const found1 = await repo.findItemById(item1.id)
    const found2 = await repo.findItemById(item2.id)
    expect((found1!.values as Record<string, string>).context).toBe('')
    expect((found2!.values as Record<string, string>).context).toBe('')
  })

  // 12. addAttribute with zero items
  it('addAttribute works when the dataset has no items', async () => {
    const ds = await repo.create('add-attr-empty-ds')

    const updated = await repo.addAttribute(ds.id, 'context')

    expect(updated.attributes).toContain('context')
  })

  // 13. removeAttribute strips from items
  it('removeAttribute removes the attribute from the dataset and strips it from all items', async () => {
    const ds = await repo.create('remove-attr-ds')
    await repo.addAttribute(ds.id, 'context')
    const item = await repo.createItem(ds.id, {
      input: 'q',
      expected_output: 'a',
      context: 'some context',
    })

    const updated = await repo.removeAttribute(ds.id, 'context')

    expect(updated.attributes).not.toContain('context')

    const found = await repo.findItemById(item.id)
    expect(found).not.toBeNull()
    expect((found!.values as Record<string, string>)).not.toHaveProperty('context')
  })

  // 14. add then remove round-trip
  it('addAttribute then removeAttribute returns item to its original shape', async () => {
    const ds = await repo.create('roundtrip-attr-ds')
    const item = await repo.createItem(ds.id, { input: 'x', expected_output: 'y' })
    const originalValues = item.values as Record<string, string>

    await repo.addAttribute(ds.id, 'extra')
    const afterAdd = await repo.findItemById(item.id)
    expect((afterAdd!.values as Record<string, string>).extra).toBe('')

    await repo.removeAttribute(ds.id, 'extra')
    const afterRemove = await repo.findItemById(item.id)
    expect(afterRemove!.values).toEqual(originalValues)
  })
})
