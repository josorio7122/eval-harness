import { ok, fail, type Result } from '@eval-harness/shared'
import { experimentRepository } from './repository.js'
import { datasetRepository } from '../datasets/repository.js'
import { graderRepository } from '../graders/repository.js'

export function createExperimentService(
  repo: typeof experimentRepository,
  datasetRepo: typeof datasetRepository,
  graderRepo: typeof graderRepository,
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
  }
}
