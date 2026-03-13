import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createExperimentRouter } from '../router.js'

const VALID_UUID = '123e4567-e89b-42d3-a456-426614174000'
const VALID_UUID_2 = '123e4567-e89b-42d3-a456-426614174001'
const VALID_UUID_3 = '123e4567-e89b-42d3-a456-426614174002'

const mockService = {
  listExperiments: vi.fn(),
  getExperiment: vi.fn(),
  createExperiment: vi.fn(),
  deleteExperiment: vi.fn(),
  rerunExperiment: vi.fn(),
  runExperiment: vi.fn(),
  exportCsv: vi.fn(),
}

const app = createExperimentRouter(mockService)

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

function del(path: string) {
  return app.request(path, { method: 'DELETE' })
}

describe('GET /experiments', () => {
  it('returns 200 with experiments array', async () => {
    const experiments = [{ id: VALID_UUID, name: 'exp1', status: 'queued' }]
    mockService.listExperiments.mockResolvedValue({ success: true, data: experiments })

    const res = await app.request('/experiments')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true, data: experiments })
  })

  it('returns revision in experiment list', async () => {
    const experiments = [
      {
        id: VALID_UUID,
        name: 'exp1',
        status: 'queued',
        revision: { schemaVersion: 1, createdAt: '2024-01-01T00:00:00.000Z' },
      },
    ]
    mockService.listExperiments.mockResolvedValue({ success: true, data: experiments })

    const res = await app.request('/experiments')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data[0].revision).toEqual({
      schemaVersion: 1,
      createdAt: '2024-01-01T00:00:00.000Z',
    })
  })
})

describe('POST /experiments', () => {
  it('returns 201 with valid body', async () => {
    const created = { id: VALID_UUID, name: 'exp1', status: 'queued', datasetId: VALID_UUID_2 }
    mockService.createExperiment.mockResolvedValue({ success: true, data: created })

    const res = await jsonPost('/experiments', {
      name: 'exp1',
      datasetId: VALID_UUID_2,
      graderIds: [VALID_UUID_3],
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toEqual({ success: true, data: created })
  })

  it('returns 400 when name is empty', async () => {
    const res = await jsonPost('/experiments', {
      name: '',
      datasetId: VALID_UUID_2,
      graderIds: [VALID_UUID_3],
    })
    expect(res.status).toBe(400)
    expect(mockService.createExperiment).not.toHaveBeenCalled()
  })

  it('returns 400 when graderIds is empty', async () => {
    const res = await jsonPost('/experiments', {
      name: 'exp1',
      datasetId: VALID_UUID_2,
      graderIds: [],
    })
    expect(res.status).toBe(400)
    expect(mockService.createExperiment).not.toHaveBeenCalled()
  })

  it('returns 400 when service fails (dataset not found)', async () => {
    mockService.createExperiment.mockResolvedValue({ success: false, error: 'Dataset not found' })
    const res = await jsonPost('/experiments', {
      name: 'exp1',
      datasetId: VALID_UUID_2,
      graderIds: [VALID_UUID_3],
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
  })
})

describe('GET /experiments/:id', () => {
  it('returns 200 when found', async () => {
    const experiment = { id: VALID_UUID, name: 'exp1', status: 'queued', results: [] }
    mockService.getExperiment.mockResolvedValue({ success: true, data: experiment })

    const res = await app.request(`/experiments/${VALID_UUID}`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual(experiment)
  })

  it('returns 404 when not found', async () => {
    mockService.getExperiment.mockResolvedValue({ success: false, error: 'Experiment not found' })

    const res = await app.request(`/experiments/${VALID_UUID}`)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.success).toBe(false)
  })
})

describe('DELETE /experiments/:id', () => {
  it('returns 200 on successful delete', async () => {
    mockService.deleteExperiment.mockResolvedValue({ success: true, data: { deleted: true } })

    const res = await del(`/experiments/${VALID_UUID}`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual({ deleted: true })
  })

  it('returns 404 when not found', async () => {
    mockService.deleteExperiment.mockResolvedValue({
      success: false,
      error: 'Experiment not found',
    })

    const res = await del(`/experiments/${VALID_UUID}`)
    expect(res.status).toBe(404)
  })
})

describe('POST /experiments/:id/rerun', () => {
  it('returns 201 on successful rerun', async () => {
    const rerun = { id: VALID_UUID_2, name: 'exp1 (re-run)', status: 'queued' }
    mockService.rerunExperiment.mockResolvedValue({ success: true, data: rerun })

    const res = await jsonPost(`/experiments/${VALID_UUID}/rerun`, {})
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data).toEqual(rerun)
  })

  it('returns 404 when original not found', async () => {
    mockService.rerunExperiment.mockResolvedValue({ success: false, error: 'Experiment not found' })

    const res = await jsonPost(`/experiments/${VALID_UUID}/rerun`, {})
    expect(res.status).toBe(404)
  })
})

describe('POST /experiments/:id/run', () => {
  it('returns 202 on success', async () => {
    mockService.runExperiment.mockResolvedValue({ success: true, data: { status: 'queued' } })

    const res = await jsonPost(`/experiments/${VALID_UUID}/run`, {})
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.data).toEqual({ status: 'queued' })
  })

  it('returns 400 when service fails', async () => {
    mockService.runExperiment.mockResolvedValue({
      success: false,
      error: 'Experiment is not in a runnable state',
    })

    const res = await jsonPost(`/experiments/${VALID_UUID}/run`, {})
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
  })
})

describe('GET /experiments/:id/csv/export', () => {
  it('returns 200 with CSV content', async () => {
    const csv = 'item_input,item_expected_output,grader_name,verdict,reason\nhello,world,g1,pass,ok'
    mockService.exportCsv.mockResolvedValue({ success: true, data: csv })

    const res = await app.request(`/experiments/${VALID_UUID}/csv/export`)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/csv')
    const body = await res.text()
    expect(body).toBe(csv)
  })

  it('returns 400 when experiment not found or not complete', async () => {
    mockService.exportCsv.mockResolvedValue({ success: false, error: 'Experiment is not complete' })

    const res = await app.request(`/experiments/${VALID_UUID}/csv/export`)
    expect(res.status).toBe(400)
  })
})
