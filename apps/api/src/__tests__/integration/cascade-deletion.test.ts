import { describe, it, expect } from 'vitest'
import { datasetRepository as datasetRepo } from '../../datasets/repository.js'
import { graderRepository as graderRepo } from '../../graders/repository.js'
import { experimentRepository as experimentRepo } from '../../experiments/repository.js'
import { prisma } from '../../lib/prisma.js'

let counter = 0

// Each test gets unique names to avoid unique-constraint collisions across tests
function uid() {
  return `cd-${Date.now()}-${++counter}`
}

async function seedFullScenario() {
  const id = uid()

  // 1. Create dataset with one item
  const dataset = await datasetRepo.create(`cascade-dataset-${id}`)
  await datasetRepo.createItem(dataset.id, { input: 'hello', expected_output: 'world' })

  // 2. Get the latest revision (after item was added)
  const revisions = await datasetRepo.findRevisions(dataset.id)
  const latestRevision = revisions[0]

  // 3. Get the revision item ID (the DatasetRevisionItem.id, not itemId)
  const revisionDetail = await datasetRepo.findRevisionById(dataset.id, latestRevision.id)
  const revisionItemId = revisionDetail!.items[0].id

  // 4. Create grader
  const grader = await graderRepo.create({
    name: `cascade-grader-${id}`,
    description: 'Grader for cascade tests',
    rubric: 'Grade this item',
  })

  // 5. Create experiment
  const experiment = await experimentRepo.create({
    name: `cascade-experiment-${id}`,
    datasetId: dataset.id,
    datasetRevisionId: latestRevision.id,
    graderIds: [grader.id],
  })

  // 6. Create experiment result
  const result = await experimentRepo.createResult({
    experimentId: experiment.id,
    datasetRevisionItemId: revisionItemId,
    graderId: grader.id,
    verdict: 'pass',
    reason: 'Looks good',
  })

  return { dataset, grader, experiment, result, revisionItemId, latestRevision }
}

describe('DatasetDelete cascade', () => {
  it('deleting a dataset removes its experiments and their results', async () => {
    const { dataset, grader, experiment } = await seedFullScenario()

    await datasetRepo.remove(dataset.id)

    // dataset is gone
    const foundDataset = await datasetRepo.findById(dataset.id)
    expect(foundDataset).toBeNull()

    // experiment is gone
    const foundExperiment = await experimentRepo.findById(experiment.id)
    expect(foundExperiment).toBeNull()

    // results are gone
    const resultCount = await prisma.experimentResult.count({
      where: { experimentId: experiment.id },
    })
    expect(resultCount).toBe(0)

    // grader is unaffected
    const foundGrader = await graderRepo.findById(grader.id)
    expect(foundGrader).not.toBeNull()
    expect(foundGrader!.id).toBe(grader.id)
  })

  it('deleting a dataset removes all revisions and revision items', async () => {
    const { dataset, latestRevision } = await seedFullScenario()

    // Verify revisions exist before delete
    const revisionsBefore = await datasetRepo.findRevisions(dataset.id)
    expect(revisionsBefore.length).toBeGreaterThan(0)

    await datasetRepo.remove(dataset.id)

    // revisions are gone
    const revisionsAfter = await prisma.datasetRevision.count({
      where: { datasetId: dataset.id },
    })
    expect(revisionsAfter).toBe(0)

    // revision items are gone
    const itemCount = await prisma.datasetRevisionItem.count({
      where: { revisionId: latestRevision.id },
    })
    expect(itemCount).toBe(0)
  })
})

describe('GraderDelete cascade', () => {
  it('removeWithCascade deletes grader, experiments, and their results', async () => {
    const { dataset, grader, experiment } = await seedFullScenario()

    await graderRepo.removeWithCascade(grader.id)

    // grader is gone
    const foundGrader = await graderRepo.findById(grader.id)
    expect(foundGrader).toBeNull()

    // experiment is gone
    const foundExperiment = await experimentRepo.findById(experiment.id)
    expect(foundExperiment).toBeNull()

    // results are gone
    const resultCount = await prisma.experimentResult.count({
      where: { experimentId: experiment.id },
    })
    expect(resultCount).toBe(0)

    // dataset is unaffected
    const foundDataset = await datasetRepo.findById(dataset.id)
    expect(foundDataset).not.toBeNull()
    expect(foundDataset!.id).toBe(dataset.id)
  })


})

describe('ExperimentDelete isolation', () => {
  it('deleting an experiment removes results but leaves dataset and grader intact', async () => {
    const { dataset, grader, experiment } = await seedFullScenario()

    await experimentRepo.remove(experiment.id)

    // experiment is gone
    const foundExperiment = await experimentRepo.findById(experiment.id)
    expect(foundExperiment).toBeNull()

    // results are gone
    const resultCount = await prisma.experimentResult.count({
      where: { experimentId: experiment.id },
    })
    expect(resultCount).toBe(0)

    // dataset still exists with its items
    const foundDataset = await datasetRepo.findById(dataset.id)
    expect(foundDataset).not.toBeNull()
    expect(foundDataset!.items).toHaveLength(1)

    // grader still exists
    const foundGrader = await graderRepo.findById(grader.id)
    expect(foundGrader).not.toBeNull()
    expect(foundGrader!.id).toBe(grader.id)
  })
})

describe('GraderDelete with multiple experiments', () => {
  it('removeWithCascade deletes all experiments referencing the grader', async () => {
    const id = uid()

    // Create dataset
    const dataset = await datasetRepo.create(`multi-exp-dataset-${id}`)
    await datasetRepo.createItem(dataset.id, { input: 'q', expected_output: 'a' })
    const revisions = await datasetRepo.findRevisions(dataset.id)
    const latestRevision = revisions[0]
    const revisionDetail = await datasetRepo.findRevisionById(dataset.id, latestRevision.id)
    const revisionItemId = revisionDetail!.items[0].id

    // Create grader
    const grader = await graderRepo.create({
      name: `shared-grader-${id}`,
      description: 'Used by multiple experiments',
      rubric: 'Multi-exp rubric',
    })

    // Create two experiments using the same grader
    const expA = await experimentRepo.create({
      name: `multi-exp-a-${id}`,
      datasetId: dataset.id,
      datasetRevisionId: latestRevision.id,
      graderIds: [grader.id],
    })
    const expB = await experimentRepo.create({
      name: `multi-exp-b-${id}`,
      datasetId: dataset.id,
      datasetRevisionId: latestRevision.id,
      graderIds: [grader.id],
    })

    // Create a result for each experiment
    await experimentRepo.createResult({
      experimentId: expA.id,
      datasetRevisionItemId: revisionItemId,
      graderId: grader.id,
      verdict: 'pass',
      reason: 'result A',
    })
    await experimentRepo.createResult({
      experimentId: expB.id,
      datasetRevisionItemId: revisionItemId,
      graderId: grader.id,
      verdict: 'fail',
      reason: 'result B',
    })

    // Delete grader with cascade
    await graderRepo.removeWithCascade(grader.id)

    // Both experiments are gone
    const foundExpA = await experimentRepo.findById(expA.id)
    expect(foundExpA).toBeNull()

    const foundExpB = await experimentRepo.findById(expB.id)
    expect(foundExpB).toBeNull()

    // Both results are gone
    const resultCountA = await prisma.experimentResult.count({
      where: { experimentId: expA.id },
    })
    expect(resultCountA).toBe(0)

    const resultCountB = await prisma.experimentResult.count({
      where: { experimentId: expB.id },
    })
    expect(resultCountB).toBe(0)

    // Dataset still exists
    const foundDataset = await datasetRepo.findById(dataset.id)
    expect(foundDataset).not.toBeNull()
    expect(foundDataset!.id).toBe(dataset.id)
  })
})
