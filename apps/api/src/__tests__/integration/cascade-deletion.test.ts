import { describe, it, expect } from 'vitest'

const MODEL_ID = 'openai/gpt-4o'
import { datasetRepository as datasetRepo } from '../../datasets/repository.js'
import { graderRepository as graderRepo } from '../../graders/repository.js'
import { experimentRepository as experimentRepo } from '../../experiments/repository.js'
import { createPromptRepository } from '../../prompts/repository.js'
import { prisma } from '../../lib/prisma.js'
import { unwrap, uid } from './helpers.js'

const promptRepo = createPromptRepository(prisma)

async function seedFullScenario() {
  const id = uid('cd')

  // 1. Create dataset with one item
  const dataset = unwrap(await datasetRepo.create(`cascade-dataset-${id}`))
  unwrap(await datasetRepo.createItem(dataset.id, { input: 'hello', expected_output: 'world' }))

  // 2. Get the latest revision (after item was added)
  const revisions = unwrap(await datasetRepo.findRevisions(dataset.id))
  const latestRevision = revisions[0]

  // 3. Get the revision item ID (the DatasetRevisionItem.id, not itemId)
  const revisionDetail = unwrap(await datasetRepo.findRevisionById(dataset.id, latestRevision.id))
  const revisionItemId = revisionDetail.items[0].id

  // 4. Create grader
  const grader = unwrap(
    await graderRepo.create({
      name: `cascade-grader-${id}`,
      description: 'Grader for cascade tests',
      rubric: 'Grade this item',
    }),
  )

  // 5. Create prompt
  const prompt = unwrap(
    await promptRepo.create({
      name: `cascade-prompt-${id}`,
      systemPrompt: 'You are a helpful assistant.',
      userPrompt: 'Answer: {input}',
      modelId: MODEL_ID,
    }),
  )
  const promptVersionId = prompt.versions[0].id

  // 6. Create experiment
  const experiment = unwrap(
    await experimentRepo.create({
      name: `cascade-experiment-${id}`,
      datasetId: dataset.id,
      datasetRevisionId: latestRevision.id,
      graderIds: [grader.id],
      modelId: MODEL_ID,
      promptVersionId,
    }),
  )

  // 7. Create experiment result
  const result = unwrap(
    await experimentRepo.createResult({
      experimentId: experiment.id,
      datasetRevisionItemId: revisionItemId,
      graderId: grader.id,
      verdict: 'pass',
      reason: 'Looks good',
    }),
  )

  return { dataset, grader, experiment, result, revisionItemId, latestRevision }
}

describe('DatasetDelete soft delete', () => {
  it('soft-deleting a dataset makes it invisible via findById', async () => {
    const { dataset, grader } = await seedFullScenario()

    unwrap(await datasetRepo.remove(dataset.id))

    // dataset is invisible via findById
    const foundDataset = await datasetRepo.findById(dataset.id)
    expect(foundDataset.success).toBe(false)

    // grader is unaffected
    const foundGrader = unwrap(await graderRepo.findById(grader.id))
    expect(foundGrader.id).toBe(grader.id)
  })

  it('soft-deleting a dataset sets deletedAt in the DB', async () => {
    const { dataset } = await seedFullScenario()

    unwrap(await datasetRepo.remove(dataset.id))

    const raw = await prisma.dataset.findUnique({ where: { id: dataset.id } })
    expect(raw).not.toBeNull()
    expect(raw!.deletedAt).not.toBeNull()
  })

  it('soft-deleted dataset does not appear in findAll', async () => {
    const { dataset } = await seedFullScenario()

    unwrap(await datasetRepo.remove(dataset.id))

    const all = unwrap(await datasetRepo.findAll())
    const ids = all.map((d) => d.id)
    expect(ids).not.toContain(dataset.id)
  })

  it('soft-deleted dataset name can be reused', async () => {
    const { dataset } = await seedFullScenario()
    const originalName = dataset.name

    unwrap(await datasetRepo.remove(dataset.id))

    const found = await datasetRepo.findByName(originalName)
    expect(found).toBeNull()

    // Can create a new dataset with the same name
    const reused = unwrap(await datasetRepo.create(originalName))
    expect(reused.id).not.toBe(dataset.id)
    expect(reused.name).toBe(originalName)
  })

  it('soft-deleting dataset does NOT delete the experiment in the DB', async () => {
    const { dataset, experiment } = await seedFullScenario()

    unwrap(await datasetRepo.remove(dataset.id))

    // Experiment record still exists in DB (just the dataset is soft-deleted)
    const raw = await prisma.experiment.findUnique({ where: { id: experiment.id } })
    expect(raw).not.toBeNull()
  })
})

describe('GraderDelete soft delete', () => {
  it('soft-deleting a grader makes it invisible via findById', async () => {
    const { grader } = await seedFullScenario()

    unwrap(await graderRepo.remove(grader.id))

    const foundGrader = await graderRepo.findById(grader.id)
    expect(foundGrader.success).toBe(false)
  })

  it('soft-deleting a grader sets deletedAt in the DB', async () => {
    const { grader } = await seedFullScenario()

    unwrap(await graderRepo.remove(grader.id))

    const raw = await prisma.grader.findUnique({ where: { id: grader.id } })
    expect(raw).not.toBeNull()
    expect(raw!.deletedAt).not.toBeNull()
  })

  it('soft-deleted grader does not appear in findAll', async () => {
    const { grader } = await seedFullScenario()

    unwrap(await graderRepo.remove(grader.id))

    const all = unwrap(await graderRepo.findAll())
    const ids = all.map((g) => g.id)
    expect(ids).not.toContain(grader.id)
  })

  it('soft-deleted grader name can be reused', async () => {
    const { grader } = await seedFullScenario()
    const originalName = grader.name

    unwrap(await graderRepo.remove(grader.id))

    const found = await graderRepo.findByName(originalName)
    expect(found).toBeNull()

    const reused = unwrap(
      await graderRepo.create({
        name: originalName,
        description: 'New grader with same name',
        rubric: 'New rubric',
      }),
    )
    expect(reused.id).not.toBe(grader.id)
    expect(reused.name).toBe(originalName)
  })

  it('soft-deleting a grader does NOT delete experiments referencing it', async () => {
    const { grader, experiment, dataset } = await seedFullScenario()

    unwrap(await graderRepo.remove(grader.id))

    // Grader is soft-deleted
    const foundGrader = await graderRepo.findById(grader.id)
    expect(foundGrader.success).toBe(false)

    // Experiment still exists in DB
    const raw = await prisma.experiment.findUnique({ where: { id: experiment.id } })
    expect(raw).not.toBeNull()

    // Dataset still exists
    const foundDataset = unwrap(await datasetRepo.findById(dataset.id))
    expect(foundDataset.id).toBe(dataset.id)
  })
})

describe('ExperimentDelete soft delete', () => {
  it('soft-deleting an experiment makes it invisible via findById', async () => {
    const { experiment } = await seedFullScenario()

    unwrap(await experimentRepo.remove(experiment.id))

    const foundExperiment = await experimentRepo.findById(experiment.id)
    expect(foundExperiment.success).toBe(false)
  })

  it('soft-deleting an experiment sets deletedAt in the DB', async () => {
    const { experiment } = await seedFullScenario()

    unwrap(await experimentRepo.remove(experiment.id))

    const raw = await prisma.experiment.findUnique({ where: { id: experiment.id } })
    expect(raw).not.toBeNull()
    expect(raw!.deletedAt).not.toBeNull()
  })

  it('soft-deleted experiment does not appear in findAll', async () => {
    const { experiment } = await seedFullScenario()

    unwrap(await experimentRepo.remove(experiment.id))

    const all = unwrap(await experimentRepo.findAll())
    const ids = all.map((e) => e.id)
    expect(ids).not.toContain(experiment.id)
  })

  it('deleting an experiment leaves dataset and grader intact', async () => {
    const { dataset, grader, experiment } = await seedFullScenario()

    unwrap(await experimentRepo.remove(experiment.id))

    // experiment is soft-deleted
    const foundExperiment = await experimentRepo.findById(experiment.id)
    expect(foundExperiment.success).toBe(false)

    // dataset still exists with its items
    const foundDataset = unwrap(await datasetRepo.findById(dataset.id))
    expect(foundDataset.items).toHaveLength(1)

    // grader still exists
    const foundGrader = unwrap(await graderRepo.findById(grader.id))
    expect(foundGrader.id).toBe(grader.id)
  })
})
