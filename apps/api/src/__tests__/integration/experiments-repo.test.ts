import { describe, it, expect } from 'vitest'
import { experimentRepository as repo } from '../../experiments/repository.js'
import { datasetRepository } from '../../datasets/repository.js'
import { graderRepository } from '../../graders/repository.js'

let seedCounter = 0

async function seedData() {
  const n = ++seedCounter
  const dataset = await datasetRepository.create(`exp-repo-dataset-${n}`)
  await datasetRepository.createItem(dataset.id, { input: 'q1', expected_output: 'a1' })
  await datasetRepository.createItem(dataset.id, { input: 'q2', expected_output: 'a2' })

  // Get the latest revision
  const revisions = await datasetRepository.findRevisions(dataset.id)
  const latestRevision = revisions[0]

  // Get items from the latest revision (they have the revision-specific .id we need)
  const latestData = await datasetRepository.findById(dataset.id)
  const revisionItems = latestData!.items

  const grader1 = await graderRepository.create({ name: `exp-repo-grader-1-${n}`, description: 'desc', rubric: 'rubric1' })
  const grader2 = await graderRepository.create({ name: `exp-repo-grader-2-${n}`, description: 'desc', rubric: 'rubric2' })
  return { dataset, latestRevision, revisionItems, grader1, grader2 }
}

describe('experiments repository (integration)', () => {
  it('create with graderIds and revisionId → junction rows', async () => {
    const { dataset, latestRevision, grader1, grader2 } = await seedData()

    const experiment = await repo.create({
      name: 'exp-junction',
      datasetId: dataset.id,
      datasetRevisionId: latestRevision.id,
      graderIds: [grader1.id, grader2.id],
    })

    expect(experiment.datasetRevisionId).toBe(latestRevision.id)
    const found = await repo.findById(experiment.id)
    expect(found).not.toBeNull()
    expect(found!.graders).toHaveLength(2)
  })

  it('findById includes revision.items + graders.grader', async () => {
    const { dataset, latestRevision, revisionItems, grader1 } = await seedData()

    const experiment = await repo.create({
      name: 'exp-includes',
      datasetId: dataset.id,
      datasetRevisionId: latestRevision.id,
      graderIds: [grader1.id],
    })

    const found = await repo.findById(experiment.id)
    expect(found).not.toBeNull()
    expect(found!.revision.items).toHaveLength(2)
    const itemIds = found!.revision.items.map((i: { id: string }) => i.id).sort()
    const expectedIds = revisionItems.map((i: { id: string }) => i.id).sort()
    expect(itemIds).toEqual(expectedIds)
    expect(found!.graders[0].grader.rubric).toBe('rubric1')
  })

  it('findAll includes dataset name + _count.results', async () => {
    const { dataset, latestRevision, grader1 } = await seedData()

    await repo.create({
      name: 'exp-findall',
      datasetId: dataset.id,
      datasetRevisionId: latestRevision.id,
      graderIds: [grader1.id],
    })

    const all = await repo.findAll()
    const entry = all.find((e) => e.name === 'exp-findall')
    expect(entry).toBeDefined()
    expect(entry!.dataset.name).toBe(dataset.name)
    expect(entry!._count.results).toBe(0)
  })

  it('updateStatus transition', async () => {
    const { dataset, latestRevision, grader1 } = await seedData()

    const experiment = await repo.create({
      name: 'exp-status',
      datasetId: dataset.id,
      datasetRevisionId: latestRevision.id,
      graderIds: [grader1.id],
    })

    expect(experiment.status).toBe('queued')
    await repo.updateStatus(experiment.id, 'running')
    const found = await repo.findById(experiment.id)
    expect(found!.status).toBe('running')
  })

  it('createResult → findResultsByExperimentId', async () => {
    const { dataset, latestRevision, revisionItems, grader1 } = await seedData()

    const experiment = await repo.create({
      name: 'exp-result',
      datasetId: dataset.id,
      datasetRevisionId: latestRevision.id,
      graderIds: [grader1.id],
    })

    await repo.createResult({
      experimentId: experiment.id,
      datasetRevisionItemId: revisionItems[0].id,
      graderId: grader1.id,
      verdict: 'pass',
      reason: 'looks good',
    })

    const results = await repo.findResultsByExperimentId(experiment.id)
    expect(results).toHaveLength(1)
    expect(results[0].verdict).toBe('pass')
  })

  it('countResultsByExperimentId accuracy', async () => {
    const { dataset, latestRevision, revisionItems, grader1, grader2 } = await seedData()

    const experiment = await repo.create({
      name: 'exp-count',
      datasetId: dataset.id,
      datasetRevisionId: latestRevision.id,
      graderIds: [grader1.id, grader2.id],
    })

    await repo.createResult({ experimentId: experiment.id, datasetRevisionItemId: revisionItems[0].id, graderId: grader1.id, verdict: 'pass', reason: 'r1' })
    await repo.createResult({ experimentId: experiment.id, datasetRevisionItemId: revisionItems[0].id, graderId: grader2.id, verdict: 'fail', reason: 'r2' })
    await repo.createResult({ experimentId: experiment.id, datasetRevisionItemId: revisionItems[1].id, graderId: grader1.id, verdict: 'pass', reason: 'r3' })

    const count = await repo.countResultsByExperimentId(experiment.id)
    expect(count).toBe(3)
  })

  it('findResultsWithDetails includes revision item + grader', async () => {
    const { dataset, latestRevision, revisionItems, grader1 } = await seedData()

    const experiment = await repo.create({
      name: 'exp-details',
      datasetId: dataset.id,
      datasetRevisionId: latestRevision.id,
      graderIds: [grader1.id],
    })

    // Find the item with q1 values (order is UUID-sorted, not insertion order)
    const q1Item = revisionItems.find((i) => (i.values as Record<string, string>).input === 'q1')!

    await repo.createResult({
      experimentId: experiment.id,
      datasetRevisionItemId: q1Item.id,
      graderId: grader1.id,
      verdict: 'pass',
      reason: 'detailed',
    })

    const results = await repo.findResultsWithDetails(experiment.id)
    expect(results).toHaveLength(1)
    expect(results[0].datasetRevisionItem.values).toMatchObject({ input: 'q1', expected_output: 'a1' })
    expect(results[0].grader.name).toBe(grader1.name)
  })

  it('duplicate createResult raises error (unique constraint)', async () => {
    const { dataset, latestRevision, revisionItems, grader1 } = await seedData()

    const experiment = await repo.create({
      name: 'exp-duplicate',
      datasetId: dataset.id,
      datasetRevisionId: latestRevision.id,
      graderIds: [grader1.id],
    })

    await repo.createResult({ experimentId: experiment.id, datasetRevisionItemId: revisionItems[0].id, graderId: grader1.id, verdict: 'pass', reason: 'first' })

    await expect(
      repo.createResult({ experimentId: experiment.id, datasetRevisionItemId: revisionItems[0].id, graderId: grader1.id, verdict: 'fail', reason: 'duplicate' })
    ).rejects.toThrow()
  })

  it('remove cascades junction + results', async () => {
    const { dataset, latestRevision, revisionItems, grader1 } = await seedData()

    const experiment = await repo.create({
      name: 'exp-remove',
      datasetId: dataset.id,
      datasetRevisionId: latestRevision.id,
      graderIds: [grader1.id],
    })

    await repo.createResult({ experimentId: experiment.id, datasetRevisionItemId: revisionItems[0].id, graderId: grader1.id, verdict: 'pass', reason: 'before remove' })

    await repo.remove(experiment.id)
    const found = await repo.findById(experiment.id)
    expect(found).toBeNull()
    const results = await repo.findResultsByExperimentId(experiment.id)
    expect(results).toHaveLength(0)
  })

  // B17 — shared revision
  it('two experiments without intervening edits share the same revisionId', async () => {
    const { dataset, latestRevision, grader1 } = await seedData()

    const expA = await repo.create({ name: 'exp-shared-a', datasetId: dataset.id, datasetRevisionId: latestRevision.id, graderIds: [grader1.id] })
    const expB = await repo.create({ name: 'exp-shared-b', datasetId: dataset.id, datasetRevisionId: latestRevision.id, graderIds: [grader1.id] })

    expect(expA.datasetRevisionId).toBe(expB.datasetRevisionId)
  })
})
