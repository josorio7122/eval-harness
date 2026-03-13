import { graderRepository as repo } from '../../graders/repository.js'

describe('graders repository (integration)', () => {
  // 1. create → findById round-trip
  it('create then findById returns the grader with all fields and a valid UUID', async () => {
    const created = await repo.create({
      name: 'accuracy-grader',
      description: 'Checks exact match accuracy',
      rubric: 'Award 1 point for exact match, 0 otherwise.',
    })

    const found = await repo.findById(created.id)

    expect(found).not.toBeNull()
    expect(found!.id).toBe(created.id)
    expect(found!.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
    expect(found!.name).toBe('accuracy-grader')
    expect(found!.description).toBe('Checks exact match accuracy')
    expect(found!.rubric).toBe('Award 1 point for exact match, 0 otherwise.')
  })

  // 2. findAll returns graders
  it('findAll returns all created graders', async () => {
    const g1 = await repo.create({
      name: 'grader-alpha',
      description: 'Alpha grader',
      rubric: 'Rubric alpha',
    })
    const g2 = await repo.create({
      name: 'grader-beta',
      description: 'Beta grader',
      rubric: 'Rubric beta',
    })

    const all = await repo.findAll()
    const ids = all.map((g) => g.id)

    expect(ids).toContain(g1.id)
    expect(ids).toContain(g2.id)
  })

  // 3. update patches rubric only
  it('update with only rubric changes rubric but leaves name and description unchanged', async () => {
    const created = await repo.create({
      name: 'partial-update-grader',
      description: 'Original description',
      rubric: 'Original rubric',
    })

    await repo.update(created.id, { rubric: 'Updated rubric' })
    const found = await repo.findById(created.id)

    expect(found).not.toBeNull()
    expect(found!.rubric).toBe('Updated rubric')
    expect(found!.name).toBe('partial-update-grader')
    expect(found!.description).toBe('Original description')
  })

  // 4. remove deletes
  it('remove deletes the grader so findById returns null', async () => {
    const created = await repo.create({
      name: 'delete-me-grader',
      description: 'To be removed',
      rubric: 'Does not matter',
    })

    await repo.remove(created.id)
    const found = await repo.findById(created.id)

    expect(found).toBeNull()
  })
})
