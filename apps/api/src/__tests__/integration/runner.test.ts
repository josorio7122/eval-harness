import { describe, it, expect, vi, beforeEach } from 'vitest'

const MODEL_ID = 'openai/gpt-4o'
import { experimentRepository } from '../../experiments/repository.js'
import { datasetRepository } from '../../datasets/repository.js'
import { graderRepository } from '../../graders/repository.js'
import { createPromptRepository } from '../../prompts/repository.js'
import { createExperimentRunner } from '../../experiments/runner.js'
import { prisma } from '../../lib/prisma.js'
import { unwrap } from './helpers.js'

const promptRepository = createPromptRepository(prisma)

type EvaluateFn = Parameters<typeof createExperimentRunner>[1]
type GenerateFn = Parameters<typeof createExperimentRunner>[2]

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

  const prompt = unwrap(
    await promptRepository.create({
      name: `runner-prompt-${n}`,
      systemPrompt: 'You are a helpful assistant.',
      userPrompt: 'Answer: {input}',
      modelId: MODEL_ID,
    }),
  )

  const experiment = unwrap(
    await experimentRepository.create({
      name: `runner-exp-${n}`,
      datasetId: dataset.id,
      datasetRevisionId: revisionId,
      graderIds,
      modelId: MODEL_ID,
      promptVersionId: prompt.versions[0].id,
    }),
  )
  unwrap(await experimentRepository.updateStatus(experiment.id, 'running'))

  return {
    experiment,
    items,
    graders,
    promptVersion: {
      systemPrompt: 'You are a helpful assistant.',
      userPrompt: 'Answer: {input}',
      modelId: MODEL_ID,
      modelParams: {} as Record<string, unknown>,
    },
  }
}

describe('experiment runner (integration)', () => {
  let mockEvaluate: EvaluateFn
  let mockGenerate: GenerateFn
  let runner: ReturnType<typeof createExperimentRunner>

  beforeEach(() => {
    mockEvaluate = vi.fn<EvaluateFn>()
    mockGenerate = vi.fn<GenerateFn>()
    vi.mocked(mockEvaluate).mockResolvedValue({ verdict: 'pass', reason: 'correct' })
    vi.mocked(mockGenerate).mockResolvedValue({ output: 'generated output', error: null })
    runner = createExperimentRunner(experimentRepository, mockEvaluate, mockGenerate)
  })

  it('full run: 3 items × 2 graders → 6 results in DB, status = complete', async () => {
    const { experiment, items, graders, promptVersion } = await seedExperiment(3, 2)

    await runner.enqueue({
      experimentId: experiment.id,
      datasetItems: items,
      graders,
      modelId: MODEL_ID,
      promptVersion,
    })

    const count = unwrap(await experimentRepository.countResultsByExperimentId(experiment.id))
    expect(count).toBe(6)

    const results = unwrap(await experimentRepository.findResultsByExperimentId(experiment.id))
    expect(results.every((r) => r.verdict === 'pass')).toBe(true)

    const found = unwrap(await experimentRepository.findById(experiment.id))
    expect(found.status).toBe('complete')
  })

  it('each result has correct verdict from mock (fail)', async () => {
    vi.mocked(mockEvaluate).mockResolvedValue({ verdict: 'fail', reason: 'wrong answer' })
    runner = createExperimentRunner(experimentRepository, mockEvaluate, mockGenerate)

    const { experiment, items, graders, promptVersion } = await seedExperiment(2, 2)

    await runner.enqueue({
      experimentId: experiment.id,
      datasetItems: items,
      graders,
      modelId: MODEL_ID,
      promptVersion,
    })

    const results = unwrap(await experimentRepository.findResultsByExperimentId(experiment.id))
    expect(results).toHaveLength(4)
    expect(results.every((r) => r.verdict === 'fail')).toBe(true)
    expect(results.every((r) => r.reason === 'wrong answer')).toBe(true)
  })

  it('final status = complete when all evaluations succeed', async () => {
    const { experiment, items, graders, promptVersion } = await seedExperiment(2, 1)

    await runner.enqueue({
      experimentId: experiment.id,
      datasetItems: items,
      graders,
      modelId: MODEL_ID,
      promptVersion,
    })

    const found = unwrap(await experimentRepository.findById(experiment.id))
    expect(found.status).toBe('complete')
  })

  it('all-fail run → status = failed, all results have verdict = error', async () => {
    vi.mocked(mockEvaluate).mockRejectedValue(new Error('API error'))
    runner = createExperimentRunner(experimentRepository, mockEvaluate, mockGenerate)

    const { experiment, items, graders, promptVersion } = await seedExperiment(2, 2)

    await runner.enqueue({
      experimentId: experiment.id,
      datasetItems: items,
      graders,
      modelId: MODEL_ID,
      promptVersion,
    })

    const results = unwrap(await experimentRepository.findResultsByExperimentId(experiment.id))
    expect(results).toHaveLength(4)
    expect(results.every((r) => r.verdict === 'error')).toBe(true)

    const found = unwrap(await experimentRepository.findById(experiment.id))
    expect(found.status).toBe('failed')
  })

  it('all-fail run → emits error event but NOT completed event', async () => {
    vi.mocked(mockEvaluate).mockRejectedValue(new Error('API error'))
    runner = createExperimentRunner(experimentRepository, mockEvaluate, mockGenerate)

    const { experiment, items, graders, promptVersion } = await seedExperiment(2, 1)

    const emittedTypes: string[] = []
    const { experimentEvents } = await import('../../experiments/runner.js')
    const listener = (event: { type: string }) => emittedTypes.push(event.type)
    experimentEvents.on(experiment.id, listener)

    await runner.enqueue({
      experimentId: experiment.id,
      datasetItems: items,
      graders,
      modelId: MODEL_ID,
      promptVersion,
    })

    experimentEvents.off(experiment.id, listener)

    expect(emittedTypes).toContain('error')
    expect(emittedTypes).not.toContain('completed')
  })

  it('successful run → emits completed event but NOT error event', async () => {
    vi.mocked(mockEvaluate).mockResolvedValue({ verdict: 'pass', reason: 'ok' })
    runner = createExperimentRunner(experimentRepository, mockEvaluate, mockGenerate)

    const { experiment, items, graders, promptVersion } = await seedExperiment(2, 1)

    const emittedTypes: string[] = []
    const { experimentEvents } = await import('../../experiments/runner.js')
    const listener = (event: { type: string }) => emittedTypes.push(event.type)
    experimentEvents.on(experiment.id, listener)

    await runner.enqueue({
      experimentId: experiment.id,
      datasetItems: items,
      graders,
      modelId: MODEL_ID,
      promptVersion,
    })

    experimentEvents.off(experiment.id, listener)

    expect(emittedTypes).toContain('completed')
    expect(emittedTypes).not.toContain('error')
  })

  it('partial failure → status = complete with mixed verdicts', async () => {
    let callCount = 0
    vi.mocked(mockEvaluate).mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.reject(new Error('first call fails'))
      }
      return Promise.resolve({ verdict: 'pass', reason: 'ok' })
    })
    runner = createExperimentRunner(experimentRepository, mockEvaluate, mockGenerate)

    const { experiment, items, graders, promptVersion } = await seedExperiment(2, 2)

    await runner.enqueue({
      experimentId: experiment.id,
      datasetItems: items,
      graders,
      modelId: MODEL_ID,
      promptVersion,
    })

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
    const { experiment, items, graders, promptVersion } = await seedExperiment(3, 3)

    await runner.enqueue({
      experimentId: experiment.id,
      datasetItems: items,
      graders,
      modelId: MODEL_ID,
      promptVersion,
    })

    const count = unwrap(await experimentRepository.countResultsByExperimentId(experiment.id))
    expect(count).toBe(items.length * graders.length)
    expect(count).toBe(9)
  })

  it('stores ExperimentOutput records during Phase 1', async () => {
    const { experiment, items, graders, promptVersion } = await seedExperiment(3, 2)

    await runner.enqueue({
      experimentId: experiment.id,
      datasetItems: items,
      graders,
      modelId: MODEL_ID,
      promptVersion,
    })

    const outputs = unwrap(await experimentRepository.findOutputsByExperimentId(experiment.id))
    // One output per item (3 items)
    expect(outputs).toHaveLength(3)
    outputs.forEach((o) => {
      expect(o.output).toBe('generated output')
      expect(o.error).toBeNull()
    })
  })

  it('Phase 1 failure creates error grading cells for that item', async () => {
    let generateCallCount = 0
    vi.mocked(mockGenerate).mockImplementation(async () => {
      generateCallCount++
      // Fail the first item only
      if (generateCallCount === 1) {
        return { output: '', error: 'generation failed' }
      }
      return { output: 'ok output', error: null }
    })
    runner = createExperimentRunner(experimentRepository, mockEvaluate, mockGenerate)

    const { experiment, items, graders, promptVersion } = await seedExperiment(2, 2)

    await runner.enqueue({
      experimentId: experiment.id,
      datasetItems: items,
      graders,
      modelId: MODEL_ID,
      promptVersion,
    })

    const results = unwrap(await experimentRepository.findResultsByExperimentId(experiment.id))
    expect(results).toHaveLength(4)

    // First item gets error cells
    const errorResults = results.filter((r) => r.verdict === 'error')
    expect(errorResults).toHaveLength(2) // 2 graders × 1 failed item

    // Second item gets pass cells
    const passResults = results.filter((r) => r.verdict === 'pass')
    expect(passResults).toHaveLength(2)

    // Status is still complete (partial generation failure)
    const found = unwrap(await experimentRepository.findById(experiment.id))
    expect(found.status).toBe('complete')
  })
})
