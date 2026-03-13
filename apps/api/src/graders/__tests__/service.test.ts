import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createGraderService } from '../service.js'

const mockRepo = {
  findAll: vi.fn(),
  findById: vi.fn(),
  findByName: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}

const service = createGraderService(mockRepo)

beforeEach(() => {
  vi.resetAllMocks()
})

describe('listGraders', () => {
  it('returns ok with graders array', async () => {
    const graders = [
      { id: '1', name: 'g1', description: '', rubric: 'some rubric' },
    ]
    mockRepo.findAll.mockResolvedValue(graders)
    const result = await service.listGraders()
    expect(result).toEqual({ success: true, data: graders })
  })
})

describe('getGrader', () => {
  it('returns ok when found', async () => {
    const grader = { id: '1', name: 'g1', description: '', rubric: 'some rubric' }
    mockRepo.findById.mockResolvedValue(grader)
    const result = await service.getGrader('1')
    expect(result).toEqual({ success: true, data: grader })
  })

  it('returns fail when not found', async () => {
    mockRepo.findById.mockResolvedValue(null)
    const result = await service.getGrader('999')
    expect(result).toEqual({ success: false, error: 'Grader not found' })
  })
})

describe('createGrader', () => {
  it('creates successfully', async () => {
    mockRepo.findByName.mockResolvedValue(null)
    const created = { id: '1', name: 'g1', description: '', rubric: 'some rubric' }
    mockRepo.create.mockResolvedValue(created)
    const result = await service.createGrader({ name: 'g1', description: '', rubric: 'some rubric' })
    expect(result).toEqual({ success: true, data: created })
  })

  it('fails on duplicate name', async () => {
    mockRepo.findByName.mockResolvedValue({ id: '1', name: 'g1', description: '', rubric: 'rubric' })
    const result = await service.createGrader({ name: 'g1', description: '', rubric: 'some rubric' })
    expect(result).toEqual({ success: false, error: 'Grader name already exists' })
  })
})

describe('updateGrader', () => {
  it('updates successfully', async () => {
    mockRepo.findById.mockResolvedValue({ id: '1', name: 'g1', description: '', rubric: 'old rubric' })
    mockRepo.findByName.mockResolvedValue(null)
    const updated = { id: '1', name: 'g2', description: '', rubric: 'old rubric' }
    mockRepo.update.mockResolvedValue(updated)
    const result = await service.updateGrader('1', { name: 'g2' })
    expect(result).toEqual({ success: true, data: updated })
  })

  it('fails when not found', async () => {
    mockRepo.findById.mockResolvedValue(null)
    const result = await service.updateGrader('999', { name: 'g2' })
    expect(result).toEqual({ success: false, error: 'Grader not found' })
  })

  it('fails on duplicate name', async () => {
    mockRepo.findById.mockResolvedValue({ id: '1', name: 'g1', description: '', rubric: 'rubric' })
    mockRepo.findByName.mockResolvedValue({ id: '2', name: 'g2', description: '', rubric: 'rubric' })
    const result = await service.updateGrader('1', { name: 'g2' })
    expect(result).toEqual({ success: false, error: 'Grader name already exists' })
  })

  it('allows updating with same name', async () => {
    const existing = { id: '1', name: 'g1', description: '', rubric: 'rubric' }
    mockRepo.findById.mockResolvedValue(existing)
    mockRepo.findByName.mockResolvedValue(existing)
    mockRepo.update.mockResolvedValue(existing)
    const result = await service.updateGrader('1', { name: 'g1' })
    expect(result.success).toBe(true)
  })
})

describe('deleteGrader', () => {
  it('deletes successfully', async () => {
    mockRepo.findById.mockResolvedValue({ id: '1', name: 'g1', description: '', rubric: 'rubric' })
    mockRepo.remove.mockResolvedValue({ id: '1' })
    const result = await service.deleteGrader('1')
    expect(result).toEqual({ success: true, data: { deleted: true } })
  })

  it('fails when not found', async () => {
    mockRepo.findById.mockResolvedValue(null)
    const result = await service.deleteGrader('999')
    expect(result).toEqual({ success: false, error: 'Grader not found' })
  })
})
