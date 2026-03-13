import { describe, it, expect, vi } from 'vitest'
import { datasetRepository } from '../../datasets/repository.js'
import { graderRepository } from '../../graders/repository.js'
import { experimentRepository } from '../../experiments/repository.js'
import { createExperimentService } from '../../experiments/service.js'

const mockRunner = { enqueue: vi.fn().mockResolvedValue(undefined) }
const service = createExperimentService(
  experimentRepository,
  datasetRepository,
  graderRepository,
  mockRunner as any,
)

let counter = 0
function uid(prefix: string) {
  return `${prefix}-${++counter}`
}

async function seedDatasetWithItems() {
  const ds = await datasetRepository.create(uid('exp-svc-ds'))
  await datasetRepository.createItem(ds.id, { input: 'q1', expected_output: 'a1' })
  return ds
}

async function seedGrader() {
  return graderRepository.create({
    name: uid('exp-svc-grader'),
    description: 'test grader',
    rubric: 'award points',
  })
}

describe('experiments service (integration)', () => {
  // 1. createExperiment with non-existent dataset → fail
  it('createExperiment with non-existent dataset returns fail', async () => {
    const grader = await seedGrader()
    const result = await service.createExperiment({
      name: uid('exp-no-ds'),
      datasetId: '00000000-0000-0000-0000-000000000000',
      graderIds: [grader.id],
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('Dataset not found')
  })

  // 2. createExperiment with empty dataset (no items) → fail
  it('createExperiment with empty dataset returns fail', async () => {
    const ds = await datasetRepository.create(uid('exp-empty-ds'))
    const grader = await seedGrader()

    const result = await service.createExperiment({
      name: uid('exp-empty'),
      datasetId: ds.id,
      graderIds: [grader.id],
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('Dataset has no items')
  })

  // 3. createExperiment with non-existent grader → fail
  it('createExperiment with non-existent grader returns fail', async () => {
    const ds = await seedDatasetWithItems()

    const result = await service.createExperiment({
      name: uid('exp-no-grader'),
      datasetId: ds.id,
      graderIds: ['00000000-0000-0000-0000-000000000000'],
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('Grader not found')
  })

  // 4. createExperiment success → experiment + junction rows in DB
  it('createExperiment success creates experiment with junction rows in DB', async () => {
    const ds = await seedDatasetWithItems()
    const grader1 = await seedGrader()
    const grader2 = await seedGrader()

    const result = await service.createExperiment({
      name: uid('exp-success'),
      datasetId: ds.id,
      graderIds: [grader1.id, grader2.id],
    })

    expect(result.success).toBe(true)
    if (!result.success) return

    const found = await experimentRepository.findById(result.data.id)
    expect(found).not.toBeNull()
    expect(found!.datasetId).toBe(ds.id)
    expect(found!.graders).toHaveLength(2)
    const graderIds = found!.graders.map((g) => g.graderId).sort()
    expect(graderIds).toEqual([grader1.id, grader2.id].sort())
  })

  // 5. rerunExperiment creates new experiment → original unchanged in DB
  it('rerunExperiment creates a new experiment and leaves the original unchanged', async () => {
    const ds = await seedDatasetWithItems()
    const grader = await seedGrader()

    const original = await experimentRepository.create({
      name: uid('exp-rerun-orig'),
      datasetId: ds.id,
      graderIds: [grader.id],
    })

    const result = await service.rerunExperiment(original.id)

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.id).not.toBe(original.id)
    expect(result.data.name).toContain('re-run')

    const stillExists = await experimentRepository.findById(original.id)
    expect(stillExists).not.toBeNull()
    expect(stillExists!.status).toBe('queued')
  })

  // 6. deleteExperiment → experiment gone, dataset/grader still in DB
  it('deleteExperiment removes the experiment but leaves dataset and grader intact', async () => {
    const ds = await seedDatasetWithItems()
    const grader = await seedGrader()

    const experiment = await experimentRepository.create({
      name: uid('exp-delete'),
      datasetId: ds.id,
      graderIds: [grader.id],
    })

    const result = await service.deleteExperiment(experiment.id)

    expect(result.success).toBe(true)

    const expFound = await experimentRepository.findById(experiment.id)
    expect(expFound).toBeNull()

    const dsFound = await datasetRepository.findById(ds.id)
    expect(dsFound).not.toBeNull()

    const graderFound = await graderRepository.findById(grader.id)
    expect(graderFound).not.toBeNull()
  })
})
