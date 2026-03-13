import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createGraderRouter } from '../router.js'

const mockService = {
  listGraders: vi.fn(),
  getGrader: vi.fn(),
  createGrader: vi.fn(),
  updateGrader: vi.fn(),
  deleteGrader: vi.fn(),
}

const app = createGraderRouter(mockService)

beforeEach(() => {
  vi.resetAllMocks()
})

function jsonPost(path: string, body: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function jsonPatch(path: string, body: unknown) {
  return app.request(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function del(path: string) {
  return app.request(path, { method: 'DELETE' })
}

describe('POST /graders', () => {
  it('returns 201 with valid body', async () => {
    const created = { id: '1', name: 'my-grader', description: '', rubric: 'Score on accuracy' }
    mockService.createGrader.mockResolvedValue({ success: true, data: created })

    const res = await jsonPost('/graders', { name: 'my-grader', rubric: 'Score on accuracy' })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toEqual({ success: true, data: created })
  })

  it('returns 400 when name is empty', async () => {
    const res = await jsonPost('/graders', { name: '', rubric: 'Score on accuracy' })
    expect(res.status).toBe(400)
    expect(mockService.createGrader).not.toHaveBeenCalled()
  })

  it('returns 400 when rubric is empty', async () => {
    const res = await jsonPost('/graders', { name: 'my-grader', rubric: '' })
    expect(res.status).toBe(400)
    expect(mockService.createGrader).not.toHaveBeenCalled()
  })

  it('returns 400 when service fails (name exists)', async () => {
    mockService.createGrader.mockResolvedValue({ success: false, error: 'Grader name already exists' })
    const res = await jsonPost('/graders', { name: 'dup', rubric: 'Some rubric' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
  })
})

describe('GET /graders', () => {
  it('returns 200 with graders array', async () => {
    const graders = [{ id: '1', name: 'g1', description: '', rubric: 'rubric' }]
    mockService.listGraders.mockResolvedValue({ success: true, data: graders })

    const res = await app.request('/graders')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true, data: graders })
  })
})

describe('GET /graders/:id', () => {
  it('returns 200 when found', async () => {
    const grader = { id: '1', name: 'g1', description: '', rubric: 'rubric' }
    mockService.getGrader.mockResolvedValue({ success: true, data: grader })

    const res = await app.request('/graders/1')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual(grader)
  })

  it('returns 404 when not found', async () => {
    mockService.getGrader.mockResolvedValue({ success: false, error: 'Grader not found' })

    const res = await app.request('/graders/999')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.success).toBe(false)
  })
})

describe('PATCH /graders/:id', () => {
  it('returns 200 on successful update', async () => {
    const updated = { id: '1', name: 'renamed', description: '', rubric: 'rubric' }
    mockService.updateGrader.mockResolvedValue({ success: true, data: updated })

    const res = await jsonPatch('/graders/1', { name: 'renamed' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual(updated)
  })

  it('returns 400 when name is empty', async () => {
    const res = await jsonPatch('/graders/1', { name: '' })
    expect(res.status).toBe(400)
    expect(mockService.updateGrader).not.toHaveBeenCalled()
  })

  it('returns 404 when service fails with not found', async () => {
    mockService.updateGrader.mockResolvedValue({ success: false, error: 'Grader not found' })
    const res = await jsonPatch('/graders/999', { name: 'new' })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /graders/:id', () => {
  it('returns 200 on successful delete', async () => {
    mockService.deleteGrader.mockResolvedValue({ success: true, data: { deleted: true } })

    const res = await del('/graders/1')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual({ deleted: true })
  })

  it('returns 404 when not found', async () => {
    mockService.deleteGrader.mockResolvedValue({ success: false, error: 'Grader not found' })

    const res = await del('/graders/999')
    expect(res.status).toBe(404)
  })
})
