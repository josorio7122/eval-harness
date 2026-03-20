import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ok, fail } from '@eval-harness/shared'

const MODEL_ID = 'openai/gpt-4o'
import { createExperimentService } from '../service.js'

const VALID_UUID = '123e4567-e89b-42d3-a456-426614174000'
const VALID_UUID_2 = '123e4567-e89b-42d3-a456-426614174001'
const VALID_UUID_3 = '123e4567-e89b-42d3-a456-426614174002'
const PROMPT_UUID = '123e4567-e89b-42d3-a456-426614174003'

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
  createOutput: vi.fn(),
  findOutputsByExperimentId: vi.fn(),
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

const mockPromptRepo = {
  findAll: vi.fn(),
  findById: vi.fn(),
  findByName: vi.fn(),
  create: vi.fn(),
  updateName: vi.fn(),
  createVersion: vi.fn(),
  findLatestVersion: vi.fn(),
  remove: vi.fn(),
}

const service = createExperimentService({
  repo: mockRepo,
  datasetRepo: mockDatasetRepo,
  graderRepo: mockGraderRepo,
  promptRepo: mockPromptRepo,
  runner: mockRunner,
})

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
  it('creates successfully with datasetRevisionId and promptVersionId', async () => {
    const dataset = {
      id: VALID_UUID_2,
      name: 'ds1',
      attributes: ['input', 'expected_output'],
      items: [{ id: 'item1' }],
    }
    mockPromptRepo.findById.mockResolvedValue(ok({ id: PROMPT_UUID, name: 'p1' }))
    mockPromptRepo.findLatestVersion.mockResolvedValue(
      ok({
        id: 'pv-1',
        userPrompt: 'Answer: {input}',
        systemPrompt: 'sys',
        modelId: 'test/m',
        modelParams: {},
      }),
    )
    mockDatasetRepo.findById.mockResolvedValue(ok(dataset))
    mockDatasetRepo.countItems.mockResolvedValue(ok(1))
    mockDatasetRepo.findRevisions.mockResolvedValue(ok([{ id: 'rev-1' }]))
    mockGraderRepo.findById.mockResolvedValue(ok({ id: VALID_UUID_3, name: 'g1' }))
    const created = { id: VALID_UUID, name: 'exp1', status: 'queued', datasetId: VALID_UUID_2 }
    mockRepo.create.mockResolvedValue(ok(created))
    // enqueueExperiment fetches the created experiment to build the runner payload
    mockRepo.findById.mockResolvedValue(
      ok({
        ...created,
        modelId: MODEL_ID,
        revision: { items: [{ id: 'item1', values: { input: 'q', expected_output: 'a' } }] },
        graders: [{ graderId: VALID_UUID_3, grader: { id: VALID_UUID_3, rubric: 'rubric' } }],
        promptVersion: {
          id: 'pv-1',
          systemPrompt: 'sys',
          userPrompt: 'Answer: {input}',
          modelId: 'test/m',
          modelParams: {},
          prompt: { id: PROMPT_UUID },
        },
      }),
    )
    mockRunner.enqueue.mockResolvedValue(undefined)

    const result = await service.createExperiment({
      name: 'exp1',
      datasetId: VALID_UUID_2,
      graderIds: [VALID_UUID_3],
      modelId: MODEL_ID,
      promptId: PROMPT_UUID,
    })
    expect(result).toEqual({ success: true, data: created })
    expect(mockRepo.create).toHaveBeenCalledWith({
      name: 'exp1',
      datasetId: VALID_UUID_2,
      datasetRevisionId: 'rev-1',
      graderIds: [VALID_UUID_3],
      modelId: MODEL_ID,
      promptVersionId: 'pv-1',
    })
    // flush the void enqueueExperiment promise
    await Promise.resolve()
    expect(mockRunner.enqueue).toHaveBeenCalledWith({
      experimentId: VALID_UUID,
      datasetItems: [{ id: 'item1', values: { input: 'q', expected_output: 'a' } }],
      graders: [{ id: VALID_UUID_3, rubric: 'rubric' }],
      modelId: MODEL_ID,
      promptVersion: {
        systemPrompt: 'sys',
        userPrompt: 'Answer: {input}',
        modelId: 'test/m',
        modelParams: {},
      },
    })
  })

  it('passes custom modelId to repo.create', async () => {
    const dataset = {
      id: VALID_UUID_2,
      name: 'ds1',
      attributes: ['input', 'expected_output'],
      items: [{ id: 'item1' }],
    }
    mockPromptRepo.findById.mockResolvedValue(ok({ id: PROMPT_UUID, name: 'p1' }))
    mockPromptRepo.findLatestVersion.mockResolvedValue(
      ok({
        id: 'pv-1',
        userPrompt: 'Answer: {input}',
        systemPrompt: 'sys',
        modelId: 'test/m',
        modelParams: {},
      }),
    )
    mockDatasetRepo.findById.mockResolvedValue(ok(dataset))
    mockDatasetRepo.countItems.mockResolvedValue(ok(1))
    mockDatasetRepo.findRevisions.mockResolvedValue(ok([{ id: 'rev-1' }]))
    mockGraderRepo.findById.mockResolvedValue(ok({ id: VALID_UUID_3, name: 'g1' }))
    const created = { id: VALID_UUID, name: 'exp1', status: 'queued', datasetId: VALID_UUID_2 }
    mockRepo.create.mockResolvedValue(ok(created))
    // enqueueExperiment fires-and-forgets; return fail so it exits cleanly without calling enqueue
    mockRepo.findById.mockResolvedValue(fail('not found'))
    mockRunner.enqueue.mockResolvedValue(undefined)

    await service.createExperiment({
      name: 'exp1',
      datasetId: VALID_UUID_2,
      graderIds: [VALID_UUID_3],
      modelId: 'openai/gpt-4o',
      promptId: PROMPT_UUID,
    })
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ modelId: 'openai/gpt-4o' }),
    )
  })

  it('fails when prompt not found', async () => {
    mockPromptRepo.findById.mockResolvedValue(fail('Prompt not found'))
    const result = await service.createExperiment({
      name: 'exp1',
      datasetId: VALID_UUID_2,
      graderIds: [VALID_UUID_3],
      modelId: MODEL_ID,
      promptId: PROMPT_UUID,
    })
    expect(result).toEqual({ success: false, error: 'Prompt not found' })
  })

  it('fails when prompt has no versions', async () => {
    mockPromptRepo.findById.mockResolvedValue(ok({ id: PROMPT_UUID, name: 'p1' }))
    mockPromptRepo.findLatestVersion.mockResolvedValue(fail('No versions'))
    const result = await service.createExperiment({
      name: 'exp1',
      datasetId: VALID_UUID_2,
      graderIds: [VALID_UUID_3],
      modelId: MODEL_ID,
      promptId: PROMPT_UUID,
    })
    expect(result).toEqual({ success: false, error: 'Prompt has no versions' })
  })

  it('fails when prompt template missing {input} placeholder', async () => {
    mockPromptRepo.findById.mockResolvedValue(ok({ id: PROMPT_UUID, name: 'p1' }))
    mockPromptRepo.findLatestVersion.mockResolvedValue(
      ok({
        id: 'pv-1',
        userPrompt: 'Answer the question please',
        systemPrompt: 'sys',
        modelId: 'test/m',
        modelParams: {},
      }),
    )
    const result = await service.createExperiment({
      name: 'exp1',
      datasetId: VALID_UUID_2,
      graderIds: [VALID_UUID_3],
      modelId: MODEL_ID,
      promptId: PROMPT_UUID,
    })
    expect(result).toEqual({
      success: false,
      error: 'Prompt template must include {input} placeholder',
    })
  })

  it('passes promptVersionId to repo.create', async () => {
    const dataset = {
      id: VALID_UUID_2,
      name: 'ds1',
      attributes: ['input', 'expected_output'],
      items: [{ id: 'item1' }],
    }
    mockPromptRepo.findById.mockResolvedValue(ok({ id: PROMPT_UUID, name: 'p1' }))
    mockPromptRepo.findLatestVersion.mockResolvedValue(
      ok({
        id: 'pv-42',
        userPrompt: 'Solve: {input}',
        systemPrompt: 'sys',
        modelId: 'test/m',
        modelParams: {},
      }),
    )
    mockDatasetRepo.findById.mockResolvedValue(ok(dataset))
    mockDatasetRepo.countItems.mockResolvedValue(ok(1))
    mockDatasetRepo.findRevisions.mockResolvedValue(ok([{ id: 'rev-1' }]))
    mockGraderRepo.findById.mockResolvedValue(ok({ id: VALID_UUID_3, name: 'g1' }))
    mockRepo.create.mockResolvedValue(
      ok({ id: VALID_UUID, name: 'exp1', status: 'queued', datasetId: VALID_UUID_2 }),
    )
    mockRepo.findById.mockResolvedValue(fail('not found'))

    await service.createExperiment({
      name: 'exp1',
      datasetId: VALID_UUID_2,
      graderIds: [VALID_UUID_3],
      modelId: MODEL_ID,
      promptId: PROMPT_UUID,
    })
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ promptVersionId: 'pv-42' }),
    )
  })

  it('fails when dataset not found', async () => {
    mockPromptRepo.findById.mockResolvedValue(ok({ id: PROMPT_UUID, name: 'p1' }))
    mockPromptRepo.findLatestVersion.mockResolvedValue(
      ok({
        id: 'pv-1',
        userPrompt: 'Answer: {input}',
        systemPrompt: 'sys',
        modelId: 'test/m',
        modelParams: {},
      }),
    )
    mockDatasetRepo.findById.mockResolvedValue(fail('Dataset not found'))
    const result = await service.createExperiment({
      name: 'exp1',
      datasetId: VALID_UUID_2,
      graderIds: [VALID_UUID_3],
      modelId: MODEL_ID,
      promptId: PROMPT_UUID,
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
    mockPromptRepo.findById.mockResolvedValue(ok({ id: PROMPT_UUID, name: 'p1' }))
    mockPromptRepo.findLatestVersion.mockResolvedValue(
      ok({
        id: 'pv-1',
        userPrompt: 'Answer: {input}',
        systemPrompt: 'sys',
        modelId: 'test/m',
        modelParams: {},
      }),
    )
    mockDatasetRepo.findById.mockResolvedValue(ok(dataset))
    mockDatasetRepo.countItems.mockResolvedValue(ok(0))
    const result = await service.createExperiment({
      name: 'exp1',
      datasetId: VALID_UUID_2,
      graderIds: [VALID_UUID_3],
      modelId: MODEL_ID,
      promptId: PROMPT_UUID,
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
    mockPromptRepo.findById.mockResolvedValue(ok({ id: PROMPT_UUID, name: 'p1' }))
    mockPromptRepo.findLatestVersion.mockResolvedValue(
      ok({
        id: 'pv-1',
        userPrompt: 'Answer: {input}',
        systemPrompt: 'sys',
        modelId: 'test/m',
        modelParams: {},
      }),
    )
    mockDatasetRepo.findById.mockResolvedValue(ok(dataset))
    mockDatasetRepo.countItems.mockResolvedValue(ok(1))
    mockDatasetRepo.findRevisions.mockResolvedValue(ok([]))
    mockGraderRepo.findById.mockResolvedValue(ok({ id: VALID_UUID_3, name: 'g1' }))
    const result = await service.createExperiment({
      name: 'exp1',
      datasetId: VALID_UUID_2,
      graderIds: [VALID_UUID_3],
      modelId: MODEL_ID,
      promptId: PROMPT_UUID,
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
    mockPromptRepo.findById.mockResolvedValue(ok({ id: PROMPT_UUID, name: 'p1' }))
    mockPromptRepo.findLatestVersion.mockResolvedValue(
      ok({
        id: 'pv-1',
        userPrompt: 'Answer: {input}',
        systemPrompt: 'sys',
        modelId: 'test/m',
        modelParams: {},
      }),
    )
    mockDatasetRepo.findById.mockResolvedValue(ok(dataset))
    mockDatasetRepo.countItems.mockResolvedValue(ok(1))
    mockDatasetRepo.findRevisions.mockResolvedValue(ok([{ id: 'rev-1' }]))
    mockGraderRepo.findById.mockResolvedValue(fail('Grader not found'))
    const result = await service.createExperiment({
      name: 'exp1',
      datasetId: VALID_UUID_2,
      graderIds: [VALID_UUID_3],
      modelId: MODEL_ID,
      promptId: PROMPT_UUID,
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
      promptVersion: {
        prompt: { id: 'prompt-1' },
        id: 'pv-1',
        version: 1,
        systemPrompt: 'sys',
        userPrompt: 'Answer: {input}',
        modelId: 'test/m',
        modelParams: {},
      },
    }
    mockPromptRepo.findLatestVersion.mockResolvedValue(
      ok({
        id: 'pv-2',
        userPrompt: 'Answer: {input}',
        systemPrompt: 'sys',
        modelId: 'test/m',
        modelParams: {},
      }),
    )
    // First call: rerunExperiment fetches the original; second call: enqueueExperiment, return fail so it exits cleanly
    mockRepo.findById.mockResolvedValueOnce(ok(original)).mockResolvedValueOnce(fail('not found'))
    mockDatasetRepo.findRevisions.mockResolvedValue(ok([{ id: 'rev-latest' }]))
    const rerun = {
      id: VALID_UUID_2,
      name: 'exp1 (re-run)',
      status: 'queued',
      datasetId: VALID_UUID_2,
    }
    mockRepo.create.mockResolvedValue(ok(rerun))
    mockRunner.enqueue.mockResolvedValue(undefined)

    const result = await service.rerunExperiment(VALID_UUID)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toHaveProperty('name', 'exp1 (re-run)')
    expect(mockRepo.create).toHaveBeenCalledWith({
      name: 'exp1 (re-run)',
      datasetId: VALID_UUID_2,
      datasetRevisionId: 'rev-latest',
      graderIds: [VALID_UUID_3],
      modelId: 'google/gemini-2.5-flash',
      promptVersionId: 'pv-2',
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
      promptVersion: {
        prompt: { id: 'prompt-1' },
        id: 'pv-1',
        version: 1,
        systemPrompt: 'sys',
        userPrompt: 'Answer: {input}',
        modelId: 'test/m',
        modelParams: {},
      },
    }
    mockPromptRepo.findLatestVersion.mockResolvedValue(
      ok({
        id: 'pv-2',
        userPrompt: 'Answer: {input}',
        systemPrompt: 'sys',
        modelId: 'test/m',
        modelParams: {},
      }),
    )
    mockRepo.findById.mockResolvedValueOnce(ok(original)).mockResolvedValueOnce(fail('not found'))
    mockDatasetRepo.findRevisions.mockResolvedValue(ok([{ id: 'rev-latest' }]))
    mockRepo.create.mockResolvedValue(
      ok({ id: VALID_UUID_2, name: 'exp1 (re-run)', status: 'queued', datasetId: VALID_UUID_2 }),
    )
    mockRunner.enqueue.mockResolvedValue(undefined)

    await service.rerunExperiment(VALID_UUID)
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ modelId: 'anthropic/claude-3-5-sonnet' }),
    )
  })

  it('pins latest version of original prompt', async () => {
    const original = {
      id: VALID_UUID,
      name: 'exp1',
      status: 'done',
      datasetId: VALID_UUID_2,
      modelId: 'google/gemini-2.5-flash',
      graders: [{ graderId: VALID_UUID_3 }],
      promptVersion: {
        prompt: { id: 'prompt-original' },
        id: 'pv-1',
        version: 1,
        systemPrompt: 'sys',
        userPrompt: 'Answer: {input}',
        modelId: 'test/m',
        modelParams: {},
      },
    }
    mockPromptRepo.findLatestVersion.mockResolvedValue(
      ok({
        id: 'pv-99',
        userPrompt: 'Answer: {input}',
        systemPrompt: 'sys v2',
        modelId: 'test/m',
        modelParams: {},
      }),
    )
    mockRepo.findById.mockResolvedValueOnce(ok(original)).mockResolvedValueOnce(fail('not found'))
    mockDatasetRepo.findRevisions.mockResolvedValue(ok([{ id: 'rev-latest' }]))
    mockRepo.create.mockResolvedValue(
      ok({ id: VALID_UUID_2, name: 'exp1 (re-run)', status: 'queued', datasetId: VALID_UUID_2 }),
    )

    await service.rerunExperiment(VALID_UUID)

    expect(mockPromptRepo.findLatestVersion).toHaveBeenCalledWith('prompt-original')
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ promptVersionId: 'pv-99' }),
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
      promptVersion: {
        prompt: { id: 'prompt-1' },
        id: 'pv-1',
        version: 1,
        systemPrompt: 'sys',
        userPrompt: 'Answer: {input}',
        modelId: 'test/m',
        modelParams: {},
      },
    }
    mockPromptRepo.findLatestVersion.mockResolvedValue(
      ok({
        id: 'pv-2',
        userPrompt: 'Answer: {input}',
        systemPrompt: 'sys',
        modelId: 'test/m',
        modelParams: {},
      }),
    )
    mockRepo.findById.mockResolvedValue(ok(original))
    mockDatasetRepo.findRevisions.mockResolvedValue(ok([]))
    const result = await service.rerunExperiment(VALID_UUID)
    expect(result).toEqual({ success: false, error: 'Dataset has no revisions' })
  })

  it('rerunExperiment fails when new prompt version missing {input} placeholder', async () => {
    const original = {
      id: VALID_UUID,
      name: 'exp1',
      status: 'done',
      datasetId: VALID_UUID_2,
      modelId: 'google/gemini-2.5-flash',
      graders: [{ graderId: VALID_UUID_3 }],
      promptVersion: {
        prompt: { id: 'prompt-1' },
        id: 'pv-1',
        version: 1,
        systemPrompt: 'sys',
        userPrompt: 'Answer: {input}',
        modelId: 'test/m',
        modelParams: {},
      },
    }
    mockRepo.findById.mockResolvedValue(ok(original))
    mockPromptRepo.findLatestVersion.mockResolvedValue(
      ok({
        id: 'pv-2',
        userPrompt: 'Answer the question please',
        systemPrompt: 'sys',
        modelId: 'test/m',
        modelParams: {},
      }),
    )
    const result = await service.rerunExperiment(VALID_UUID)
    expect(result).toEqual({
      success: false,
      error: 'Prompt template must include {input} placeholder',
    })
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
    mockRepo.findOutputsByExperimentId.mockResolvedValue(ok([]))

    const result = await service.exportCsv(VALID_UUID)
    expect(result.success).toBe(true)
    if (!result.success) return
    const lines = result.data.trim().split('\n')
    // Header: dataset attributes + output + {graderName}_verdict + {graderName}_reason
    expect(lines[0]).toBe(
      'input,expected_output,output,accuracy-grader_verdict,accuracy-grader_reason',
    )
    // One data row per item
    expect(lines[1]).toBe('hello,world,,pass,Looks good')
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
    mockRepo.findOutputsByExperimentId.mockResolvedValue(ok([]))

    const result = await service.exportCsv(VALID_UUID)
    expect(result.success).toBe(true)
    if (!result.success) return
    const lines = result.data.trim().split('\n')
    expect(lines[0]).toBe(
      'input,expected_output,output,grader-a_verdict,grader-a_reason,grader-b_verdict,grader-b_reason',
    )
    expect(lines[1]).toBe('hi,hello,,pass,good,fail,bad tone')
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
    mockRepo.findOutputsByExperimentId.mockResolvedValue(ok([]))

    const result = await service.exportCsv(VALID_UUID)
    expect(result.success).toBe(true)
    if (!result.success) return
    const lines = result.data.trim().split('\n')
    expect(lines[0]).toBe(
      'input,expected_output,output,accuracy-grader_verdict,accuracy-grader_reason',
    )
    expect(lines[1]).toBe('hello,world,,error,API error')
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
    mockRepo.findOutputsByExperimentId.mockResolvedValue(ok([]))

    const result = await service.exportCsv(VALID_UUID)
    expect(result.success).toBe(true)
    if (!result.success) return
    const lines = result.data.trim().split('\n')
    expect(lines[1]).toContain('"hello, world"')
    expect(lines[1]).toContain('"Has, comma and ""quotes"""')
  })

  it('includes output column with actual output values', async () => {
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
          datasetRevisionItem: { values: { input: 'hello', expected_output: 'world' } },
          grader: { name: 'grader-x' },
        },
      ]),
    )
    mockRepo.findOutputsByExperimentId.mockResolvedValue(
      ok([
        {
          id: 'out-1',
          datasetRevisionItemId: 'item-1',
          output: 'The model said world',
          error: null,
        },
      ]),
    )

    const result = await service.exportCsv(VALID_UUID)
    expect(result.success).toBe(true)
    if (!result.success) return
    const lines = result.data.trim().split('\n')
    expect(lines[0]).toBe('input,expected_output,output,grader-x_verdict,grader-x_reason')
    expect(lines[1]).toContain('The model said world')
  })

  it('shows "error" in output column when output has error', async () => {
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
          verdict: 'error',
          reason: 'API failed',
          datasetRevisionItem: { values: { input: 'hello', expected_output: 'world' } },
          grader: { name: 'grader-x' },
        },
      ]),
    )
    mockRepo.findOutputsByExperimentId.mockResolvedValue(
      ok([
        {
          id: 'out-1',
          datasetRevisionItemId: 'item-1',
          output: '',
          error: 'API timeout',
        },
      ]),
    )

    const result = await service.exportCsv(VALID_UUID)
    expect(result.success).toBe(true)
    if (!result.success) return
    const lines = result.data.trim().split('\n')
    const cols = lines[0].split(',')
    const outputIdx = cols.indexOf('output')
    expect(outputIdx).toBeGreaterThan(-1)
    const dataCols = lines[1].split(',')
    expect(dataCols[outputIdx]).toBe('error')
  })
})
