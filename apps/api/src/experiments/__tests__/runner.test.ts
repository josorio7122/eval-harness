import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createExperimentRunner, experimentEvents } from '../runner.js'

const mockRepo = {
  updateStatus: vi.fn(),
  createResult: vi.fn(),
}

const mockEvaluate = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  mockRepo.updateStatus.mockResolvedValue({})
  mockRepo.createResult.mockResolvedValue({})
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
    const runner = createExperimentRunner(mockRepo, mockEvaluate)

    await runner.enqueue('exp-1', datasetItems, graders)

    const statusCalls = mockRepo.updateStatus.mock.calls.map((c) => c[1])
    expect(statusCalls[0]).toBe('running')
    expect(statusCalls).toContain('complete')
  })

  it('creates a result for every (item, grader) cell', async () => {
    mockEvaluate.mockResolvedValue({ verdict: 'pass', reason: 'ok' })
    const runner = createExperimentRunner(mockRepo, mockEvaluate)

    await runner.enqueue('exp-1', datasetItems, graders)

    // 2 items × 2 graders = 4 results
    expect(mockRepo.createResult).toHaveBeenCalledTimes(4)
  })

  it('creates results with correct shape', async () => {
    mockEvaluate.mockResolvedValue({ verdict: 'pass', reason: 'great' })
    const runner = createExperimentRunner(mockRepo, mockEvaluate)

    await runner.enqueue('exp-1', datasetItems, graders)

    const calls = mockRepo.createResult.mock.calls.map((c) => c[0])
    const firstCall = calls.find((c) => c.datasetRevisionItemId === 'item-1' && c.graderId === 'grader-1')
    expect(firstCall).toMatchObject({
      experimentId: 'exp-1',
      datasetRevisionItemId: 'item-1',
      graderId: 'grader-1',
      verdict: 'pass',
      reason: 'great',
    })
  })

  it('emits progress events for each cell', async () => {
    mockEvaluate.mockResolvedValue({ verdict: 'pass', reason: 'ok' })
    mockRepo.createResult.mockResolvedValue({
      id: 'result-1',
      datasetRevisionItemId: 'item-1',
      graderId: 'grader-1',
      verdict: 'pass',
      reason: 'ok',
    })
    const runner = createExperimentRunner(mockRepo, mockEvaluate)

    const events: any[] = []
    experimentEvents.on('exp-2', (e) => events.push(e))

    await runner.enqueue('exp-2', datasetItems, graders)

    experimentEvents.off('exp-2', (e) => events.push(e))

    const progressEvents = events.filter((e) => e.type === 'progress')
    expect(progressEvents.length).toBe(4)
    expect(progressEvents[progressEvents.length - 1].cellsCompleted).toBe(4)
    expect(progressEvents[progressEvents.length - 1].totalCells).toBe(4)

    // Each progress event must include the saved result
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
    const runner = createExperimentRunner(mockRepo, mockEvaluate)

    const events: any[] = []
    experimentEvents.on('exp-3', (e) => events.push(e))

    await runner.enqueue('exp-3', datasetItems, graders)

    experimentEvents.off('exp-3', (e) => events.push(e))

    const completed = events.find((e) => e.type === 'completed')
    expect(completed).toBeDefined()
    expect(completed.status).toBe('complete')
    expect(mockRepo.updateStatus).toHaveBeenCalledWith('exp-3', 'complete')
  })

  it('sets status to failed when all cells error', async () => {
    mockEvaluate.mockRejectedValue(new Error('LLM down'))
    const runner = createExperimentRunner(mockRepo, mockEvaluate)

    await runner.enqueue('exp-4', datasetItems, graders)

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

    const runner = createExperimentRunner(mockRepo, mockEvaluate)
    await runner.enqueue('exp-5', datasetItems, graders)

    const statusCalls = mockRepo.updateStatus.mock.calls.map((c) => c[1])
    expect(statusCalls[statusCalls.length - 1]).toBe('complete')
  })

  it('emits error event when all cells fail', async () => {
    mockEvaluate.mockRejectedValue(new Error('LLM down'))
    const runner = createExperimentRunner(mockRepo, mockEvaluate)

    const events: any[] = []
    experimentEvents.on('exp-6', (e) => events.push(e))

    await runner.enqueue('exp-6', datasetItems, graders)

    experimentEvents.off('exp-6', (e) => events.push(e))

    const errorEvent = events.find((e) => e.type === 'error')
    expect(errorEvent).toBeDefined()
    expect(errorEvent.error).toBe('All evaluations failed')
  })

  it('does not emit error event when only partial failures occur', async () => {
    let callCount = 0
    mockEvaluate.mockImplementation(async () => {
      callCount++
      if (callCount === 1) throw new Error('partial error')
      return { verdict: 'pass', reason: 'ok' }
    })
    const runner = createExperimentRunner(mockRepo, mockEvaluate)

    const events: any[] = []
    experimentEvents.on('exp-7', (e) => events.push(e))

    await runner.enqueue('exp-7', datasetItems, graders)

    experimentEvents.off('exp-7', (e) => events.push(e))

    const errorEvent = events.find((e) => e.type === 'error')
    expect(errorEvent).toBeUndefined()
  })

  it('does not emit connected event from runner (router handles it)', async () => {
    mockEvaluate.mockResolvedValue({ verdict: 'pass', reason: 'ok' })
    const runner = createExperimentRunner(mockRepo, mockEvaluate)

    const events: any[] = []
    experimentEvents.on('exp-8', (e) => events.push(e))

    await runner.enqueue('exp-8', datasetItems, graders)

    experimentEvents.off('exp-8', (e) => events.push(e))

    const connectedEvent = events.find((e) => e.type === 'connected')
    expect(connectedEvent).toBeUndefined()
  })
})
