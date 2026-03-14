import { describe, it, expect, vi, beforeEach } from 'vitest'
import { type Result } from '@eval-harness/shared'

const MODEL_ID = 'openai/gpt-4o'
import { experimentRepository } from '../../experiments/repository.js'
import { datasetRepository } from '../../datasets/repository.js'
import { graderRepository } from '../../graders/repository.js'
import { createExperimentRunner } from '../../experiments/runner.js'
import { createExperimentService } from '../../experiments/service.js'

/** Extract data from Result, fail test if not successful */
function unwrap<T>(result: Result<T>): T {
  expect(result.success).toBe(true)
  if (!result.success) throw new Error(result.error)
  return result.data
}

type EvaluateFn = Parameters<typeof createExperimentRunner>[1]

let seedCounter = 0

async function seedAndRun(params: {
  itemValues: Array<Record<string, string>>
  graderDefs: Array<{ name: string; rubric: string }>
  mockEvaluate: EvaluateFn
}) {
  const { itemValues, graderDefs, mockEvaluate } = params
  const n = ++seedCounter
  const dataset = unwrap(await datasetRepository.create(`csv-dataset-${n}`))

  for (const values of itemValues) {
    unwrap(await datasetRepository.createItem(dataset.id, values))
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
  for (const def of graderDefs) {
    const grader = unwrap(
      await graderRepository.create({
        name: `${def.name}-${n}`,
        description: 'test grader',
        rubric: def.rubric,
      }),
    )
    graders.push({ id: grader.id, rubric: grader.rubric })
  }

  const graderIds = graders.map((g) => g.id)
  const experiment = unwrap(
    await experimentRepository.create({
      name: `csv-exp-${n}`,
      datasetId: dataset.id,
      datasetRevisionId: revisionId,
      graderIds,
      modelId: MODEL_ID,
    }),
  )
  unwrap(await experimentRepository.updateStatus(experiment.id, 'running'))

  const runner = createExperimentRunner(experimentRepository, mockEvaluate)
  await runner.enqueue({
    experimentId: experiment.id,
    datasetItems: items,
    graders,
    modelId: MODEL_ID,
  })

  return { experiment, items, graders, dataset }
}

describe('CSV export (integration)', () => {
  let mockEvaluate: EvaluateFn
  let service: ReturnType<typeof createExperimentService>

  beforeEach(() => {
    mockEvaluate = vi.fn<EvaluateFn>()
    vi.mocked(mockEvaluate).mockResolvedValue({ verdict: 'pass', reason: 'looks good' })
    service = createExperimentService({
      repo: experimentRepository,
      datasetRepo: datasetRepository,
      graderRepo: graderRepository,
    })
  })

  it('export has correct headers: attribute cols + graderName_verdict + graderName_reason', async () => {
    const { experiment, graders } = await seedAndRun({
      itemValues: [{ input: 'q1', expected_output: 'a1' }],
      graderDefs: [{ name: 'accuracy', rubric: 'be accurate' }],
      mockEvaluate,
    })

    // graders[0].id gives us the grader id but we need the name; fetch from DB
    const graderRecord = unwrap(await graderRepository.findById(graders[0].id))
    const graderName = graderRecord.name

    const result = await service.exportCsv(experiment.id)
    const csv = unwrap(result)
    const lines = csv.split('\n')
    const header = lines[0]
    expect(header).toContain('input')
    expect(header).toContain('expected_output')
    expect(header).toContain(`${graderName}_verdict`)
    expect(header).toContain(`${graderName}_reason`)
  })

  it('export has correct row count: one row per dataset item', async () => {
    const { experiment } = await seedAndRun({
      itemValues: [
        { input: 'q1', expected_output: 'a1' },
        { input: 'q2', expected_output: 'a2' },
        { input: 'q3', expected_output: 'a3' },
      ],
      graderDefs: [{ name: 'checker', rubric: 'check it' }],
      mockEvaluate,
    })

    const result = await service.exportCsv(experiment.id)
    const lines = unwrap(result).split('\n')
    // 1 header + 3 data rows
    expect(lines).toHaveLength(4)
  })

  it('CSV values match what was stored: input, expected_output, verdict, reason', async () => {
    vi.mocked(mockEvaluate).mockResolvedValue({ verdict: 'fail', reason: 'incorrect answer' })
    service = createExperimentService({
      repo: experimentRepository,
      datasetRepo: datasetRepository,
      graderRepo: graderRepository,
    })

    const { experiment, graders } = await seedAndRun({
      itemValues: [{ input: 'what is 2+2', expected_output: '4' }],
      graderDefs: [{ name: 'math-grader', rubric: 'check math' }],
      mockEvaluate,
    })

    const graderRecord = unwrap(await graderRepository.findById(graders[0].id))
    const graderName = graderRecord.name

    const result = await service.exportCsv(experiment.id)
    const csv = unwrap(result)
    const lines = csv.split('\n')
    const dataRow = lines[1]
    expect(dataRow).toContain('what is 2+2')
    expect(dataRow).toContain('4')
    expect(dataRow).toContain('fail')
    expect(dataRow).toContain('incorrect answer')

    const headerCols = lines[0].split(',')
    const dataCols = dataRow.split(',')
    const verdictIdx = headerCols.indexOf(`${graderName}_verdict`)
    expect(verdictIdx).toBeGreaterThan(-1)
    expect(dataCols[verdictIdx]).toBe('fail')
  })

  it('RFC 4180 escaping: values with commas are quoted', async () => {
    vi.mocked(mockEvaluate).mockResolvedValue({ verdict: 'pass', reason: 'fine, good work' })
    service = createExperimentService({
      repo: experimentRepository,
      datasetRepo: datasetRepository,
      graderRepo: graderRepository,
    })

    const { experiment } = await seedAndRun({
      itemValues: [{ input: 'hello, world', expected_output: 'greet, response' }],
      graderDefs: [{ name: 'csv-grader', rubric: 'check csv' }],
      mockEvaluate,
    })

    const result = await service.exportCsv(experiment.id)
    const csv = unwrap(result)
    // Values containing commas must be wrapped in double quotes
    expect(csv).toContain('"hello, world"')
    expect(csv).toContain('"greet, response"')
    expect(csv).toContain('"fine, good work"')
  })

  it('export fails for non-complete experiment', async () => {
    const dataset = unwrap(
      await datasetRepository.create(`csv-incomplete-dataset-${++seedCounter}`),
    )
    unwrap(await datasetRepository.createItem(dataset.id, { input: 'q', expected_output: 'a' }))
    const grader = unwrap(
      await graderRepository.create({
        name: `csv-incomplete-grader-${seedCounter}`,
        description: 'test',
        rubric: 'rubric',
      }),
    )
    const revisions = unwrap(await datasetRepository.findRevisions(dataset.id))
    const experiment = unwrap(
      await experimentRepository.create({
        name: `csv-incomplete-exp-${seedCounter}`,
        datasetId: dataset.id,
        datasetRevisionId: revisions[0].id,
        graderIds: [grader.id],
        modelId: MODEL_ID,
      }),
    )
    // Status is 'queued' (default), not 'complete'

    const result = await service.exportCsv(experiment.id)
    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected failure')
    expect(result.error).toMatch(/not finished running/i)
  })
})
