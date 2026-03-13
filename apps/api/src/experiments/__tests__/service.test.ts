import { describe, it, expect, vi, beforeEach } from 'vitest'
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
      { id: VALID_UUID, name: 'exp1', status: 'queued', datasetId: VALID_UUID_2, graders: [] },
    ]
    mockRepo.findAll.mockResolvedValue(experiments)
    const result = await service.listExperiments()
    expect(result).toEqual({ success: true, data: experiments })
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
    mockRepo.findById.mockResolvedValue(experiment)
    const result = await service.getExperiment(VALID_UUID)
    expect(result).toEqual({ success: true, data: experiment })
  })

  it('returns fail when not found', async () => {
    mockRepo.findById.mockResolvedValue(null)
    const result = await service.getExperiment(VALID_UUID)
    expect(result).toEqual({ success: false, error: 'Experiment not found' })
  })
})

describe('createExperiment', () => {
  it('creates successfully', async () => {
    const dataset = {
      id: VALID_UUID_2,
      name: 'ds1',
      attributes: ['input', 'expected_output'],
      items: [{ id: 'item1' }],
    }
    mockDatasetRepo.findById.mockResolvedValue(dataset)
    mockDatasetRepo.countItems.mockResolvedValue(1)
    mockGraderRepo.findById.mockResolvedValue({ id: VALID_UUID_3, name: 'g1' })
    const created = { id: VALID_UUID, name: 'exp1', status: 'queued', datasetId: VALID_UUID_2 }
    mockRepo.create.mockResolvedValue(created)

    const result = await service.createExperiment({
      name: 'exp1',
      datasetId: VALID_UUID_2,
      graderIds: [VALID_UUID_3],
    })
    expect(result).toEqual({ success: true, data: created })
  })

  it('fails when dataset not found', async () => {
    mockDatasetRepo.findById.mockResolvedValue(null)
    const result = await service.createExperiment({
      name: 'exp1',
      datasetId: VALID_UUID_2,
      graderIds: [VALID_UUID_3],
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
    mockDatasetRepo.findById.mockResolvedValue(dataset)
    mockDatasetRepo.countItems.mockResolvedValue(0)
    const result = await service.createExperiment({
      name: 'exp1',
      datasetId: VALID_UUID_2,
      graderIds: [VALID_UUID_3],
    })
    expect(result).toEqual({ success: false, error: 'Dataset has no items' })
  })

  it('fails when a grader is not found', async () => {
    const dataset = {
      id: VALID_UUID_2,
      name: 'ds1',
      attributes: ['input', 'expected_output'],
      items: [{ id: 'item1' }],
    }
    mockDatasetRepo.findById.mockResolvedValue(dataset)
    mockDatasetRepo.countItems.mockResolvedValue(1)
    mockGraderRepo.findById.mockResolvedValue(null)
    const result = await service.createExperiment({
      name: 'exp1',
      datasetId: VALID_UUID_2,
      graderIds: [VALID_UUID_3],
    })
    expect(result).toEqual({ success: false, error: 'Grader not found' })
  })
})

describe('deleteExperiment', () => {
  it('deletes successfully', async () => {
    mockRepo.findById.mockResolvedValue({ id: VALID_UUID, name: 'exp1' })
    mockRepo.remove.mockResolvedValue({ id: VALID_UUID })
    const result = await service.deleteExperiment(VALID_UUID)
    expect(result).toEqual({ success: true, data: { deleted: true } })
  })

  it('fails when not found', async () => {
    mockRepo.findById.mockResolvedValue(null)
    const result = await service.deleteExperiment(VALID_UUID)
    expect(result).toEqual({ success: false, error: 'Experiment not found' })
  })
})

describe('rerunExperiment', () => {
  it('creates new experiment with derived name on success', async () => {
    const original = {
      id: VALID_UUID,
      name: 'exp1',
      status: 'done',
      datasetId: VALID_UUID_2,
      graders: [{ graderId: VALID_UUID_3 }],
    }
    mockRepo.findById.mockResolvedValue(original)
    mockDatasetRepo.countItems.mockResolvedValue(2)
    const rerun = { id: VALID_UUID_2, name: 'exp1 (re-run)', status: 'queued', datasetId: VALID_UUID_2 }
    mockRepo.create.mockResolvedValue(rerun)

    const result = await service.rerunExperiment(VALID_UUID)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.name).toBe('exp1 (re-run)')
    expect(mockRepo.create).toHaveBeenCalledWith({
      name: 'exp1 (re-run)',
      datasetId: VALID_UUID_2,
      graderIds: [VALID_UUID_3],
    })
  })

  it('fails when experiment not found', async () => {
    mockRepo.findById.mockResolvedValue(null)
    const result = await service.rerunExperiment(VALID_UUID)
    expect(result).toEqual({ success: false, error: 'Experiment not found' })
  })

  it('fails when dataset has no items', async () => {
    const original = {
      id: VALID_UUID,
      name: 'exp1',
      status: 'done',
      datasetId: VALID_UUID_2,
      graders: [{ graderId: VALID_UUID_3 }],
    }
    mockRepo.findById.mockResolvedValue(original)
    mockDatasetRepo.countItems.mockResolvedValue(0)
    const result = await service.rerunExperiment(VALID_UUID)
    expect(result).toEqual({ success: false, error: 'Dataset has no items' })
  })
})

describe('runExperiment', () => {
  it('returns ok with status queued when experiment is found and status is queued', async () => {
    const experiment = {
      id: VALID_UUID,
      name: 'exp1',
      status: 'queued',
      datasetId: VALID_UUID_2,
      dataset: { items: [{ id: 'item-1', values: { input: 'hi' } }] },
      graders: [{ graderId: VALID_UUID_3, grader: { id: VALID_UUID_3, rubric: 'judge it' } }],
      results: [],
    }
    mockRepo.findById.mockResolvedValue(experiment)
    mockRunner.enqueue.mockResolvedValue(undefined)

    const result = await service.runExperiment(VALID_UUID)
    expect(result).toEqual({ success: true, data: { status: 'queued' } })
    expect(mockRunner.enqueue).toHaveBeenCalledWith(
      VALID_UUID,
      [{ id: 'item-1', values: { input: 'hi' } }],
      [{ id: VALID_UUID_3, rubric: 'judge it' }],
    )
  })

  it('returns fail when experiment not found', async () => {
    mockRepo.findById.mockResolvedValue(null)
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
      dataset: { items: [] },
      graders: [],
      results: [],
    }
    mockRepo.findById.mockResolvedValue(experiment)

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
      dataset: { items: [] },
      graders: [],
      results: [],
    }
    mockRepo.findById.mockResolvedValue(experiment)

    const result = await service.runExperiment(VALID_UUID)
    expect(result).toEqual({ success: false, error: 'Experiment is not in a runnable state' })
  })

  it('fails when dataset has no items at run time', async () => {
    mockRepo.findById.mockResolvedValue({
      id: VALID_UUID,
      name: 'exp1',
      status: 'queued',
      datasetId: VALID_UUID_2,
      dataset: { items: [] },
      graders: [{ graderId: VALID_UUID_3, grader: { id: VALID_UUID_3, rubric: 'judge it' } }],
      results: [],
    })
    mockDatasetRepo.countItems.mockResolvedValue(0)
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
      dataset: { attributes: ['input', 'expected_output'], items: [] },
      graders: [],
      results: [],
    }
    mockRepo.findById.mockResolvedValue(experiment)
    mockRepo.findResultsWithDetails.mockResolvedValue([
      {
        id: 'r1',
        experimentId: VALID_UUID,
        datasetItemId: 'item-1',
        graderId: VALID_UUID_3,
        verdict: 'pass',
        reason: 'Looks good',
        datasetItem: { values: { input: 'hello', expected_output: 'world' } },
        grader: { name: 'accuracy-grader' },
      },
    ])

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
      dataset: { attributes: ['input', 'expected_output'], items: [] },
      graders: [],
      results: [],
    }
    mockRepo.findById.mockResolvedValue(experiment)
    mockRepo.findResultsWithDetails.mockResolvedValue([
      {
        id: 'r1',
        experimentId: VALID_UUID,
        datasetItemId: 'item-1',
        graderId: VALID_UUID_3,
        verdict: 'pass',
        reason: 'good',
        datasetItem: { values: { input: 'hi', expected_output: 'hello' } },
        grader: { name: 'grader-a' },
      },
      {
        id: 'r2',
        experimentId: VALID_UUID,
        datasetItemId: 'item-1',
        graderId: VALID_UUID_2,
        verdict: 'fail',
        reason: 'bad tone',
        datasetItem: { values: { input: 'hi', expected_output: 'hello' } },
        grader: { name: 'grader-b' },
      },
    ])

    const result = await service.exportCsv(VALID_UUID)
    expect(result.success).toBe(true)
    if (!result.success) return
    const lines = result.data.trim().split('\n')
    expect(lines[0]).toBe('input,expected_output,grader-a_verdict,grader-a_reason,grader-b_verdict,grader-b_reason')
    expect(lines[1]).toBe('hi,hello,pass,good,fail,bad tone')
    expect(lines).toHaveLength(2)
  })

  it('returns fail when experiment not found', async () => {
    mockRepo.findById.mockResolvedValue(null)
    const result = await service.exportCsv(VALID_UUID)
    expect(result).toEqual({ success: false, error: 'Experiment not found' })
  })

  it('returns fail when experiment is not complete', async () => {
    const experiment = {
      id: VALID_UUID,
      name: 'exp1',
      status: 'running',
      datasetId: VALID_UUID_2,
      dataset: { attributes: ['input', 'expected_output'], items: [] },
      graders: [],
      results: [],
    }
    mockRepo.findById.mockResolvedValue(experiment)
    const result = await service.exportCsv(VALID_UUID)
    expect(result).toEqual({ success: false, error: 'Experiment is not complete' })
  })

  it('returns fail when experiment is complete but has no results', async () => {
    const experiment = {
      id: VALID_UUID,
      name: 'exp1',
      status: 'complete',
      datasetId: VALID_UUID_2,
      dataset: { attributes: ['input', 'expected_output'], items: [] },
      graders: [],
      results: [],
    }
    mockRepo.findById.mockResolvedValue(experiment)
    mockRepo.findResultsWithDetails.mockResolvedValue([])
    const result = await service.exportCsv(VALID_UUID)
    expect(result).toEqual({ success: false, error: 'No results to export' })
  })

  it('escapes commas and quotes in CSV values', async () => {
    const experiment = {
      id: VALID_UUID,
      name: 'exp1',
      status: 'complete',
      datasetId: VALID_UUID_2,
      dataset: { attributes: ['input', 'expected_output'], items: [] },
      graders: [],
      results: [],
    }
    mockRepo.findById.mockResolvedValue(experiment)
    mockRepo.findResultsWithDetails.mockResolvedValue([
      {
        id: 'r1',
        experimentId: VALID_UUID,
        datasetItemId: 'item-1',
        graderId: VALID_UUID_3,
        verdict: 'pass',
        reason: 'Has, comma and "quotes"',
        datasetItem: { values: { input: 'hello, world', expected_output: 'ok' } },
        grader: { name: 'grader-1' },
      },
    ])

    const result = await service.exportCsv(VALID_UUID)
    expect(result.success).toBe(true)
    if (!result.success) return
    const lines = result.data.trim().split('\n')
    expect(lines[1]).toContain('"hello, world"')
    expect(lines[1]).toContain('"Has, comma and ""quotes"""')
  })
})


