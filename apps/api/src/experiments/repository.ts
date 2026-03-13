import { prisma } from '../lib/prisma.js'
import { ok, tryCatch } from '@eval-harness/shared'

export type ExperimentStatus = 'queued' | 'running' | 'complete' | 'failed'

export const experimentRepository = {
  findAll() {
    return tryCatch(async () => {
      const experiments = await prisma.experiment.findMany({
        orderBy: { name: 'asc' },
        include: {
          dataset: { select: { name: true } },
          revision: { select: { schemaVersion: true, createdAt: true } },
          graders: true,
          _count: { select: { results: true } },
        },
      })
      return ok(experiments)
    })
  },

  findById(id: string) {
    return tryCatch(async () => {
      const experiment = await prisma.experiment.findUniqueOrThrow({
        where: { id },
        include: {
          dataset: true,
          revision: {
            include: {
              items: { orderBy: { itemId: 'asc' } },
            },
          },
          graders: { include: { grader: true } },
          results: true,
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
  }) {
    return tryCatch(async () => {
      const experiment = await prisma.experiment.create({
        data: {
          name: data.name,
          datasetId: data.datasetId,
          datasetRevisionId: data.datasetRevisionId,
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
      await prisma.experiment.delete({ where: { id } })
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
        include: {
          datasetRevisionItem: true,
          grader: true,
        },
      })
      return ok(results)
    })
  },
}
