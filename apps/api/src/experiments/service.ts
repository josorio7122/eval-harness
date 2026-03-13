import { json2csv } from 'json-2-csv'
import { ok, fail, tryCatch, type Result } from '@eval-harness/shared'
import { experimentRepository } from './repository.js'
import type { ExperimentStatus } from './repository.js'
import { datasetRepository } from '../datasets/repository.js'
import { graderRepository } from '../graders/repository.js'
import type { createExperimentRunner } from './runner.js'

type Runner = ReturnType<typeof createExperimentRunner>
type ExperimentWithDetails = NonNullable<Awaited<ReturnType<typeof experimentRepository.findById>>>

export function createExperimentService(
  repo: typeof experimentRepository,
  datasetRepo: typeof datasetRepository,
  graderRepo: typeof graderRepository,
  runner?: Runner,
) {
  return {
    listExperiments(): Promise<Result<Awaited<ReturnType<typeof repo.findAll>>>> {
      return tryCatch(async () => {
        const experiments = await repo.findAll()
        return ok(experiments)
      })
    },

    getExperiment(
      id: string,
    ): Promise<Result<NonNullable<Awaited<ReturnType<typeof repo.findById>>>>> {
      return tryCatch(async () => {
        const experiment = await repo.findById(id)
        if (!experiment) return fail('Experiment not found')
        return ok(experiment)
      })
    },

    createExperiment(input: {
      name: string
      datasetId: string
      graderIds: string[]
    }): Promise<Result<Awaited<ReturnType<typeof repo.create>>>> {
      return tryCatch(async () => {
        const dataset = await datasetRepo.findById(input.datasetId)
        if (!dataset) return fail('Dataset not found')

        const itemCount = await datasetRepo.countItems(input.datasetId)
        if (itemCount === 0) return fail('Dataset has no items')

        for (const graderId of input.graderIds) {
          const grader = await graderRepo.findById(graderId)
          if (!grader) return fail('Grader not found')
        }

        const revisions = await datasetRepo.findRevisions(input.datasetId)
        if (revisions.length === 0) return fail('Dataset has no revisions')
        const datasetRevisionId = revisions[0].id

        const created = await repo.create({ ...input, datasetRevisionId })
        return ok(created)
      })
    },

    deleteExperiment(id: string): Promise<Result<{ deleted: true }>> {
      return tryCatch(async () => {
        const experiment = await repo.findById(id)
        if (!experiment) return fail('Experiment not found')
        await repo.remove(id)
        return ok({ deleted: true as const })
      })
    },

    rerunExperiment(id: string): Promise<Result<Awaited<ReturnType<typeof repo.create>>>> {
      return tryCatch(async () => {
        const experiment = await repo.findById(id)
        if (!experiment) return fail('Experiment not found')

        const revisions = await datasetRepo.findRevisions(experiment.datasetId)
        if (revisions.length === 0) return fail('Dataset has no revisions')
        const datasetRevisionId = revisions[0].id

        const graderIds = experiment.graders.map((eg: { graderId: string }) => eg.graderId)
        const created = await repo.create({
          name: `${experiment.name} (re-run)`,
          datasetId: experiment.datasetId,
          datasetRevisionId,
          graderIds,
        })
        return ok(created)
      })
    },

    runExperiment(id: string): Promise<Result<{ status: ExperimentStatus }>> {
      return tryCatch(async () => {
        const experiment = await repo.findById(id)
        if (!experiment) return fail('Experiment not found')

        if (experiment.status !== 'queued') {
          return fail('Experiment is not in a runnable state')
        }

        const typedExperiment = experiment as ExperimentWithDetails
        const rawItems = typedExperiment.revision?.items ?? []
        if (rawItems.length === 0) return fail('Dataset has no items')
        const datasetItems = rawItems.map((item) => ({
          id: item.id,
          values: item.values as Record<string, string>,
        }))

        const graders = typedExperiment.graders.map((eg) => ({
          id: eg.grader.id,
          rubric: eg.grader.rubric,
        }))

        if (!runner) return fail('Runner not configured')
        void runner.enqueue(id, datasetItems, graders)
        return ok({ status: 'queued' as ExperimentStatus })
      })
    },

    exportCsv(id: string): Promise<Result<string>> {
      return tryCatch(async () => {
        const experiment = await repo.findById(id)
        if (!experiment) return fail('Experiment not found')
        if (experiment.status === 'queued' || experiment.status === 'running')
          return fail('Experiment has not finished running')

        const results = await repo.findResultsWithDetails(id)
        if (results.length === 0) return fail('No results to export')

        type DetailedResult = {
          datasetRevisionItemId: string
          datasetRevisionItem: { values: Record<string, string> }
          grader: { name: string }
          verdict: string
          reason: string
        }
        const typedResults = results as DetailedResult[]

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
        const expWithRevision = experiment as ExperimentWithDetails
        const datasetAttributes: string[] = expWithRevision.revision?.attributes ?? [
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
