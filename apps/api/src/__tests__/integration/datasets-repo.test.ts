import { describe, it, expect } from 'vitest'
import { type Result } from '@eval-harness/shared'
import { datasetRepository as repo } from '../../datasets/repository.js'

/** Extract data from Result, fail test if not successful */
function unwrap<T>(result: Result<T>): T {
  expect(result.success).toBe(true)
  if (!result.success) throw new Error(result.error)
  return result.data
}

describe('datasets repository (integration)', () => {
  // 1. create → initial revision with schemaVersion=1, default attributes, 0 items
  it('create creates dataset with initial revision', async () => {
    const created = unwrap(await repo.create('test-ds-1'))
    expect(created.id).toBeDefined()
    expect(created.name).toBe('test-ds-1')
    expect(created.attributes).toEqual(['input', 'expected_output'])
    expect(created.schemaVersion).toBe(1)
    expect(created.items).toEqual([])
  })

  // 2. findById returns dataset with latest revision's attributes and items
  it('findById returns dataset with latest revision data', async () => {
    const created = unwrap(await repo.create('find-ds'))
    const found = unwrap(await repo.findById(created.id))
    expect(found.name).toBe('find-ds')
    expect(found.attributes).toEqual(['input', 'expected_output'])
    expect(found.schemaVersion).toBe(1)
    expect(found.items).toEqual([])
  })

  // 3. findAll returns datasets with item count from latest revision
  it('findAll returns datasets with correct item counts', async () => {
    const ds1 = unwrap(await repo.create('findall-ds1'))
    const ds2 = unwrap(await repo.create('findall-ds2'))
    unwrap(await repo.createItem(ds1.id, { input: 'a', expected_output: 'b' }))
    unwrap(await repo.createItem(ds1.id, { input: 'c', expected_output: 'd' }))

    const all = unwrap(await repo.findAll())
    const r1 = all.find((d) => d.id === ds1.id)
    const r2 = all.find((d) => d.id === ds2.id)
    expect(r1).toBeDefined()
    expect(r2).toBeDefined()
    expect(r1!.itemCount).toBe(2)
    expect(r2!.itemCount).toBe(0)
  })

  // 4. findByName
  it('findByName returns the dataset with matching name', async () => {
    const created = unwrap(await repo.create('alpha'))
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
    const created = unwrap(await repo.create('old-name'))
    unwrap(await repo.update(created.id, 'new-name'))
    const found = unwrap(await repo.findById(created.id))
    expect(found.name).toBe('new-name')
  })

  // 6. remove (soft delete) — findById returns fail after removal
  it('remove soft-deletes the dataset so findById returns fail', async () => {
    const ds = unwrap(await repo.create('soft-delete-ds'))
    unwrap(await repo.createItem(ds.id, { input: 'x', expected_output: 'y' }))
    unwrap(await repo.remove(ds.id))
    const result = await repo.findById(ds.id)
    expect(result.success).toBe(false)
  })

  // 6b. soft-deleted dataset does not appear in findAll
  it('soft-deleted dataset does not appear in findAll', async () => {
    const ds = unwrap(await repo.create('hidden-after-delete-ds'))
    unwrap(await repo.remove(ds.id))
    const all = unwrap(await repo.findAll())
    const ids = all.map((d) => d.id)
    expect(ids).not.toContain(ds.id)
  })

  // 6c. soft-deleted dataset name can be reused
  it('findByName returns null for a soft-deleted dataset', async () => {
    const ds = unwrap(await repo.create('reusable-ds-name'))
    unwrap(await repo.remove(ds.id))
    const found = await repo.findByName('reusable-ds-name')
    expect(found).toBeNull()
  })

  // 6d. soft-deleting dataset does not delete experiments referencing it
  it('soft-deleting dataset does not affect the grader', async () => {
    const ds = unwrap(await repo.create('ds-soft-del-check'))
    unwrap(await repo.remove(ds.id))
    const result = await repo.findById(ds.id)
    expect(result.success).toBe(false)
  })

  // 7. createItem → new revision with item, previous revision unchanged
  it('createItem creates a new revision with the item', async () => {
    const ds = unwrap(await repo.create('item-ds'))
    const item = unwrap(await repo.createItem(ds.id, { input: 'hello', expected_output: 'world' }))

    expect(item.itemId).toBeDefined()
    expect(item.values).toEqual({ input: 'hello', expected_output: 'world' })

    const found = unwrap(await repo.findById(ds.id))
    expect(found.items).toHaveLength(1)
    expect(found.items[0].itemId).toBe(item.itemId)
    expect(found.schemaVersion).toBe(1) // unchanged

    // Previous revision (initial) still has 0 items
    const revisions = unwrap(await repo.findRevisions(ds.id))
    expect(revisions).toHaveLength(2) // initial + after create
    expect(revisions[0].itemCount).toBe(1) // latest
    expect(revisions[1].itemCount).toBe(0) // initial
  })

  // 8. Creating two items creates two revisions; latest has both
  it('creating two items results in latest revision having both', async () => {
    const ds = unwrap(await repo.create('two-items-ds'))
    const item1 = unwrap(await repo.createItem(ds.id, { input: 'a', expected_output: 'b' }))
    const item2 = unwrap(await repo.createItem(ds.id, { input: 'c', expected_output: 'd' }))

    const found = unwrap(await repo.findById(ds.id))
    expect(found.items).toHaveLength(2)
    const itemIds = found.items.map((i: { itemId: string }) => i.itemId).sort()
    expect(itemIds).toEqual([item1.itemId, item2.itemId].sort())

    const revisions = unwrap(await repo.findRevisions(ds.id))
    expect(revisions).toHaveLength(3) // initial + 2 creates
  })

  // 9. updateItem → new revision with updated values, same itemId
  it('updateItem creates new revision with updated values and same itemId', async () => {
    const ds = unwrap(await repo.create('update-item-ds'))
    const item = unwrap(await repo.createItem(ds.id, { input: 'old', expected_output: 'old-out' }))

    const updated = unwrap(
      await repo.updateItem(item.itemId, { input: 'new', expected_output: 'new-out' }),
    )
    expect(updated.itemId).toBe(item.itemId)
    expect(updated.values).toEqual({ input: 'new', expected_output: 'new-out' })

    const found = unwrap(await repo.findById(ds.id))
    expect(found.items).toHaveLength(1)
    expect((found.items[0].values as Record<string, string>).input).toBe('new')

    // Previous revision still has old values
    const revisions = unwrap(await repo.findRevisions(ds.id))
    const oldRevision = revisions[revisions.length - 2] // second from last
    const oldDetail = unwrap(await repo.findRevisionById(ds.id, oldRevision.id))
    expect((oldDetail.items[0].values as Record<string, string>).input).toBe('old')
  })

  // 10. removeItem → new revision without the item, previous still has it
  it('removeItem creates new revision without the deleted item', async () => {
    const ds = unwrap(await repo.create('remove-item-ds'))
    const item1 = unwrap(await repo.createItem(ds.id, { input: 'keep', expected_output: 'me' }))
    const item2 = unwrap(await repo.createItem(ds.id, { input: 'delete', expected_output: 'me' }))

    unwrap(await repo.removeItem(item2.itemId))

    const found = unwrap(await repo.findById(ds.id))
    expect(found.items).toHaveLength(1)
    expect(found.items[0].itemId).toBe(item1.itemId)

    // Previous revision still has both items
    const revisions = unwrap(await repo.findRevisions(ds.id))
    const prevRevision = revisions[1] // second most recent
    expect(prevRevision.itemCount).toBe(2)
  })

  // 11. addAttribute → new revision with schemaVersion+1, items backfilled
  it('addAttribute creates new revision with incremented schemaVersion and backfilled items', async () => {
    const ds = unwrap(await repo.create('add-attr-ds'))
    unwrap(await repo.createItem(ds.id, { input: 'a', expected_output: 'b' }))

    const updated = unwrap(await repo.addAttribute(ds.id, 'context'))

    expect(updated.attributes).toContain('context')
    expect(updated.schemaVersion).toBe(2)

    const found = unwrap(await repo.findById(ds.id))
    expect((found.items[0].values as Record<string, string>).context).toBe('')

    // Previous revision does NOT have 'context'
    const revisions = unwrap(await repo.findRevisions(ds.id))
    const prevSchemaVersion = revisions[1].schemaVersion
    expect(prevSchemaVersion).toBe(1)
  })

  // 12. addAttribute with zero items
  it('addAttribute works when dataset has no items', async () => {
    const ds = unwrap(await repo.create('add-attr-empty-ds'))
    const updated = unwrap(await repo.addAttribute(ds.id, 'context'))
    expect(updated.attributes).toContain('context')
    expect(updated.schemaVersion).toBe(2)
  })

  // 13. removeAttribute → new revision with schemaVersion+1, attribute stripped
  it('removeAttribute creates new revision with stripped attribute', async () => {
    const ds = unwrap(await repo.create('remove-attr-ds'))
    unwrap(await repo.addAttribute(ds.id, 'context'))
    unwrap(
      await repo.createItem(ds.id, { input: 'q', expected_output: 'a', context: 'some context' }),
    )

    const updated = unwrap(await repo.removeAttribute(ds.id, 'context'))

    expect(updated.attributes).not.toContain('context')
    expect(updated.schemaVersion).toBe(3) // 1 (initial) + 1 (add) + 1 (remove)

    const found = unwrap(await repo.findById(ds.id))
    expect(found.items[0].values as Record<string, string>).not.toHaveProperty('context')
  })

  // 14. add then remove round-trip
  it('addAttribute then removeAttribute returns item to original shape', async () => {
    const ds = unwrap(await repo.create('roundtrip-attr-ds'))
    unwrap(await repo.createItem(ds.id, { input: 'x', expected_output: 'y' }))

    unwrap(await repo.addAttribute(ds.id, 'extra'))
    const afterAdd = unwrap(await repo.findById(ds.id))
    expect((afterAdd.items[0].values as Record<string, string>).extra).toBe('')

    unwrap(await repo.removeAttribute(ds.id, 'extra'))
    const afterRemove = unwrap(await repo.findById(ds.id))
    expect(afterRemove.items[0].values).toEqual({ input: 'x', expected_output: 'y' })
  })

  // 15. countItems returns count from latest revision
  it('countItems returns item count from latest revision', async () => {
    const ds = unwrap(await repo.create('count-ds'))
    expect(unwrap(await repo.countItems(ds.id))).toBe(0)
    unwrap(await repo.createItem(ds.id, { input: '1', expected_output: 'a' }))
    unwrap(await repo.createItem(ds.id, { input: '2', expected_output: 'b' }))
    expect(unwrap(await repo.countItems(ds.id))).toBe(2)
  })

  // 16. findRevisions returns all revisions ordered by createdAt DESC
  it('findRevisions returns revisions newest first', async () => {
    const ds = unwrap(await repo.create('revisions-ds'))
    unwrap(await repo.createItem(ds.id, { input: 'a', expected_output: 'b' }))
    unwrap(await repo.addAttribute(ds.id, 'extra'))

    const revisions = unwrap(await repo.findRevisions(ds.id))
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
    const ds = unwrap(await repo.create('rev-detail-ds'))
    unwrap(await repo.createItem(ds.id, { input: 'q', expected_output: 'a' }))

    const revisions = unwrap(await repo.findRevisions(ds.id))
    const latest = revisions[0]
    const detail = unwrap(await repo.findRevisionById(ds.id, latest.id))

    expect(detail.items).toHaveLength(1)
    expect(detail.attributes).toEqual(['input', 'expected_output'])
  })

  // 18. importItems creates exactly one new revision and REPLACES existing items
  it('importItems creates exactly one revision with only the imported items (replaces existing)', async () => {
    const ds = unwrap(await repo.create('import-ds'))
    unwrap(await repo.createItem(ds.id, { input: 'existing', expected_output: 'item' }))

    const beforeCount = unwrap(await repo.findRevisions(ds.id)).length

    unwrap(
      await repo.importItems(ds.id, [
        { input: 'new1', expected_output: 'a1' },
        { input: 'new2', expected_output: 'a2' },
        { input: 'new3', expected_output: 'a3' },
      ]),
    )

    const afterRevisions = unwrap(await repo.findRevisions(ds.id))
    expect(afterRevisions.length).toBe(beforeCount + 1) // exactly one new revision

    const found = unwrap(await repo.findById(ds.id))
    expect(found.items).toHaveLength(3) // existing item REPLACED — only 3 imported items remain
  })

  // 19. findItemById returns item from latest revision by stable itemId
  it('findItemById returns item from latest revision by stable itemId', async () => {
    const ds = unwrap(await repo.create('find-item-ds'))
    const item = unwrap(await repo.createItem(ds.id, { input: 'hello', expected_output: 'world' }))

    const found = unwrap(await repo.findItemById(item.itemId))
    expect(found.itemId).toBe(item.itemId)
    expect(found.values).toEqual({ input: 'hello', expected_output: 'world' })
  })

  // 20. findRevisions includes experimentCount
  it('findRevisions includes experimentCount', async () => {
    const ds = unwrap(await repo.create('rev-exp-count-ds'))
    unwrap(await repo.createItem(ds.id, { input: 'q', expected_output: 'a' }))

    const revisions = unwrap(await repo.findRevisions(ds.id))
    // No experiments yet — count should be 0
    expect(revisions[0]).toHaveProperty('experimentCount')
    expect(revisions[0].experimentCount).toBe(0)
  })

  // 21. findRevisionById includes experiments list
  it('findRevisionById includes experiments list', async () => {
    const ds = unwrap(await repo.create('rev-exp-list-ds'))
    unwrap(await repo.createItem(ds.id, { input: 'q', expected_output: 'a' }))

    const revisions = unwrap(await repo.findRevisions(ds.id))
    const detail = unwrap(await repo.findRevisionById(ds.id, revisions[0].id))
    expect(detail).toHaveProperty('experiments')
    expect(Array.isArray(detail.experiments)).toBe(true)
  })

  // 22. schemaVersion unchanged after updateItem
  it('schemaVersion unchanged after updateItem', async () => {
    const ds = unwrap(await repo.create('sv-update-ds'))
    const item = unwrap(await repo.createItem(ds.id, { input: 'old', expected_output: 'val' }))
    const beforeSV = unwrap(await repo.findById(ds.id)).schemaVersion

    unwrap(await repo.updateItem(item.itemId, { input: 'new', expected_output: 'val' }))
    const afterSV = unwrap(await repo.findById(ds.id)).schemaVersion

    expect(afterSV).toBe(beforeSV)
  })

  // 23. schemaVersion unchanged after removeItem
  it('schemaVersion unchanged after removeItem', async () => {
    const ds = unwrap(await repo.create('sv-remove-ds'))
    const item = unwrap(await repo.createItem(ds.id, { input: 'x', expected_output: 'y' }))
    const beforeSV = unwrap(await repo.findById(ds.id)).schemaVersion

    unwrap(await repo.removeItem(item.itemId))
    const afterSV = unwrap(await repo.findById(ds.id)).schemaVersion

    expect(afterSV).toBe(beforeSV)
  })

  // 24. schemaVersion unchanged after importItems
  it('schemaVersion unchanged after importItems', async () => {
    const ds = unwrap(await repo.create('sv-import-ds'))
    const beforeSV = unwrap(await repo.findById(ds.id)).schemaVersion

    unwrap(await repo.importItems(ds.id, [{ input: 'a', expected_output: 'b' }]))
    const afterSV = unwrap(await repo.findById(ds.id)).schemaVersion

    expect(afterSV).toBe(beforeSV)
  })

  // 25. Previous revision items unchanged after addAttribute (immutability)
  it('previous revision retains original schema after addAttribute', async () => {
    const ds = unwrap(await repo.create('immut-attr-ds'))
    unwrap(await repo.createItem(ds.id, { input: 'q', expected_output: 'a' }))

    const revsBefore = unwrap(await repo.findRevisions(ds.id))
    const prevRevId = revsBefore[0].id

    unwrap(await repo.addAttribute(ds.id, 'extra'))

    const prevDetail = unwrap(await repo.findRevisionById(ds.id, prevRevId))
    expect(prevDetail.attributes).not.toContain('extra')
    expect(prevDetail.items[0].values as Record<string, string>).not.toHaveProperty('extra')
  })

  // 26. Previous revision still has deleted item (immutability)
  it('previous revision retains deleted item after removeItem', async () => {
    const ds = unwrap(await repo.create('immut-del-ds'))
    const item = unwrap(
      await repo.createItem(ds.id, { input: 'will-delete', expected_output: 'val' }),
    )

    const revsBefore = unwrap(await repo.findRevisions(ds.id))
    const prevRevId = revsBefore[0].id

    unwrap(await repo.removeItem(item.itemId))

    const prevDetail = unwrap(await repo.findRevisionById(ds.id, prevRevId))
    expect(prevDetail.items).toHaveLength(1)
    expect((prevDetail.items[0].values as Record<string, string>).input).toBe('will-delete')
  })

  // 27. Items are returned in insertion order (C2)
  it('preserves item insertion order', async () => {
    const ds = unwrap(await repo.create('order-test'))
    unwrap(await repo.createItem(ds.id, { input: 'first', expected_output: '1' }))
    unwrap(await repo.createItem(ds.id, { input: 'second', expected_output: '2' }))
    unwrap(await repo.createItem(ds.id, { input: 'third', expected_output: '3' }))

    const found = unwrap(await repo.findById(ds.id))
    expect((found.items[0].values as Record<string, string>).input).toBe('first')
    expect((found.items[1].values as Record<string, string>).input).toBe('second')
    expect((found.items[2].values as Record<string, string>).input).toBe('third')
  })

  // 28. Order preserved after edit (C2)
  it('preserves item order after edit', async () => {
    const ds = unwrap(await repo.create('order-edit-test'))
    const i1 = unwrap(await repo.createItem(ds.id, { input: 'first', expected_output: '1' }))
    unwrap(await repo.createItem(ds.id, { input: 'second', expected_output: '2' }))

    unwrap(await repo.updateItem(i1.itemId, { input: 'first-edited', expected_output: '1' }))

    const found = unwrap(await repo.findById(ds.id))
    expect((found.items[0].values as Record<string, string>).input).toBe('first-edited')
    expect((found.items[1].values as Record<string, string>).input).toBe('second')
  })

  // 29. findRevisions marks first entry as isCurrent (C3)
  it('findRevisions marks first entry as isCurrent', async () => {
    const ds = unwrap(await repo.create('is-current-test'))
    unwrap(await repo.createItem(ds.id, { input: 'q', expected_output: 'a' }))

    const revisions = unwrap(await repo.findRevisions(ds.id))
    expect(revisions[0].isCurrent).toBe(true)
    expect(revisions[1].isCurrent).toBe(false)
  })
})
