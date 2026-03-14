import { describe, it, expect, vi, beforeEach } from 'vitest'
import { type Result, DEFAULT_MODEL_ID } from '@eval-harness/shared'
import { experimentRepository } from '../../experiments/repository.js'
import { datasetRepository } from '../../datasets/repository.js'
import { graderRepository } from '../../graders/repository.js'
import { createExperimentRunner } from '../../experiments/runner.js'

/** Extract data from Result, fail test if not successful */
function unwrap<T>(result: Result<T>): T {
  expect(result.success).toBe(true)
  if (!result.success) throw new Error(result.error)
  return result.data
}

type EvaluateFn = Parameters<typeof createExperimentRunner>[1]

let seedCounter = 0

async function seedExperiment(itemCount: number, graderCount: number) {
  const n = ++seedCounter
  const dataset = unwrap(await datasetRepository.create(`runner-dataset-${n}`))

  for (let i = 1; i <= itemCount; i++) {
    unwrap(
      await datasetRepository.createItem(dataset.id, {
        input: `question-${i}`,
        expected_output: `answer-${i}`,
      }),
    )
  }

  // Get items from the latest revision
  const latestData = unwrap(await datasetRepository.findById(dataset.id))
  const items = latestData.items.map((item) => ({
    id: item.id,
    values: item.values as Record<string, string>,
  }))

  // Get revision ID
  const revisions = unwrap(await datasetRepository.findRevisions(dataset.id))
  const revisionId = revisions[0].id

  const graders: Array<{ id: string; rubric: string }> = []
  for (let i = 1; i <= graderCount; i++) {
    const grader = unwrap(
      await graderRepository.create({
        name: `runner-grader-${n}-${i}`,
        description: 'test grader',
        rubric: `rubric-${i}`,
      }),
    )
    graders.push({ id: grader.id, rubric: grader.rubric })
  }

  const graderIds = graders.map((g) => g.id)
  const experiment = unwrap(
    await experimentRepository.create({
      name: `runner-exp-${n}`,
      datasetId: dataset.id,
      datasetRevisionId: revisionId,
      graderIds,
      modelId: DEFAULT_MODEL_ID,
    }),
  )
  unwrap(await experimentRepository.updateStatus(experiment.id, 'running'))

  return { experiment, items, graders }
}

describe('experiment runner (integration)', () => {
  let mockEvaluateFn: ReturnType<typeof vi.fn>
  let mockEvaluate: EvaluateFn
  let runner: ReturnType<typeof createExperimentRunner>

  beforeEach(() => {
    mockEvaluateFn = vi.fn()
    mockEvaluateFn.mockResolvedValue({ verdict: 'pass', reason: 'correct' })
    mockEvaluate = mockEvaluateFn as unknown as EvaluateFn
    runner = createExperimentRunner(experimentRepository, mockEvaluate)
  })

  it('full run: 3 items × 2 graders → 6 results in DB, status = complete', async () => {
    const { experiment, items, graders } = await seedExperiment(3, 2)

    await runner.enqueue(experiment.id, items, graders)

    const count = unwrap(await experimentRepository.countResultsByExperimentId(experiment.id))
    expect(count).toBe(6)

    const results = unwrap(await experimentRepository.findResultsByExperimentId(experiment.id))
    expect(results.every((r) => r.verdict === 'pass')).toBe(true)

    const found = unwrap(await experimentRepository.findById(experiment.id))
    expect(found.status).toBe('complete')
  })

  it('each result has correct verdict from mock (fail)', async () => {
    mockEvaluateFn.mockResolvedValue({ verdict: 'fail', reason: 'wrong answer' })
    runner = createExperimentRunner(experimentRepository, mockEvaluate)

    const { experiment, items, graders } = await seedExperiment(2, 2)

    await runner.enqueue(experiment.id, items, graders)

    const results = unwrap(await experimentRepository.findResultsByExperimentId(experiment.id))
    expect(results).toHaveLength(4)
    expect(results.every((r) => r.verdict === 'fail')).toBe(true)
    expect(results.every((r) => r.reason === 'wrong answer')).toBe(true)
  })

  it('final status = complete when all evaluations succeed', async () => {
    const { experiment, items, graders } = await seedExperiment(2, 1)

    await runner.enqueue(experiment.id, items, graders)

    const found = unwrap(await experimentRepository.findById(experiment.id))
    expect(found.status).toBe('complete')
  })

  it('all-fail run → status = failed, all results have verdict = error', async () => {
    mockEvaluateFn.mockRejectedValue(new Error('API error'))
    runner = createExperimentRunner(experimentRepository, mockEvaluate)

    const { experiment, items, graders } = await seedExperiment(2, 2)

    await runner.enqueue(experiment.id, items, graders)

    const results = unwrap(await experimentRepository.findResultsByExperimentId(experiment.id))
    expect(results).toHaveLength(4)
    expect(results.every((r) => r.verdict === 'error')).toBe(true)

    const found = unwrap(await experimentRepository.findById(experiment.id))
    expect(found.status).toBe('failed')
  })

  it('all-fail run → emits error event but NOT completed event', async () => {
    mockEvaluateFn.mockRejectedValue(new Error('API error'))
    runner = createExperimentRunner(experimentRepository, mockEvaluate)

    const { experiment, items, graders } = await seedExperiment(2, 1)

    const emittedTypes: string[] = []
    const { experimentEvents } = await import('../../experiments/runner.js')
    const listener = (event: { type: string }) => emittedTypes.push(event.type)
    experimentEvents.on(experiment.id, listener)

    await runner.enqueue(experiment.id, items, graders)

    experimentEvents.off(experiment.id, listener)

    expect(emittedTypes).toContain('error')
    expect(emittedTypes).not.toContain('completed')
  })

  it('successful run → emits completed event but NOT error event', async () => {
    mockEvaluateFn.mockResolvedValue({ verdict: 'pass', reason: 'ok' })
    runner = createExperimentRunner(experimentRepository, mockEvaluate)

    const { experiment, items, graders } = await seedExperiment(2, 1)

    const emittedTypes: string[] = []
    const { experimentEvents } = await import('../../experiments/runner.js')
    const listener = (event: { type: string }) => emittedTypes.push(event.type)
    experimentEvents.on(experiment.id, listener)

    await runner.enqueue(experiment.id, items, graders)

    experimentEvents.off(experiment.id, listener)

    expect(emittedTypes).toContain('completed')
    expect(emittedTypes).not.toContain('error')
  })

  it('partial failure → status = complete with mixed verdicts', async () => {
    let callCount = 0
    mockEvaluateFn.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.reject(new Error('first call fails'))
      }
      return Promise.resolve({ verdict: 'pass', reason: 'ok' })
    })
    runner = createExperimentRunner(experimentRepository, mockEvaluate)

    const { experiment, items, graders } = await seedExperiment(2, 2)

    await runner.enqueue(experiment.id, items, graders)

    const results = unwrap(await experimentRepository.findResultsByExperimentId(experiment.id))
    expect(results).toHaveLength(4)

    const errorResults = results.filter((r) => r.verdict === 'error')
    const passResults = results.filter((r) => r.verdict === 'pass')
    expect(errorResults).toHaveLength(1)
    expect(passResults).toHaveLength(3)

    const found = unwrap(await experimentRepository.findById(experiment.id))
    expect(found.status).toBe('complete')
  })

  it('unique constraint respected: result count equals exactly items × graders', async () => {
    const { experiment, items, graders } = await seedExperiment(3, 3)

    await runner.enqueue(experiment.id, items, graders)

    const count = unwrap(await experimentRepository.countResultsByExperimentId(experiment.id))
    expect(count).toBe(items.length * graders.length)
    expect(count).toBe(9)
  })
})
