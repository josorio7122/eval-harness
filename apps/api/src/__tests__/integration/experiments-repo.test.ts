import { describe, it, expect } from 'vitest'
import { experimentRepository as repo } from '../../experiments/repository.js'
import { datasetRepository } from '../../datasets/repository.js'
import { graderRepository } from '../../graders/repository.js'

let seedCounter = 0

async function seedData() {
  const n = ++seedCounter
  const dataset = await datasetRepository.create(`exp-repo-dataset-${n}`)
  const item1 = await datasetRepository.createItem(dataset.id, { input: 'q1', expected_output: 'a1' })
  const item2 = await datasetRepository.createItem(dataset.id, { input: 'q2', expected_output: 'a2' })
  const grader1 = await graderRepository.create({ name: `exp-repo-grader-1-${n}`, description: 'desc', rubric: 'rubric1' })
  const grader2 = await graderRepository.create({ name: `exp-repo-grader-2-${n}`, description: 'desc', rubric: 'rubric2' })
  return { dataset, item1, item2, grader1, grader2 }
}

describe('experiments repository (integration)', () => {
  it('create with graderIds → junction rows', async () => {
    const { dataset, grader1, grader2 } = await seedData()

    const experiment = await repo.create({
      name: 'exp-junction',
      datasetId: dataset.id,
      graderIds: [grader1.id, grader2.id],
    })

    const found = await repo.findById(experiment.id)
    expect(found).not.toBeNull()
    expect(found!.graders).toHaveLength(2)
    const graderIds = found!.graders.map((g) => g.graderId).sort()
    expect(graderIds).toEqual([grader1.id, grader2.id].sort())
  })

  it('findById includes dataset.items + graders.grader', async () => {
    const { dataset, item1, item2, grader1 } = await seedData()

    const experiment = await repo.create({
      name: 'exp-includes',
      datasetId: dataset.id,
      graderIds: [grader1.id],
    })

    const found = await repo.findById(experiment.id)
    expect(found).not.toBeNull()
    expect(found!.dataset.items).toHaveLength(2)
    const itemIds = found!.dataset.items.map((i) => i.id).sort()
    expect(itemIds).toEqual([item1.id, item2.id].sort())
    expect(found!.graders[0].grader.rubric).toBe('rubric1')
  })

  it('findAll includes dataset name + _count.results', async () => {
    const { dataset, grader1 } = await seedData()

    await repo.create({
      name: 'exp-findall',
      datasetId: dataset.id,
      graderIds: [grader1.id],
    })

    const all = await repo.findAll()
    const entry = all.find((e) => e.name === 'exp-findall')
    expect(entry).toBeDefined()
    expect(entry!.dataset.name).toBe(dataset.name)
    expect(entry!._count.results).toBe(0)
  })

  it('updateStatus transition', async () => {
    const { dataset, grader1 } = await seedData()

    const experiment = await repo.create({
      name: 'exp-status',
      datasetId: dataset.id,
      graderIds: [grader1.id],
    })

    expect(experiment.status).toBe('queued')

    await repo.updateStatus(experiment.id, 'running')

    const found = await repo.findById(experiment.id)
    expect(found!.status).toBe('running')
  })

  it('createResult → findResultsByExperimentId', async () => {
    const { dataset, item1, grader1 } = await seedData()

    const experiment = await repo.create({
      name: 'exp-result',
      datasetId: dataset.id,
      graderIds: [grader1.id],
    })

    await repo.createResult({
      experimentId: experiment.id,
      datasetItemId: item1.id,
      graderId: grader1.id,
      verdict: 'pass',
      reason: 'looks good',
    })

    const results = await repo.findResultsByExperimentId(experiment.id)
    expect(results).toHaveLength(1)
    expect(results[0].verdict).toBe('pass')
    expect(results[0].reason).toBe('looks good')
  })

  it('countResultsByExperimentId accuracy', async () => {
    const { dataset, item1, item2, grader1, grader2 } = await seedData()

    const experiment = await repo.create({
      name: 'exp-count',
      datasetId: dataset.id,
      graderIds: [grader1.id, grader2.id],
    })

    await repo.createResult({
      experimentId: experiment.id,
      datasetItemId: item1.id,
      graderId: grader1.id,
      verdict: 'pass',
      reason: 'r1',
    })
    await repo.createResult({
      experimentId: experiment.id,
      datasetItemId: item1.id,
      graderId: grader2.id,
      verdict: 'fail',
      reason: 'r2',
    })
    await repo.createResult({
      experimentId: experiment.id,
      datasetItemId: item2.id,
      graderId: grader1.id,
      verdict: 'pass',
      reason: 'r3',
    })

    const count = await repo.countResultsByExperimentId(experiment.id)
    expect(count).toBe(3)
  })

  it('findResultsWithDetails includes item + grader', async () => {
    const { dataset, item1, grader1 } = await seedData()

    const experiment = await repo.create({
      name: 'exp-details',
      datasetId: dataset.id,
      graderIds: [grader1.id],
    })

    await repo.createResult({
      experimentId: experiment.id,
      datasetItemId: item1.id,
      graderId: grader1.id,
      verdict: 'pass',
      reason: 'detailed',
    })

    const results = await repo.findResultsWithDetails(experiment.id)
    expect(results).toHaveLength(1)
    expect(results[0].datasetItem.values).toMatchObject({ input: 'q1', expected_output: 'a1' })
    expect(results[0].grader.name).toBe(grader1.name)
  })

  it('duplicate createResult raises error (unique constraint)', async () => {
    const { dataset, item1, grader1 } = await seedData()

    const experiment = await repo.create({
      name: 'exp-duplicate',
      datasetId: dataset.id,
      graderIds: [grader1.id],
    })

    await repo.createResult({
      experimentId: experiment.id,
      datasetItemId: item1.id,
      graderId: grader1.id,
      verdict: 'pass',
      reason: 'first',
    })

    await expect(
      repo.createResult({
        experimentId: experiment.id,
        datasetItemId: item1.id,
        graderId: grader1.id,
        verdict: 'fail',
        reason: 'duplicate',
      })
    ).rejects.toThrow()
  })

  it('remove cascades junction + results', async () => {
    const { dataset, item1, grader1 } = await seedData()

    const experiment = await repo.create({
      name: 'exp-remove',
      datasetId: dataset.id,
      graderIds: [grader1.id],
    })

    await repo.createResult({
      experimentId: experiment.id,
      datasetItemId: item1.id,
      graderId: grader1.id,
      verdict: 'pass',
      reason: 'before remove',
    })

    await repo.remove(experiment.id)

    const found = await repo.findById(experiment.id)
    expect(found).toBeNull()

    const results = await repo.findResultsByExperimentId(experiment.id)
    expect(results).toHaveLength(0)
  })
})
