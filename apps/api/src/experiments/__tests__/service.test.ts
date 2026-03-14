import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ok, fail } from '@eval-harness/shared'

const MODEL_ID = 'openai/gpt-4o'
import { createExperimentService } from '../service.js'

const VALID_UUID = '123e4567-e89b-42d3-a456-426614174000'
const VALID_UUID_2 = '123e4567-e89b-42d3-a456-426614174001'
const VALID_UUID_3 = '123e4567-e89b-42d3-a456-426614174002'

const mockRepo = {
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
  updateStatus: vi.fn(),
  createResult: vi.fn(),
  findResultsByExperimentId: vi.fn(),
  countResultsByExperimentId: vi.fn(),
  findResultsWithDetails: vi.fn(),
}

const mockRunner = {
  enqueue: vi.fn(),
}

const mockDatasetRepo = {
  findAll: vi.fn(),
  findById: vi.fn(),
  findByName: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  addAttribute: vi.fn(),
  removeAttribute: vi.fn(),
  findItemsByDatasetId: vi.fn(),
  findItemById: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  removeItem: vi.fn(),
  countItems: vi.fn(),
  findRevisions: vi.fn(),
  findRevisionById: vi.fn(),
  importItems: vi.fn(),
}

const mockGraderRepo = {
  findAll: vi.fn(),
  findById: vi.fn(),
  findByName: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}

const service = createExperimentService(mockRepo, mockDatasetRepo, mockGraderRepo, mockRunner)

beforeEach(() => {
  vi.resetAllMocks()
})

describe('listExperiments', () => {
  it('returns ok with experiments array', async () => {
    const experiments = [
      {
        id: VALID_UUID,
        name: 'exp1',
        status: 'queued',
        datasetId: VALID_UUID_2,
        graders: [],
        revision: { schemaVersion: 1 },
      },
    ]
    mockRepo.findAll.mockResolvedValue(ok(experiments))
    const result = await service.listExperiments()
    expect(result).toEqual({ success: true, data: experiments })
    if (result.success) {
      expect(result.data[0].revision).toEqual({ schemaVersion: 1 })
    }
  })
})

describe('getExperiment', () => {
  it('returns ok when found', async () => {
    const experiment = {
      id: VALID_UUID,
      name: 'exp1',
      status: 'queued',
      datasetId: VALID_UUID_2,
      graders: [],
      results: [],
    }
    mockRepo.findById.mockResolvedValue(ok(experiment))
    const result = await service.getExperiment(VALID_UUID)
    expect(result).toEqual({ success: true, data: experiment })
  })

  it('returns fail when not found', async () => {
    mockRepo.findById.mockResolvedValue(fail('Experiment not found'))
    const result = await service.getExperiment(VALID_UUID)
    expect(result).toEqual({ success: false, error: 'Experiment not found' })
  })
})

describe('createExperiment', () => {
  it('creates successfully with datasetRevisionId', async () => {
    const dataset = {
      id: VALID_UUID_2,
      name: 'ds1',
      attributes: ['input', 'expected_output'],
      items: [{ id: 'item1' }],
    }
    mockDatasetRepo.findById.mockResolvedValue(ok(dataset))
    mockDatasetRepo.countItems.mockResolvedValue(ok(1))
    mockDatasetRepo.findRevisions.mockResolvedValue(ok([{ id: 'rev-1' }]))
    mockGraderRepo.findById.mockResolvedValue(ok({ id: VALID_UUID_3, name: 'g1' }))
    const created = { id: VALID_UUID, name: 'exp1', status: 'queued', datasetId: VALID_UUID_2 }
    mockRepo.create.mockResolvedValue(ok(created))

    const result = await service.createExperiment({
      name: 'exp1',
      datasetId: VALID_UUID_2,
      graderIds: [VALID_UUID_3],
      modelId: MODEL_ID,
    })
    expect(result).toEqual({ success: true, data: created })
    expect(mockRepo.create).toHaveBeenCalledWith({
      name: 'exp1',
      datasetId: VALID_UUID_2,
      datasetRevisionId: 'rev-1',
      graderIds: [VALID_UUID_3],
      modelId: MODEL_ID,
    })
  })

  it('passes custom modelId to repo.create', async () => {
    const dataset = {
      id: VALID_UUID_2,
      name: 'ds1',
      attributes: ['input', 'expected_output'],
      items: [{ id: 'item1' }],
    }
    mockDatasetRepo.findById.mockResolvedValue(ok(dataset))
    mockDatasetRepo.countItems.mockResolvedValue(ok(1))
    mockDatasetRepo.findRevisions.mockResolvedValue(ok([{ id: 'rev-1' }]))
    mockGraderRepo.findById.mockResolvedValue(ok({ id: VALID_UUID_3, name: 'g1' }))
    const created = { id: VALID_UUID, name: 'exp1', status: 'queued', datasetId: VALID_UUID_2 }
    mockRepo.create.mockResolvedValue(ok(created))

    await service.createExperiment({
      name: 'exp1',
      datasetId: VALID_UUID_2,
      graderIds: [VALID_UUID_3],
      modelId: 'openai/gpt-4o',
    })
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ modelId: 'openai/gpt-4o' }),
    )
  })

  it('fails when dataset not found', async () => {
    mockDatasetRepo.findById.mockResolvedValue(fail('Dataset not found'))
    const result = await service.createExperiment({
      name: 'exp1',
      datasetId: VALID_UUID_2,
      graderIds: [VALID_UUID_3],
      modelId: MODEL_ID,
    })
    expect(result).toEqual({ success: false, error: 'Dataset not found' })
  })

  it('fails when dataset has no items', async () => {
    const dataset = {
      id: VALID_UUID_2,
      name: 'ds1',
      attributes: ['input', 'expected_output'],
      items: [],
    }
    mockDatasetRepo.findById.mockResolvedValue(ok(dataset))
    mockDatasetRepo.countItems.mockResolvedValue(ok(0))
    const result = await service.createExperiment({
      name: 'exp1',
      datasetId: VALID_UUID_2,
      graderIds: [VALID_UUID_3],
      modelId: MODEL_ID,
    })
    expect(result).toEqual({ success: false, error: 'Dataset has no items' })
  })

  it('fails when dataset has no revisions', async () => {
    const dataset = {
      id: VALID_UUID_2,
      name: 'ds1',
      attributes: ['input', 'expected_output'],
      items: [{ id: 'item1' }],
    }
    mockDatasetRepo.findById.mockResolvedValue(ok(dataset))
    mockDatasetRepo.countItems.mockResolvedValue(ok(1))
    mockDatasetRepo.findRevisions.mockResolvedValue(ok([]))
    mockGraderRepo.findById.mockResolvedValue(ok({ id: VALID_UUID_3, name: 'g1' }))
    const result = await service.createExperiment({
      name: 'exp1',
      datasetId: VALID_UUID_2,
      graderIds: [VALID_UUID_3],
      modelId: MODEL_ID,
    })
    expect(result).toEqual({ success: false, error: 'Dataset has no revisions' })
  })

  it('fails when a grader is not found', async () => {
    const dataset = {
      id: VALID_UUID_2,
      name: 'ds1',
      attributes: ['input', 'expected_output'],
      items: [{ id: 'item1' }],
    }
    mockDatasetRepo.findById.mockResolvedValue(ok(dataset))
    mockDatasetRepo.countItems.mockResolvedValue(ok(1))
    mockDatasetRepo.findRevisions.mockResolvedValue(ok([{ id: 'rev-1' }]))
    mockGraderRepo.findById.mockResolvedValue(fail('Grader not found'))
    const result = await service.createExperiment({
      name: 'exp1',
      datasetId: VALID_UUID_2,
      graderIds: [VALID_UUID_3],
      modelId: MODEL_ID,
    })
    expect(result).toEqual({ success: false, error: 'Grader not found' })
  })
})

describe('deleteExperiment', () => {
  it('deletes successfully', async () => {
    mockRepo.remove.mockResolvedValue(ok({ deleted: true as const }))
    const result = await service.deleteExperiment(VALID_UUID)
    expect(result).toEqual({ success: true, data: { deleted: true } })
  })

  it('fails when not found', async () => {
    mockRepo.remove.mockResolvedValue(fail('Experiment not found'))
    const result = await service.deleteExperiment(VALID_UUID)
    expect(result).toEqual({ success: false, error: 'Experiment not found' })
  })
})

describe('rerunExperiment', () => {
  it('creates new experiment with derived name and datasetRevisionId on success', async () => {
    const original = {
      id: VALID_UUID,
      name: 'exp1',
      status: 'done',
      datasetId: VALID_UUID_2,
      modelId: 'google/gemini-2.5-flash',
      graders: [{ graderId: VALID_UUID_3 }],
    }
    mockRepo.findById.mockResolvedValue(ok(original))
    mockDatasetRepo.findRevisions.mockResolvedValue(ok([{ id: 'rev-latest' }]))
    const rerun = {
      id: VALID_UUID_2,
      name: 'exp1 (re-run)',
      status: 'queued',
      datasetId: VALID_UUID_2,
    }
    mockRepo.create.mockResolvedValue(ok(rerun))

    const result = await service.rerunExperiment(VALID_UUID)
    expect(result.success).toBe(true)
    if (result.success) expect((result.data as { name: string }).name).toBe('exp1 (re-run)')
    expect(mockRepo.create).toHaveBeenCalledWith({
      name: 'exp1 (re-run)',
      datasetId: VALID_UUID_2,
      datasetRevisionId: 'rev-latest',
      graderIds: [VALID_UUID_3],
      modelId: 'google/gemini-2.5-flash',
    })
  })

  it('copies modelId from original experiment on rerun', async () => {
    const original = {
      id: VALID_UUID,
      name: 'exp1',
      status: 'done',
      datasetId: VALID_UUID_2,
      modelId: 'anthropic/claude-3-5-sonnet',
      graders: [{ graderId: VALID_UUID_3 }],
    }
    mockRepo.findById.mockResolvedValue(ok(original))
    mockDatasetRepo.findRevisions.mockResolvedValue(ok([{ id: 'rev-latest' }]))
    mockRepo.create.mockResolvedValue(
      ok({ id: VALID_UUID_2, name: 'exp1 (re-run)', status: 'queued', datasetId: VALID_UUID_2 }),
    )

    await service.rerunExperiment(VALID_UUID)
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ modelId: 'anthropic/claude-3-5-sonnet' }),
    )
  })

  it('fails when experiment not found', async () => {
    mockRepo.findById.mockResolvedValue(fail('Experiment not found'))
    const result = await service.rerunExperiment(VALID_UUID)
    expect(result).toEqual({ success: false, error: 'Experiment not found' })
  })

  it('fails when dataset has no revisions', async () => {
    const original = {
      id: VALID_UUID,
      name: 'exp1',
      status: 'done',
      datasetId: VALID_UUID_2,
      modelId: 'google/gemini-2.5-flash',
      graders: [{ graderId: VALID_UUID_3 }],
    }
    mockRepo.findById.mockResolvedValue(ok(original))
    mockDatasetRepo.findRevisions.mockResolvedValue(ok([]))
    const result = await service.rerunExperiment(VALID_UUID)
    expect(result).toEqual({ success: false, error: 'Dataset has no revisions' })
  })
})

describe('runExperiment', () => {
  it('returns ok with status queued when experiment is found and status is queued', async () => {
    const experiment = {
      id: VALID_UUID,
      name: 'exp1',
      status: 'queued',
      modelId: 'google/gemini-2.5-flash',
      datasetId: VALID_UUID_2,
      revision: { items: [{ id: 'item-1', itemId: 'stable-1', values: { input: 'hi' } }] },
      graders: [{ graderId: VALID_UUID_3, grader: { id: VALID_UUID_3, rubric: 'judge it' } }],
      results: [],
    }
    mockRepo.findById.mockResolvedValue(ok(experiment))
    mockRunner.enqueue.mockResolvedValue(undefined)

    const result = await service.runExperiment(VALID_UUID)
    expect(result).toEqual({ success: true, data: { status: 'queued' } })
    expect(mockRunner.enqueue).toHaveBeenCalledWith(
      VALID_UUID,
      [{ id: 'item-1', values: { input: 'hi' } }],
      [{ id: VALID_UUID_3, rubric: 'judge it' }],
      'google/gemini-2.5-flash',
    )
  })

  it('returns fail when experiment not found', async () => {
    mockRepo.findById.mockResolvedValue(fail('Experiment not found'))
    const result = await service.runExperiment(VALID_UUID)
    expect(result).toEqual({ success: false, error: 'Experiment not found' })
    expect(mockRunner.enqueue).not.toHaveBeenCalled()
  })

  it('returns fail when experiment is already running', async () => {
    const experiment = {
      id: VALID_UUID,
      name: 'exp1',
      status: 'running',
      datasetId: VALID_UUID_2,
      revision: { items: [] },
      graders: [],
      results: [],
    }
    mockRepo.findById.mockResolvedValue(ok(experiment))

    const result = await service.runExperiment(VALID_UUID)
    expect(result).toEqual({ success: false, error: 'Experiment is not in a runnable state' })
    expect(mockRunner.enqueue).not.toHaveBeenCalled()
  })

  it('returns fail when experiment is complete', async () => {
    const experiment = {
      id: VALID_UUID,
      name: 'exp1',
      status: 'complete',
      datasetId: VALID_UUID_2,
      revision: { items: [] },
      graders: [],
      results: [],
    }
    mockRepo.findById.mockResolvedValue(ok(experiment))

    const result = await service.runExperiment(VALID_UUID)
    expect(result).toEqual({ success: false, error: 'Experiment is not in a runnable state' })
  })

  it('fails when dataset has no items at run time', async () => {
    mockRepo.findById.mockResolvedValue(
      ok({
        id: VALID_UUID,
        name: 'exp1',
        status: 'queued',
        datasetId: VALID_UUID_2,
        revision: { items: [] },
        graders: [{ graderId: VALID_UUID_3, grader: { id: VALID_UUID_3, rubric: 'judge it' } }],
        results: [],
      }),
    )
    const result = await service.runExperiment(VALID_UUID)
    expect(result).toEqual({ success: false, error: 'Dataset has no items' })
    expect(mockRunner.enqueue).not.toHaveBeenCalled()
  })
})

describe('exportCsv', () => {
  it('returns csv with one row per dataset item and per-grader columns', async () => {
    const experiment = {
      id: VALID_UUID,
      name: 'exp1',
      status: 'complete',
      datasetId: VALID_UUID_2,
      revision: { attributes: ['input', 'expected_output'], items: [] },
      graders: [],
      results: [],
    }
    mockRepo.findById.mockResolvedValue(ok(experiment))
    mockRepo.findResultsWithDetails.mockResolvedValue(
      ok([
        {
          id: 'r1',
          experimentId: VALID_UUID,
          datasetRevisionItemId: 'item-1',
          graderId: VALID_UUID_3,
          verdict: 'pass',
          reason: 'Looks good',
          datasetRevisionItem: { values: { input: 'hello', expected_output: 'world' } },
          grader: { name: 'accuracy-grader' },
        },
      ]),
    )

    const result = await service.exportCsv(VALID_UUID)
    expect(result.success).toBe(true)
    if (!result.success) return
    const lines = result.data.trim().split('\n')
    // Header: dataset attributes + {graderName}_verdict + {graderName}_reason
    expect(lines[0]).toBe('input,expected_output,accuracy-grader_verdict,accuracy-grader_reason')
    // One data row per item
    expect(lines[1]).toBe('hello,world,pass,Looks good')
    expect(lines).toHaveLength(2)
  })

  it('returns one row per item with columns for each grader', async () => {
    const experiment = {
      id: VALID_UUID,
      name: 'exp1',
      status: 'complete',
      datasetId: VALID_UUID_2,
      revision: { attributes: ['input', 'expected_output'], items: [] },
      graders: [],
      results: [],
    }
    mockRepo.findById.mockResolvedValue(ok(experiment))
    mockRepo.findResultsWithDetails.mockResolvedValue(
      ok([
        {
          id: 'r1',
          experimentId: VALID_UUID,
          datasetRevisionItemId: 'item-1',
          graderId: VALID_UUID_3,
          verdict: 'pass',
          reason: 'good',
          datasetRevisionItem: { values: { input: 'hi', expected_output: 'hello' } },
          grader: { name: 'grader-a' },
        },
        {
          id: 'r2',
          experimentId: VALID_UUID,
          datasetRevisionItemId: 'item-1',
          graderId: VALID_UUID_2,
          verdict: 'fail',
          reason: 'bad tone',
          datasetRevisionItem: { values: { input: 'hi', expected_output: 'hello' } },
          grader: { name: 'grader-b' },
        },
      ]),
    )

    const result = await service.exportCsv(VALID_UUID)
    expect(result.success).toBe(true)
    if (!result.success) return
    const lines = result.data.trim().split('\n')
    expect(lines[0]).toBe(
      'input,expected_output,grader-a_verdict,grader-a_reason,grader-b_verdict,grader-b_reason',
    )
    expect(lines[1]).toBe('hi,hello,pass,good,fail,bad tone')
    expect(lines).toHaveLength(2)
  })

  it('returns fail when experiment not found', async () => {
    mockRepo.findById.mockResolvedValue(fail('Experiment not found'))
    const result = await service.exportCsv(VALID_UUID)
    expect(result).toEqual({ success: false, error: 'Experiment not found' })
  })

  it('returns fail when experiment is running', async () => {
    const experiment = {
      id: VALID_UUID,
      name: 'exp1',
      status: 'running',
      datasetId: VALID_UUID_2,
      revision: { attributes: ['input', 'expected_output'], items: [] },
      graders: [],
      results: [],
    }
    mockRepo.findById.mockResolvedValue(ok(experiment))
    const result = await service.exportCsv(VALID_UUID)
    expect(result).toEqual({ success: false, error: 'Experiment has not finished running' })
  })

  it('returns fail when experiment is queued', async () => {
    const experiment = {
      id: VALID_UUID,
      name: 'exp1',
      status: 'queued',
      datasetId: VALID_UUID_2,
      revision: { attributes: ['input', 'expected_output'], items: [] },
      graders: [],
      results: [],
    }
    mockRepo.findById.mockResolvedValue(ok(experiment))
    const result = await service.exportCsv(VALID_UUID)
    expect(result).toEqual({ success: false, error: 'Experiment has not finished running' })
  })

  it('exports CSV for failed experiment with error verdicts', async () => {
    const experiment = {
      id: VALID_UUID,
      name: 'exp1',
      status: 'failed',
      datasetId: VALID_UUID_2,
      revision: { attributes: ['input', 'expected_output'], items: [] },
      graders: [],
      results: [],
    }
    mockRepo.findById.mockResolvedValue(ok(experiment))
    mockRepo.findResultsWithDetails.mockResolvedValue(
      ok([
        {
          id: 'r1',
          experimentId: VALID_UUID,
          datasetRevisionItemId: 'item-1',
          graderId: VALID_UUID_3,
          verdict: 'error',
          reason: 'API error',
          datasetRevisionItem: { values: { input: 'hello', expected_output: 'world' } },
          grader: { name: 'accuracy-grader' },
        },
      ]),
    )

    const result = await service.exportCsv(VALID_UUID)
    expect(result.success).toBe(true)
    if (!result.success) return
    const lines = result.data.trim().split('\n')
    expect(lines[0]).toBe('input,expected_output,accuracy-grader_verdict,accuracy-grader_reason')
    expect(lines[1]).toBe('hello,world,error,API error')
    expect(lines).toHaveLength(2)
  })

  it('returns fail when experiment is complete but has no results', async () => {
    const experiment = {
      id: VALID_UUID,
      name: 'exp1',
      status: 'complete',
      datasetId: VALID_UUID_2,
      revision: { attributes: ['input', 'expected_output'], items: [] },
      graders: [],
      results: [],
    }
    mockRepo.findById.mockResolvedValue(ok(experiment))
    mockRepo.findResultsWithDetails.mockResolvedValue(ok([]))
    const result = await service.exportCsv(VALID_UUID)
    expect(result).toEqual({ success: false, error: 'No results to export' })
  })

  it('escapes commas and quotes in CSV values', async () => {
    const experiment = {
      id: VALID_UUID,
      name: 'exp1',
      status: 'complete',
      datasetId: VALID_UUID_2,
      revision: { attributes: ['input', 'expected_output'], items: [] },
      graders: [],
      results: [],
    }
    mockRepo.findById.mockResolvedValue(ok(experiment))
    mockRepo.findResultsWithDetails.mockResolvedValue(
      ok([
        {
          id: 'r1',
          experimentId: VALID_UUID,
          datasetRevisionItemId: 'item-1',
          graderId: VALID_UUID_3,
          verdict: 'pass',
          reason: 'Has, comma and "quotes"',
          datasetRevisionItem: { values: { input: 'hello, world', expected_output: 'ok' } },
          grader: { name: 'grader-1' },
        },
      ]),
    )

    const result = await service.exportCsv(VALID_UUID)
    expect(result.success).toBe(true)
    if (!result.success) return
    const lines = result.data.trim().split('\n')
    expect(lines[1]).toContain('"hello, world"')
    expect(lines[1]).toContain('"Has, comma and ""quotes"""')
  })
})
