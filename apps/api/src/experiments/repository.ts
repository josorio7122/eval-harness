import { prisma } from '../lib/prisma.js'

export type ExperimentStatus = 'queued' | 'running' | 'complete' | 'failed'

export const experimentRepository = {
  findAll() {
    return prisma.experiment.findMany({
      orderBy: { name: 'asc' },
      include: {
        dataset: { select: { name: true } },
        revision: { select: { schemaVersion: true, createdAt: true } },
        graders: true,
        _count: { select: { results: true } },
      },
    })
  },

  findById(id: string) {
    return prisma.experiment.findUnique({
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
  },

  create(data: {
    name: string
    datasetId: string
    datasetRevisionId: string
    graderIds: string[]
  }) {
    return prisma.experiment.create({
      data: {
        name: data.name,
        datasetId: data.datasetId,
        datasetRevisionId: data.datasetRevisionId,
        graders: {
          create: data.graderIds.map((graderId) => ({ graderId })),
        },
      },
    })
  },

  remove(id: string) {
    return prisma.experiment.delete({ where: { id } })
  },

  updateStatus(id: string, status: ExperimentStatus) {
    return prisma.experiment.update({ where: { id }, data: { status } })
  },

  createResult(data: {
    experimentId: string
    datasetRevisionItemId: string
    graderId: string
    verdict: string
    reason: string
  }) {
    return prisma.experimentResult.create({ data })
  },

  findResultsByExperimentId(experimentId: string) {
    return prisma.experimentResult.findMany({ where: { experimentId } })
  },

  countResultsByExperimentId(experimentId: string) {
    return prisma.experimentResult.count({ where: { experimentId } })
  },

  findResultsWithDetails(experimentId: string) {
    return prisma.experimentResult.findMany({
      where: { experimentId },
      include: {
        datasetRevisionItem: true,
        grader: true,
      },
    })
  },
}
