import { describe, it, expect, beforeEach } from 'vitest'
import { type Result } from '@eval-harness/shared'
import { graderRepository as repo } from '../../graders/repository.js'
import { datasetRepository } from '../../datasets/repository.js'
import { experimentRepository } from '../../experiments/repository.js'
import { prisma } from '../../lib/prisma.js'

/** Extract data from Result, fail test if not successful */
function unwrap<T>(result: Result<T>): T {
  expect(result.success).toBe(true)
  if (!result.success) throw new Error(result.error)
  return result.data
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "Grader" CASCADE')
})

describe('graders repository (integration)', () => {
  // 1. create → findById round-trip
  it('create then findById returns the grader with all fields and a valid UUID', async () => {
    const created = unwrap(
      await repo.create({
        name: 'accuracy-grader',
        description: 'Checks exact match accuracy',
        rubric: 'Award 1 point for exact match, 0 otherwise.',
      }),
    )

    const found = unwrap(await repo.findById(created.id))

    expect(found.id).toBe(created.id)
    expect(found.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(found.name).toBe('accuracy-grader')
    expect(found.description).toBe('Checks exact match accuracy')
    expect(found.rubric).toBe('Award 1 point for exact match, 0 otherwise.')
  })

  // 2. findAll returns graders
  it('findAll returns all created graders', async () => {
    const g1 = unwrap(
      await repo.create({
        name: 'grader-alpha',
        description: 'Alpha grader',
        rubric: 'Rubric alpha',
      }),
    )
    const g2 = unwrap(
      await repo.create({
        name: 'grader-beta',
        description: 'Beta grader',
        rubric: 'Rubric beta',
      }),
    )

    const all = unwrap(await repo.findAll())
    const ids = all.map((g) => g.id)

    expect(ids).toContain(g1.id)
    expect(ids).toContain(g2.id)
  })

  // 3. update patches rubric only
  it('update with only rubric changes rubric but leaves name and description unchanged', async () => {
    const created = unwrap(
      await repo.create({
        name: 'partial-update-grader',
        description: 'Original description',
        rubric: 'Original rubric',
      }),
    )

    unwrap(await repo.update(created.id, { rubric: 'Updated rubric' }))
    const found = unwrap(await repo.findById(created.id))

    expect(found.rubric).toBe('Updated rubric')
    expect(found.name).toBe('partial-update-grader')
    expect(found.description).toBe('Original description')
  })

  // 4. removeWithCascade deletes
  it('removeWithCascade deletes the grader so findById returns fail', async () => {
    const created = unwrap(
      await repo.create({
        name: 'delete-me-grader',
        description: 'To be removed',
        rubric: 'Does not matter',
      }),
    )

    unwrap(await repo.removeWithCascade(created.id))
    const result = await repo.findById(created.id)

    expect(result.success).toBe(false)
  })

  // 5. removeWithCascade deletes grader + its experiments
  it('removeWithCascade deletes associated experiments', async () => {
    const dataset = unwrap(await datasetRepository.create('cascade-test-dataset'))
    unwrap(await datasetRepository.createItem(dataset.id, { input: 'q1', expected_output: 'a1' }))
    const revisions = unwrap(await datasetRepository.findRevisions(dataset.id))
    const revision = revisions[0]

    const grader = unwrap(
      await repo.create({
        name: 'cascade-grader',
        description: 'Will cascade',
        rubric: 'Does not matter',
      }),
    )

    const experiment = unwrap(
      await experimentRepository.create({
        name: 'cascade-experiment',
        datasetId: dataset.id,
        datasetRevisionId: revision.id,
        graderIds: [grader.id],
        modelId: 'google/gemini-2.5-flash',
      }),
    )

    unwrap(await repo.removeWithCascade(grader.id))

    const foundGrader = await repo.findById(grader.id)
    expect(foundGrader.success).toBe(false)

    const foundExperiment = await experimentRepository.findById(experiment.id)
    expect(foundExperiment.success).toBe(false)
  })
})
