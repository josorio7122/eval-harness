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

        const header = 'item_input,item_expected_output,grader_name,verdict,reason'
        const rows = (results as Array<{
          datasetItem: { values: Record<string, string> }
          grader: { name: string }
          verdict: string
          reason: string
        }>).map((r) => {
          const input = escapeCsvValue(r.datasetItem.values['input'] ?? '')
          const expectedOutput = escapeCsvValue(r.datasetItem.values['expected_output'] ?? '')
          const graderName = escapeCsvValue(r.grader.name)
          const verdict = escapeCsvValue(r.verdict)
          const reason = escapeCsvValue(r.reason)
          return `${input},${expectedOutput},${graderName},${verdict},${reason}`
        })

        return ok([header, ...rows].join('\n'))
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },
  }
}
