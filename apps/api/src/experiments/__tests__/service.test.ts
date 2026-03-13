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

const service = createExperimentService(mockRepo, mockDatasetRepo, mockGraderRepo)

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
})
