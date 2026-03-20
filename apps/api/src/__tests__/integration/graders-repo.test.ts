import { describe, it, expect, beforeEach } from 'vitest'

const MODEL_ID = 'openai/gpt-4o'
import { graderRepository as repo } from '../../graders/repository.js'
import { datasetRepository } from '../../datasets/repository.js'
import { experimentRepository } from '../../experiments/repository.js'
import { createPromptRepository } from '../../prompts/repository.js'
import { prisma } from '../../lib/prisma.js'
import { unwrap } from './helpers.js'

const promptRepository = createPromptRepository(prisma)

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

  // 2. findAll returns only non-deleted graders
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

  // 4. remove (soft delete) — findById returns fail, record has deletedAt set
  it('remove soft-deletes the grader so findById returns fail', async () => {
    const created = unwrap(
      await repo.create({
        name: 'delete-me-grader',
        description: 'To be removed',
        rubric: 'Does not matter',
      }),
    )

    unwrap(await repo.remove(created.id))
    const result = await repo.findById(created.id)

    expect(result.success).toBe(false)
  })

  // 5. soft-deleted grader not returned by findAll
  it('soft-deleted grader does not appear in findAll', async () => {
    const grader = unwrap(
      await repo.create({
        name: 'invisible-grader',
        description: 'Will be soft-deleted',
        rubric: 'Not visible after delete',
      }),
    )

    unwrap(await repo.remove(grader.id))

    const all = unwrap(await repo.findAll())
    const ids = all.map((g) => g.id)
    expect(ids).not.toContain(grader.id)
  })

  // 6. soft-deleted grader name can be reused (findByName returns null)
  it('findByName returns null for a soft-deleted grader', async () => {
    const grader = unwrap(
      await repo.create({
        name: 'reusable-name-grader',
        description: 'Will be soft-deleted',
        rubric: 'Rubric',
      }),
    )

    unwrap(await repo.remove(grader.id))

    const found = await repo.findByName('reusable-name-grader')
    expect(found).toBeNull()
  })

  // 7. soft-deleted grader name can be reused to create a new grader
  it('can create a new grader with the same name after soft-delete', async () => {
    const original = unwrap(
      await repo.create({
        name: 'reused-grader-name',
        description: 'Original',
        rubric: 'Original rubric',
      }),
    )

    unwrap(await repo.remove(original.id))

    const reused = unwrap(
      await repo.create({
        name: 'reused-grader-name',
        description: 'New grader with same name',
        rubric: 'New rubric',
      }),
    )

    expect(reused.id).not.toBe(original.id)
    expect(reused.name).toBe('reused-grader-name')
  })

  // 8. soft-deleting a grader does NOT delete experiments referencing it
  it('soft-deleting grader does not delete experiments referencing it', async () => {
    const dataset = unwrap(await datasetRepository.create('grader-soft-del-dataset'))
    unwrap(await datasetRepository.createItem(dataset.id, { input: 'q1', expected_output: 'a1' }))
    const revisions = unwrap(await datasetRepository.findRevisions(dataset.id))
    const revision = revisions[0]

    const grader = unwrap(
      await repo.create({
        name: 'soft-del-grader',
        description: 'Will be soft-deleted',
        rubric: 'Does not matter',
      }),
    )

    const prompt = unwrap(
      await promptRepository.create({
        name: `grader-soft-del-prompt-${Date.now()}`,
        systemPrompt: 'You are a helpful assistant.',
        userPrompt: 'Answer: {input}',
        modelId: MODEL_ID,
      }),
    )

    const experiment = unwrap(
      await experimentRepository.create({
        name: 'grader-soft-del-experiment',
        datasetId: dataset.id,
        datasetRevisionId: revision.id,
        graderIds: [grader.id],
        modelId: MODEL_ID,
        promptVersionId: prompt.versions[0].id,
      }),
    )

    unwrap(await repo.remove(grader.id))

    const foundGrader = await repo.findById(grader.id)
    expect(foundGrader.success).toBe(false)

    // Experiment still exists
    const foundExperiment = await experimentRepository.findById(experiment.id)
    expect(foundExperiment.success).toBe(true)
  })
})
