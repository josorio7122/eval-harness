import { describe, it, expect, vi, beforeEach } from 'vitest'
import { type Result } from '@eval-harness/shared'
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

async function seedAndRun(
  itemValues: Array<Record<string, string>>,
  graderDefs: Array<{ name: string; rubric: string }>,
  mockEvaluate: EvaluateFn,
) {
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
    }),
  )
  unwrap(await experimentRepository.updateStatus(experiment.id, 'running'))

  const runner = createExperimentRunner(experimentRepository, mockEvaluate)
  await runner.enqueue(experiment.id, items, graders)

  return { experiment, items, graders, dataset }
}

describe('CSV export (integration)', () => {
  let mockEvaluateFn: ReturnType<typeof vi.fn>
  let mockEvaluate: EvaluateFn
  let service: ReturnType<typeof createExperimentService>

  beforeEach(() => {
    mockEvaluateFn = vi.fn()
    mockEvaluateFn.mockResolvedValue({ verdict: 'pass', reason: 'looks good' })
    mockEvaluate = mockEvaluateFn as unknown as EvaluateFn
    service = createExperimentService(experimentRepository, datasetRepository, graderRepository)
  })

  it('export has correct headers: attribute cols + graderName_verdict + graderName_reason', async () => {
    const { experiment, graders } = await seedAndRun(
      [{ input: 'q1', expected_output: 'a1' }],
      [{ name: 'accuracy', rubric: 'be accurate' }],
      mockEvaluate,
    )

    // graders[0].id gives us the grader id but we need the name; fetch from DB
    const graderRecord = unwrap(await graderRepository.findById(graders[0].id))
    const graderName = graderRecord.name

    const result = await service.exportCsv(experiment.id)
    expect(result.success).toBe(true)

    const lines = (result as { success: true; data: string }).data.split('\n')
    const header = lines[0]
    expect(header).toContain('input')
    expect(header).toContain('expected_output')
    expect(header).toContain(`${graderName}_verdict`)
    expect(header).toContain(`${graderName}_reason`)
  })

  it('export has correct row count: one row per dataset item', async () => {
    const { experiment } = await seedAndRun(
      [
        { input: 'q1', expected_output: 'a1' },
        { input: 'q2', expected_output: 'a2' },
        { input: 'q3', expected_output: 'a3' },
      ],
      [{ name: 'checker', rubric: 'check it' }],
      mockEvaluate,
    )

    const result = await service.exportCsv(experiment.id)
    expect(result.success).toBe(true)

    const lines = (result as { success: true; data: string }).data.split('\n')
    // 1 header + 3 data rows
    expect(lines).toHaveLength(4)
  })

  it('CSV values match what was stored: input, expected_output, verdict, reason', async () => {
    mockEvaluateFn.mockResolvedValue({ verdict: 'fail', reason: 'incorrect answer' })
    mockEvaluate = mockEvaluateFn as unknown as EvaluateFn
    service = createExperimentService(experimentRepository, datasetRepository, graderRepository)

    const { experiment, graders } = await seedAndRun(
      [{ input: 'what is 2+2', expected_output: '4' }],
      [{ name: 'math-grader', rubric: 'check math' }],
      mockEvaluate,
    )

    const graderRecord = unwrap(await graderRepository.findById(graders[0].id))
    const graderName = graderRecord.name

    const result = await service.exportCsv(experiment.id)
    expect(result.success).toBe(true)

    const csv = (result as { success: true; data: string }).data
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
    mockEvaluateFn.mockResolvedValue({ verdict: 'pass', reason: 'fine, good work' })
    mockEvaluate = mockEvaluateFn as unknown as EvaluateFn
    service = createExperimentService(experimentRepository, datasetRepository, graderRepository)

    const { experiment } = await seedAndRun(
      [{ input: 'hello, world', expected_output: 'greet, response' }],
      [{ name: 'csv-grader', rubric: 'check csv' }],
      mockEvaluate,
    )

    const result = await service.exportCsv(experiment.id)
    expect(result.success).toBe(true)

    const csv = (result as { success: true; data: string }).data
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
      }),
    )
    // Status is 'queued' (default), not 'complete'

    const result = await service.exportCsv(experiment.id)
    expect(result.success).toBe(false)
    expect((result as { success: false; error: string }).error).toMatch(/not finished running/i)
  })
})
