import { json2csv } from 'json-2-csv'
import { ok, fail, tryCatch } from '@eval-harness/shared'
import { experimentRepository } from './repository.js'
import type { ExperimentStatus } from './repository.js'
import { datasetRepository } from '../datasets/repository.js'
import { graderRepository } from '../graders/repository.js'
import type { createExperimentRunner } from './runner.js'

type Runner = ReturnType<typeof createExperimentRunner>

export function createExperimentService(
  repo: typeof experimentRepository,
  datasetRepo: typeof datasetRepository,
  graderRepo: typeof graderRepository,
  runner?: Runner,
) {
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

        return repo.create({
          ...input,
          datasetRevisionId,
        })
      })
    },

    deleteExperiment: repo.remove.bind(repo),

    rerunExperiment(id: string) {
      return tryCatch(async () => {
        const expResult = await repo.findById(id)
        if (!expResult.success) return expResult
        const experiment = expResult.data as unknown as {
          name: string
          datasetId: string
          modelId: string
          graders: Array<{ graderId: string }>
        }

        const revisionsResult = await datasetRepo.findRevisions(experiment.datasetId)
        if (!revisionsResult.success) return revisionsResult
        if (revisionsResult.data.length === 0) return fail('Dataset has no revisions')
        const datasetRevisionId = revisionsResult.data[0].id

        const graderIds = experiment.graders.map((eg) => eg.graderId)
        return repo.create({
          name: `${experiment.name} (re-run)`,
          datasetId: experiment.datasetId,
          datasetRevisionId,
          graderIds,
          modelId: experiment.modelId,
        })
      })
    },

    runExperiment(id: string) {
      return tryCatch(async () => {
        const result = await repo.findById(id)
        if (!result.success) return result

        const experiment = result.data

        if (experiment.status !== 'queued') {
          return fail('Experiment is not in a runnable state')
        }

        const rawItems = experiment.revision?.items ?? []
        if (rawItems.length === 0) return fail('Dataset has no items')
        const datasetItems = rawItems.map((item) => ({
          id: item.id,
          values: item.values as Record<string, string>,
        }))

        const graders = experiment.graders.map((eg) => ({
          id: eg.grader.id,
          rubric: eg.grader.rubric,
        }))

        if (!runner) return fail('Runner not configured')
        void runner.enqueue(id, datasetItems, graders, experiment.modelId)
        return ok({ status: 'queued' as ExperimentStatus })
      })
    },

    exportCsv(id: string) {
      return tryCatch(async () => {
        const expResult = await repo.findById(id)
        if (!expResult.success) return expResult

        const experiment = expResult.data as {
          status: ExperimentStatus
          revision?: { attributes?: string[] }
        }

        if (experiment.status === 'queued' || experiment.status === 'running')
          return fail('Experiment has not finished running')

        const resultsResult = await repo.findResultsWithDetails(id)
        if (!resultsResult.success) return resultsResult
        if (resultsResult.data.length === 0) return fail('No results to export')

        type DetailedResult = {
          datasetRevisionItemId: string
          datasetRevisionItem: { values: Record<string, string> }
          grader: { name: string }
          verdict: string
          reason: string
        }
        const typedResults = resultsResult.data as DetailedResult[]

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
