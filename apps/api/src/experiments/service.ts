import { ok, fail, type Result } from '@eval-harness/shared'
import { experimentRepository } from './repository.js'
import { datasetRepository } from '../datasets/repository.js'
import { graderRepository } from '../graders/repository.js'
import type { createExperimentRunner } from './runner.js'

type Runner = ReturnType<typeof createExperimentRunner>

function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function createExperimentService(
  repo: typeof experimentRepository,
  datasetRepo: typeof datasetRepository,
  graderRepo: typeof graderRepository,
  runner?: Runner,
) {
  return {
    async listExperiments(): Promise<Result<Awaited<ReturnType<typeof repo.findAll>>>> {
      try {
        const experiments = await repo.findAll()
        return ok(experiments)
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async getExperiment(
      id: string,
    ): Promise<Result<NonNullable<Awaited<ReturnType<typeof repo.findById>>>>> {
      try {
        const experiment = await repo.findById(id)
        if (!experiment) return fail('Experiment not found')
        return ok(experiment)
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async createExperiment(input: {
      name: string
      datasetId: string
      graderIds: string[]
    }): Promise<Result<Awaited<ReturnType<typeof repo.create>>>> {
      try {
        const dataset = await datasetRepo.findById(input.datasetId)
        if (!dataset) return fail('Dataset not found')

        const itemCount = await datasetRepo.countItems(input.datasetId)
        if (itemCount === 0) return fail('Dataset has no items')

        for (const graderId of input.graderIds) {
          const grader = await graderRepo.findById(graderId)
          if (!grader) return fail('Grader not found')
        }

        const created = await repo.create(input)
        return ok(created)
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async deleteExperiment(id: string): Promise<Result<{ deleted: true }>> {
      try {
        const experiment = await repo.findById(id)
        if (!experiment) return fail('Experiment not found')
        await repo.remove(id)
        return ok({ deleted: true as const })
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async rerunExperiment(
      id: string,
    ): Promise<Result<Awaited<ReturnType<typeof repo.create>>>> {
      try {
        const experiment = await repo.findById(id)
        if (!experiment) return fail('Experiment not found')

        const itemCount = await datasetRepo.countItems(experiment.datasetId)
        if (itemCount === 0) return fail('Dataset has no items')

        const graderIds = experiment.graders.map((eg: { graderId: string }) => eg.graderId)
        const created = await repo.create({
          name: `${experiment.name} (re-run)`,
          datasetId: experiment.datasetId,
          graderIds,
        })
        return ok(created)
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async runExperiment(id: string): Promise<Result<{ status: string }>> {
      try {
        const experiment = await repo.findById(id)
        if (!experiment) return fail('Experiment not found')

        if (experiment.status !== 'queued') {
          return fail('Experiment is not in a runnable state')
        }

        const itemCount = await datasetRepo.countItems(experiment.datasetId)
        if (itemCount === 0) return fail('Dataset has no items')

        const datasetItems = (experiment.dataset as { items: Array<{ id: string; values: Record<string, string> }> }).items
        const graders = (experiment.graders as Array<{ graderId: string; grader: { id: string; rubric: string } }>).map(
          (eg) => ({ id: eg.grader.id, rubric: eg.grader.rubric }),
        )

        await runner!.enqueue(id, datasetItems, graders)
        return ok({ status: 'queued' })
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async exportCsv(id: string): Promise<Result<string>> {
      try {
        const experiment = await repo.findById(id)
        if (!experiment) return fail('Experiment not found')
        if (experiment.status !== 'complete') return fail('Experiment is not complete')

        const results = await repo.findResultsWithDetails(id)
        if (results.length === 0) return fail('No results to export')

        type DetailedResult = {
          datasetItemId: string
          datasetItem: { values: Record<string, string> }
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
          if (!itemIdSet.has(r.datasetItemId)) {
            itemIdSet.add(r.datasetItemId)
            itemIds.push(r.datasetItemId)
            itemValues.set(r.datasetItemId, r.datasetItem.values)
          }
        }

        // Index results by (itemId, graderName)
        const resultIndex = new Map<string, { verdict: string; reason: string }>()
        for (const r of typedResults) {
          resultIndex.set(`${r.datasetItemId}::${r.grader.name}`, {
            verdict: r.verdict,
            reason: r.reason,
          })
        }

        // Get dataset attributes for header (input + expected_output + any extras)
        const expWithDataset = experiment as unknown as {
          dataset: { attributes: string[] }
        }
        const datasetAttributes: string[] = expWithDataset.dataset?.attributes ?? [
          'input',
          'expected_output',
        ]

        // Build header: dataset attributes + {graderName}_verdict + {graderName}_reason per grader
        const graderCols = graderNames.flatMap((g) => [
          `${g}_verdict`,
          `${g}_reason`,
        ])
        const header = [...datasetAttributes, ...graderCols].map(escapeCsvValue).join(',')

        // Build one row per dataset item
        const rows = itemIds.map((itemId) => {
          const values = itemValues.get(itemId) ?? {}
          const attrCells = datasetAttributes.map((attr) => escapeCsvValue(values[attr] ?? ''))
          const graderCells = graderNames.flatMap((graderName) => {
            const r = resultIndex.get(`${itemId}::${graderName}`)
            return [escapeCsvValue(r?.verdict ?? ''), escapeCsvValue(r?.reason ?? '')]
          })
          return [...attrCells, ...graderCells].join(',')
        })

        return ok([header, ...rows].join('\n'))
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },
  }
}
