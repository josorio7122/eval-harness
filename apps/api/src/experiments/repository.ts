import { prisma } from '../lib/prisma.js'
import { ok, tryCatch } from '@eval-harness/shared'

export type ExperimentStatus = 'queued' | 'running' | 'complete' | 'failed'

export const experimentRepository = {
  findAll() {
    return tryCatch(async () => {
      const experiments = await prisma.experiment.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          status: true,
          modelId: true,
          datasetId: true,
          dataset: { select: { name: true } },
          revision: { select: { schemaVersion: true, createdAt: true } },
          graders: { select: { graderId: true } },
          _count: { select: { results: true } },
        },
      })
      return ok(experiments)
    })
  },

  findById(id: string) {
    return tryCatch(async () => {
      const experiment = await prisma.experiment.findFirstOrThrow({
        where: { id, deletedAt: null },
        select: {
          id: true,
          name: true,
          status: true,
          modelId: true,
          datasetId: true,
          datasetRevisionId: true,
          dataset: { select: { id: true, name: true } },
          revision: {
            select: {
              id: true,
              schemaVersion: true,
              attributes: true,
              createdAt: true,
              items: {
                select: { id: true, itemId: true, values: true, createdAt: true },
                orderBy: { itemId: 'asc' },
              },
            },
          },
          graders: {
            select: {
              graderId: true,
              grader: { select: { id: true, name: true, rubric: true } },
            },
          },
          results: {
            select: {
              id: true,
              verdict: true,
              reason: true,
              graderId: true,
              datasetRevisionItemId: true,
            },
          },
        },
      })
      return ok(experiment)
    })
  },

  create(data: {
    name: string
    datasetId: string
    datasetRevisionId: string
    graderIds: string[]
    modelId: string
  }) {
    return tryCatch(async () => {
      const experiment = await prisma.experiment.create({
        data: {
          name: data.name,
          datasetId: data.datasetId,
          datasetRevisionId: data.datasetRevisionId,
          modelId: data.modelId,
          graders: {
            create: data.graderIds.map((graderId) => ({ graderId })),
          },
        },
      })
      return ok(experiment)
    })
  },

  remove(id: string) {
    return tryCatch(async () => {
      await prisma.experiment.update({ where: { id }, data: { deletedAt: new Date() } })
      return ok({ deleted: true as const })
    })
  },

  updateStatus(id: string, status: ExperimentStatus) {
    return tryCatch(async () => {
      const experiment = await prisma.experiment.update({ where: { id }, data: { status } })
      return ok(experiment)
    })
  },

  createResult(data: {
    experimentId: string
    datasetRevisionItemId: string
    graderId: string
    verdict: string
    reason: string
  }) {
    return tryCatch(async () => {
      const result = await prisma.experimentResult.create({ data })
      return ok(result)
    })
  },

  findResultsByExperimentId(experimentId: string) {
    return tryCatch(async () => {
      const results = await prisma.experimentResult.findMany({ where: { experimentId } })
      return ok(results)
    })
  },

  countResultsByExperimentId(experimentId: string) {
    return tryCatch(async () => {
      const count = await prisma.experimentResult.count({ where: { experimentId } })
      return ok(count)
    })
  },

  findResultsWithDetails(experimentId: string) {
    return tryCatch(async () => {
      const results = await prisma.experimentResult.findMany({
        where: { experimentId },
        select: {
          id: true,
          experimentId: true,
          datasetRevisionItemId: true,
          graderId: true,
          verdict: true,
          reason: true,
          datasetRevisionItem: { select: { id: true, itemId: true, values: true } },
          grader: { select: { id: true, name: true } },
        },
      })
      return ok(results)
    })
  },
}
