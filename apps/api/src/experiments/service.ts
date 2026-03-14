import { json2csv } from 'json-2-csv'
import { ok, fail, tryCatch } from '@eval-harness/shared'
import { experimentRepository } from './repository.js'
import { datasetRepository } from '../datasets/repository.js'
import { graderRepository } from '../graders/repository.js'
import type { createExperimentRunner } from './runner.js'
import type { DetailedResult } from './utils.js'

type Runner = ReturnType<typeof createExperimentRunner>

export function createExperimentService(deps: {
  repo: typeof experimentRepository
  datasetRepo: typeof datasetRepository
  graderRepo: typeof graderRepository
  runner?: Runner
}) {
  const { repo, datasetRepo, graderRepo, runner } = deps

  /** Fire-and-forget: enqueue a created experiment on the runner. */
  async function enqueueExperiment(experimentId: string) {
    if (!runner) return
    const result = await repo.findById(experimentId)
    if (!result.success) return

    const exp = result.data
    const items = (exp.revision?.items ?? []).map((item) => ({
      id: item.id,
      values: item.values as Record<string, string>,
    }))
    const graderList = exp.graders.map((eg) => ({
      id: eg.grader.id,
      rubric: eg.grader.rubric,
    }))

    if (items.length > 0) {
      void runner.enqueue({
        experimentId,
        datasetItems: items,
        graders: graderList,
        modelId: exp.modelId,
      })
    }
  }

  return {
    listExperiments: repo.findAll.bind(repo),

    getExperiment: repo.findById.bind(repo),

    createExperiment(input: {
      name: string
      datasetId: string
      graderIds: string[]
      modelId: string
    }) {
      return tryCatch(async () => {
        const datasetResult = await datasetRepo.findById(input.datasetId)
        if (!datasetResult.success) return fail('Dataset not found')

        const countResult = await datasetRepo.countItems(input.datasetId)
        if (!countResult.success) return countResult
        if (countResult.data === 0) return fail('Dataset has no items')

        for (const graderId of input.graderIds) {
          const graderResult = await graderRepo.findById(graderId)
          if (!graderResult.success) return fail('Grader not found')
        }

        const revisionsResult = await datasetRepo.findRevisions(input.datasetId)
        if (!revisionsResult.success) return revisionsResult
        if (revisionsResult.data.length === 0) return fail('Dataset has no revisions')
        const datasetRevisionId = revisionsResult.data[0].id

        const createResult = await repo.create({
          ...input,
          datasetRevisionId,
        })
        if (createResult.success) {
          void enqueueExperiment(createResult.data.id)
        }
        return createResult
      })
    },

    deleteExperiment: repo.remove.bind(repo),

    rerunExperiment(id: string) {
      return tryCatch(async () => {
        const expResult = await repo.findById(id)
        if (!expResult.success) return expResult
        const experiment = expResult.data

        const revisionsResult = await datasetRepo.findRevisions(experiment.datasetId)
        if (!revisionsResult.success) return revisionsResult
        if (revisionsResult.data.length === 0) return fail('Dataset has no revisions')
        const datasetRevisionId = revisionsResult.data[0].id

        const graderIds = experiment.graders.map((eg) => eg.graderId)
        const createResult = await repo.create({
          name: `${experiment.name} (re-run)`,
          datasetId: experiment.datasetId,
          datasetRevisionId,
          graderIds,
          modelId: experiment.modelId,
        })
        if (createResult.success) {
          void enqueueExperiment(createResult.data.id)
        }
        return createResult
      })
    },

    exportCsv(id: string) {
      return tryCatch(async () => {
        const expResult = await repo.findById(id)
        if (!expResult.success) return expResult

        const experiment = expResult.data

        if (experiment.status === 'queued' || experiment.status === 'running')
          return fail('Experiment has not finished running')

        const resultsResult = await repo.findResultsWithDetails(id)
        if (!resultsResult.success) return resultsResult
        if (resultsResult.data.length === 0) return fail('No results to export')

        const typedResults: DetailedResult[] = resultsResult.data.map((r) => ({
          ...r,
          datasetRevisionItem: {
            values: r.datasetRevisionItem.values as Record<string, string>,
          },
        }))

        // Collect unique grader names (preserving order of first appearance)
        const graderNames: string[] = []
        const graderNameSet = new Set<string>()
        for (const r of typedResults) {
          if (!graderNameSet.has(r.grader.name)) {
            graderNameSet.add(r.grader.name)
            graderNames.push(r.grader.name)
          }
        }

        // Collect unique dataset items (preserving order of first appearance)
        const itemIds: string[] = []
        const itemIdSet = new Set<string>()
        const itemValues = new Map<string, Record<string, string>>()
        for (const r of typedResults) {
          if (!itemIdSet.has(r.datasetRevisionItemId)) {
            itemIdSet.add(r.datasetRevisionItemId)
            itemIds.push(r.datasetRevisionItemId)
            itemValues.set(r.datasetRevisionItemId, r.datasetRevisionItem.values)
          }
        }

        // Index results by (itemId, graderName)
        const resultIndex = new Map<string, { verdict: string; reason: string }>()
        for (const r of typedResults) {
          resultIndex.set(`${r.datasetRevisionItemId}::${r.grader.name}`, {
            verdict: r.verdict,
            reason: r.reason,
          })
        }

        // Get dataset attributes for header (input + expected_output + any extras)
        const datasetAttributes: string[] = experiment.revision?.attributes ?? [
          'input',
          'expected_output',
        ]

        // Build column list
        const graderCols = graderNames.flatMap((g) => [`${g}_verdict`, `${g}_reason`])
        const columns = [...datasetAttributes, ...graderCols]

        // Build records
        const records = itemIds.map((itemId) => {
          const values = itemValues.get(itemId) ?? {}
          const row: Record<string, string> = {}
          for (const attr of datasetAttributes) {
            row[attr] = values[attr] ?? ''
          }
          for (const graderName of graderNames) {
            const r = resultIndex.get(`${itemId}::${graderName}`)
            row[`${graderName}_verdict`] = r?.verdict ?? ''
            row[`${graderName}_reason`] = r?.reason ?? ''
          }
          return row
        })

        const csv = (await json2csv(records, { keys: columns })).trimEnd()
        return ok(csv)
      })
    },
  }
}
