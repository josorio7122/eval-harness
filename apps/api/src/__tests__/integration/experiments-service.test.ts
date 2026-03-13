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
  mockRunner as ReturnType<typeof import('../../experiments/runner.js').createExperimentRunner>,
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

  it('createExperiment success creates experiment with datasetRevisionId', async () => {
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

    // Verify datasetRevisionId is set
    const found = await experimentRepository.findById(result.data.id)
    expect(found).not.toBeNull()
    expect(found!.datasetRevisionId).toBeDefined()
    expect(found!.datasetId).toBe(ds.id)
    expect(found!.graders).toHaveLength(2)

    // Verify it points to the latest revision
    const revisions = await datasetRepository.findRevisions(ds.id)
    expect(found!.datasetRevisionId).toBe(revisions[0].id)
  })

  it('rerunExperiment creates a new experiment referencing latest revision', async () => {
    const ds = await seedDatasetWithItems()
    const grader = await seedGrader()

    // Get revision for direct create
    const revisions = await datasetRepository.findRevisions(ds.id)
    const original = await experimentRepository.create({
      name: uid('exp-rerun-orig'),
      datasetId: ds.id,
      datasetRevisionId: revisions[0].id,
      graderIds: [grader.id],
    })

    const result = await service.rerunExperiment(original.id)

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.id).not.toBe(original.id)
    expect(result.data.name).toContain('re-run')

    const stillExists = await experimentRepository.findById(original.id)
    expect(stillExists).not.toBeNull()
  })

  it('deleteExperiment removes the experiment but leaves dataset and grader intact', async () => {
    const ds = await seedDatasetWithItems()
    const grader = await seedGrader()

    const revisions = await datasetRepository.findRevisions(ds.id)
    const experiment = await experimentRepository.create({
      name: uid('exp-delete'),
      datasetId: ds.id,
      datasetRevisionId: revisions[0].id,
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

  // B17 via service: two experiments on unchanged dataset share revision
  it('two experiments on unchanged dataset share the same revision', async () => {
    const ds = await seedDatasetWithItems()
    const grader = await seedGrader()

    const resultA = await service.createExperiment({
      name: uid('exp-shared-a'),
      datasetId: ds.id,
      graderIds: [grader.id],
    })
    const resultB = await service.createExperiment({
      name: uid('exp-shared-b'),
      datasetId: ds.id,
      graderIds: [grader.id],
    })

    expect(resultA.success).toBe(true)
    expect(resultB.success).toBe(true)
    if (!resultA.success || !resultB.success) return

    const expA = await experimentRepository.findById(resultA.data.id)
    const expB = await experimentRepository.findById(resultB.data.id)
    expect(expA!.datasetRevisionId).toBe(expB!.datasetRevisionId)
  })

  // B18 strengthen: verify first experiment's revisionId unchanged after dataset edit
  it('experiment revisionId unchanged after dataset edit', async () => {
    const ds = await seedDatasetWithItems()
    const grader = await seedGrader()

    const resultA = await service.createExperiment({
      name: uid('exp-pinned'),
      datasetId: ds.id,
      graderIds: [grader.id],
    })
    expect(resultA.success).toBe(true)
    if (!resultA.success) return

    const originalRevId = (await experimentRepository.findById(resultA.data.id))!.datasetRevisionId

    // Edit dataset (creates new revision)
    await datasetRepository.createItem(ds.id, { input: 'new-q', expected_output: 'new-a' })

    // Verify experiment still points to original revision
    const afterEdit = await experimentRepository.findById(resultA.data.id)
    expect(afterEdit!.datasetRevisionId).toBe(originalRevId)
  })

  // B18 — different revisions after edit
  it('experiments created before and after edit have different revisions', async () => {
    const ds = await seedDatasetWithItems()
    const grader = await seedGrader()

    const resultA = await service.createExperiment({
      name: uid('exp-before-edit'),
      datasetId: ds.id,
      graderIds: [grader.id],
    })
    expect(resultA.success).toBe(true)
    if (!resultA.success) return

    // Edit dataset (creates new revision)
    await datasetRepository.createItem(ds.id, { input: 'new-q', expected_output: 'new-a' })

    const resultB = await service.createExperiment({
      name: uid('exp-after-edit'),
      datasetId: ds.id,
      graderIds: [grader.id],
    })
    expect(resultB.success).toBe(true)
    if (!resultB.success) return

    const expA = await experimentRepository.findById(resultA.data.id)
    const expB = await experimentRepository.findById(resultB.data.id)
    expect(expA!.datasetRevisionId).not.toBe(expB!.datasetRevisionId)
  })
})
