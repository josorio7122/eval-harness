import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ok } from '@eval-harness/shared'
import { createExperimentRunner, experimentEvents } from '../runner.js'

type ExperimentEvent = Record<string, unknown>

const mockRepo = {
  updateStatus: vi.fn(),
  createResult: vi.fn(),
  createOutput: vi.fn(),
}

const mockEvaluate = vi.fn()
const mockGenerate = vi.fn()

const promptVersion = {
  systemPrompt: 'You are helpful.',
  userPrompt: 'Answer: {input}',
  modelId: 'test/model',
  modelParams: {},
}

beforeEach(() => {
  vi.resetAllMocks()
  mockRepo.updateStatus.mockResolvedValue(ok({}))
  mockRepo.createResult.mockResolvedValue(ok({}))
  mockRepo.createOutput.mockResolvedValue(ok({ id: 'out-1' }))
  mockGenerate.mockResolvedValue({ output: 'generated answer', error: null })
})

const datasetItems = [
  { id: 'item-1', values: { input: 'hello', expected_output: 'world' } },
  { id: 'item-2', values: { input: 'foo', expected_output: 'bar' } },
]

const graders = [
  { id: 'grader-1', rubric: 'Grade accuracy' },
  { id: 'grader-2', rubric: 'Grade tone' },
]

describe('createExperimentRunner', () => {
  it('sets status to running then complete on success', async () => {
    mockEvaluate.mockResolvedValue({ verdict: 'pass', reason: 'ok' })
    const runner = createExperimentRunner(mockRepo, mockEvaluate, mockGenerate)

    await runner.enqueue({
      experimentId: 'exp-1',
      datasetItems,
      graders,
      modelId: 'openai/gpt-4o',
      promptVersion,
    })

    const statusCalls = mockRepo.updateStatus.mock.calls.map((c) => c[1])
    expect(statusCalls[0]).toBe('running')
    expect(statusCalls).toContain('complete')
  })

  it('creates a result for every (item, grader) cell', async () => {
    mockEvaluate.mockResolvedValue({ verdict: 'pass', reason: 'ok' })
    const runner = createExperimentRunner(mockRepo, mockEvaluate, mockGenerate)

    await runner.enqueue({
      experimentId: 'exp-1',
      datasetItems,
      graders,
      modelId: 'openai/gpt-4o',
      promptVersion,
    })

    // 2 items × 2 graders = 4 results
    expect(mockRepo.createResult).toHaveBeenCalledTimes(4)
  })

  it('creates results with correct shape', async () => {
    mockEvaluate.mockResolvedValue({ verdict: 'pass', reason: 'great' })
    const runner = createExperimentRunner(mockRepo, mockEvaluate, mockGenerate)

    await runner.enqueue({
      experimentId: 'exp-1',
      datasetItems,
      graders,
      modelId: 'openai/gpt-4o',
      promptVersion,
    })

    const calls = mockRepo.createResult.mock.calls.map((c) => c[0])
    const firstCall = calls.find(
      (c) => c.datasetRevisionItemId === 'item-1' && c.graderId === 'grader-1',
    )
    expect(firstCall).toMatchObject({
      experimentId: 'exp-1',
      datasetRevisionItemId: 'item-1',
      graderId: 'grader-1',
      verdict: 'pass',
      reason: 'great',
    })
  })

  it('emits progress events for each grading cell', async () => {
    mockEvaluate.mockResolvedValue({ verdict: 'pass', reason: 'ok' })
    mockRepo.createResult.mockResolvedValue(
      ok({
        id: 'result-1',
        datasetRevisionItemId: 'item-1',
        graderId: 'grader-1',
        verdict: 'pass',
        reason: 'ok',
      }),
    )
    const runner = createExperimentRunner(mockRepo, mockEvaluate, mockGenerate)

    const events: ExperimentEvent[] = []
    experimentEvents.on('exp-2', (e) => events.push(e))

    await runner.enqueue({
      experimentId: 'exp-2',
      datasetItems,
      graders,
      modelId: 'openai/gpt-4o',
      promptVersion,
    })

    experimentEvents.off('exp-2', (e) => events.push(e))

    const progressEvents = events.filter((e) => e.type === 'progress')
    // 2 items × 2 graders = 4 grading progress events
    expect(progressEvents.length).toBe(4)

    const lastProgress = progressEvents[progressEvents.length - 1]
    expect(lastProgress.cellsCompleted).toBe(4)
    expect(lastProgress.totalCells).toBe(4)

    // Each grading progress event must include the saved result
    progressEvents.forEach((evt) => {
      expect(evt.result).toBeDefined()
      expect(evt.result).toMatchObject({
        id: expect.any(String),
        datasetRevisionItemId: expect.any(String),
        graderId: expect.any(String),
        verdict: expect.any(String),
        reason: expect.any(String),
      })
    })
  })

  it('emits completed event with status complete when all pass', async () => {
    mockEvaluate.mockResolvedValue({ verdict: 'pass', reason: 'ok' })
    const runner = createExperimentRunner(mockRepo, mockEvaluate, mockGenerate)

    const events: ExperimentEvent[] = []
    experimentEvents.on('exp-3', (e) => events.push(e))

    await runner.enqueue({
      experimentId: 'exp-3',
      datasetItems,
      graders,
      modelId: 'openai/gpt-4o',
      promptVersion,
    })

    experimentEvents.off('exp-3', (e) => events.push(e))

    const completed = events.find((e) => e.type === 'completed')
    expect(completed).toBeDefined()
    expect(completed!.status).toBe('complete')
    expect(mockRepo.updateStatus).toHaveBeenCalledWith('exp-3', 'complete')
  })

  it('sets status to failed when all cells error', async () => {
    mockEvaluate.mockRejectedValue(new Error('LLM down'))
    const runner = createExperimentRunner(mockRepo, mockEvaluate, mockGenerate)

    await runner.enqueue({
      experimentId: 'exp-4',
      datasetItems,
      graders,
      modelId: 'openai/gpt-4o',
      promptVersion,
    })

    const statusCalls = mockRepo.updateStatus.mock.calls.map((c) => c[1])
    expect(statusCalls[statusCalls.length - 1]).toBe('failed')

    const resultCalls = mockRepo.createResult.mock.calls.map((c) => c[0])
    resultCalls.forEach((r) => {
      expect(r.verdict).toBe('error')
      expect(r.reason).toBe('LLM down')
    })
  })

  it('stores partial errors and still completes when only some cells fail', async () => {
    let callCount = 0
    mockEvaluate.mockImplementation(async () => {
      callCount++
      if (callCount === 1) throw new Error('partial error')
      return { verdict: 'pass', reason: 'ok' }
    })

    const runner = createExperimentRunner(mockRepo, mockEvaluate, mockGenerate)
    await runner.enqueue({
      experimentId: 'exp-5',
      datasetItems,
      graders,
      modelId: 'openai/gpt-4o',
      promptVersion,
    })

    const statusCalls = mockRepo.updateStatus.mock.calls.map((c) => c[1])
    expect(statusCalls[statusCalls.length - 1]).toBe('complete')
  })

  it('emits error event when all cells fail', async () => {
    mockEvaluate.mockRejectedValue(new Error('LLM down'))
    const runner = createExperimentRunner(mockRepo, mockEvaluate, mockGenerate)

    const events: ExperimentEvent[] = []
    experimentEvents.on('exp-6', (e) => events.push(e))

    await runner.enqueue({
      experimentId: 'exp-6',
      datasetItems,
      graders,
      modelId: 'openai/gpt-4o',
      promptVersion,
    })

    experimentEvents.off('exp-6', (e) => events.push(e))

    const errorEvent = events.find((e) => e.type === 'error')
    expect(errorEvent).toBeDefined()
    expect(errorEvent!.error).toBe('All evaluations failed')
  })

  it('does not emit error event when only partial failures occur', async () => {
    let callCount = 0
    mockEvaluate.mockImplementation(async () => {
      callCount++
      if (callCount === 1) throw new Error('partial error')
      return { verdict: 'pass', reason: 'ok' }
    })
    const runner = createExperimentRunner(mockRepo, mockEvaluate, mockGenerate)

    const events: ExperimentEvent[] = []
    experimentEvents.on('exp-7', (e) => events.push(e))

    await runner.enqueue({
      experimentId: 'exp-7',
      datasetItems,
      graders,
      modelId: 'openai/gpt-4o',
      promptVersion,
    })

    experimentEvents.off('exp-7', (e) => events.push(e))

    const errorEvent = events.find((e) => e.type === 'error')
    expect(errorEvent).toBeUndefined()
  })

  it('does not emit connected event from runner (router handles it)', async () => {
    mockEvaluate.mockResolvedValue({ verdict: 'pass', reason: 'ok' })
    const runner = createExperimentRunner(mockRepo, mockEvaluate, mockGenerate)

    const events: ExperimentEvent[] = []
    experimentEvents.on('exp-8', (e) => events.push(e))

    await runner.enqueue({
      experimentId: 'exp-8',
      datasetItems,
      graders,
      modelId: 'openai/gpt-4o',
      promptVersion,
    })

    experimentEvents.off('exp-8', (e) => events.push(e))

    const connectedEvent = events.find((e) => e.type === 'connected')
    expect(connectedEvent).toBeUndefined()
  })

  it('passes modelId to the evaluate function', async () => {
    mockEvaluate.mockResolvedValue({ verdict: 'pass', reason: 'ok' })
    const runner = createExperimentRunner(mockRepo, mockEvaluate, mockGenerate)

    await runner.enqueue({
      experimentId: 'exp-9',
      datasetItems,
      graders,
      modelId: 'anthropic/claude-opus-4',
      promptVersion,
    })

    const calls = mockEvaluate.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    calls.forEach((call) => {
      expect(call[0].modelId).toBe('anthropic/claude-opus-4')
    })
  })

  it('grading starts as soon as an item generation completes (pipeline)', async () => {
    // Each item's grading should start immediately after its generation, not waiting for all
    // items to finish generating. We verify by checking interleaved ordering.
    const order: string[] = []

    // Make generation slow for item-1 so item-2 generates and grades before item-1 grading
    mockGenerate.mockImplementation(async ({ input }: { input: string }) => {
      if (input === 'hello') {
        await new Promise((r) => setTimeout(r, 20))
      }
      order.push(`generate:${input}`)
      return { output: `response for ${input}`, error: null }
    })

    mockEvaluate.mockImplementation(
      async ({ itemAttributes }: { itemAttributes: Record<string, string> }) => {
        order.push(`evaluate:${itemAttributes['input']}`)
        return { verdict: 'pass', reason: 'ok' }
      },
    )

    const runner = createExperimentRunner(mockRepo, mockEvaluate, mockGenerate)
    await runner.enqueue({
      experimentId: 'exp-10',
      datasetItems,
      graders,
      modelId: 'openai/gpt-4o',
      promptVersion,
    })

    // item-2 (foo) should generate and start grading before item-1 (hello) finishes
    const fooGenerateIdx = order.indexOf('generate:foo')
    const fooEvaluateIdx = order.indexOf('evaluate:foo')
    const helloGenerateIdx = order.indexOf('generate:hello')

    // foo should be generated before hello (since hello has delay)
    expect(fooGenerateIdx).toBeLessThan(helloGenerateIdx)
    // foo evaluation should start before hello generation completes
    expect(fooEvaluateIdx).toBeLessThan(helloGenerateIdx)
  })

  it('generation failure for one item writes error cells immediately, others continue', async () => {
    mockGenerate.mockImplementation(async ({ input }: { input: string }) => {
      if (input === 'hello') return { output: '', error: 'generation failed' }
      return { output: 'generated answer', error: null }
    })
    mockEvaluate.mockResolvedValue({ verdict: 'pass', reason: 'ok' })

    const runner = createExperimentRunner(mockRepo, mockEvaluate, mockGenerate)
    await runner.enqueue({
      experimentId: 'exp-11',
      datasetItems,
      graders,
      modelId: 'openai/gpt-4o',
      promptVersion,
    })

    const resultCalls = mockRepo.createResult.mock.calls.map((c) => c[0])
    // item-1 (input: 'hello') should have error results for both graders
    const item1Results = resultCalls.filter((r) => r.datasetRevisionItemId === 'item-1')
    expect(item1Results).toHaveLength(2)
    item1Results.forEach((r) => {
      expect(r.verdict).toBe('error')
      expect(r.reason).toBe('generation failed')
    })

    // item-2 should have pass results
    const item2Results = resultCalls.filter((r) => r.datasetRevisionItemId === 'item-2')
    expect(item2Results).toHaveLength(2)
    item2Results.forEach((r) => {
      expect(r.verdict).toBe('pass')
    })
  })

  it('total generation failure → experiment status is failed', async () => {
    mockGenerate.mockResolvedValue({ output: '', error: 'all generation failed' })

    const runner = createExperimentRunner(mockRepo, mockEvaluate, mockGenerate)
    await runner.enqueue({
      experimentId: 'exp-12',
      datasetItems,
      graders,
      modelId: 'openai/gpt-4o',
      promptVersion,
    })

    const statusCalls = mockRepo.updateStatus.mock.calls.map((c) => c[1])
    expect(statusCalls[statusCalls.length - 1]).toBe('failed')

    // evaluate should never be called
    expect(mockEvaluate).not.toHaveBeenCalled()
  })

  it('grading receives generated output in evaluate call', async () => {
    mockGenerate.mockImplementation(async ({ input }: { input: string }) => ({
      output: `response for ${input}`,
      error: null,
    }))
    mockEvaluate.mockResolvedValue({ verdict: 'pass', reason: 'ok' })

    const runner = createExperimentRunner(mockRepo, mockEvaluate, mockGenerate)
    await runner.enqueue({
      experimentId: 'exp-13',
      datasetItems,
      graders,
      modelId: 'openai/gpt-4o',
      promptVersion,
    })

    const evaluateCalls = mockEvaluate.mock.calls.map((c) => c[0])
    // item-1 has input: 'hello', so output should be 'response for hello'
    const item1Calls = evaluateCalls.filter((c) => c.itemAttributes.input === 'hello')
    expect(item1Calls.length).toBeGreaterThan(0)
    item1Calls.forEach((call) => {
      expect(call.output).toBe('response for hello')
    })
  })

  it('stores ExperimentOutput records during generation', async () => {
    mockEvaluate.mockResolvedValue({ verdict: 'pass', reason: 'ok' })

    const runner = createExperimentRunner(mockRepo, mockEvaluate, mockGenerate)
    await runner.enqueue({
      experimentId: 'exp-14',
      datasetItems,
      graders,
      modelId: 'openai/gpt-4o',
      promptVersion,
    })

    // createOutput called once per item (2 items)
    expect(mockRepo.createOutput).toHaveBeenCalledTimes(2)

    const outputCalls = mockRepo.createOutput.mock.calls.map((c) => c[0])
    outputCalls.forEach((call) => {
      expect(call.experimentId).toBe('exp-14')
      expect(call.output).toBe('generated answer')
      expect(call.error).toBeNull()
    })

    // Verify item IDs
    const itemIds = outputCalls.map((c) => c.datasetRevisionItemId).sort()
    expect(itemIds).toEqual(['item-1', 'item-2'])
  })
})
