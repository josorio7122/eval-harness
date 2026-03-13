import { prisma } from '../lib/prisma.js'

export const graderRepository = {
  findAll() {
    return prisma.grader.findMany({ orderBy: { name: 'asc' } })
  },

  findById(id: string) {
    return prisma.grader.findUnique({ where: { id } })
  },

  findByName(name: string) {
    return prisma.grader.findUnique({ where: { name } })
  },

  create(data: { name: string; description: string; rubric: string }) {
    return prisma.grader.create({ data })
  },

  update(id: string, data: { name?: string; description?: string; rubric?: string }) {
    return prisma.grader.update({ where: { id }, data })
  },

  remove(id: string) {
    return prisma.grader.delete({ where: { id } })
  },

  async removeWithCascade(id: string) {
    return prisma.$transaction(async (tx) => {
      const experimentGraders = await tx.experimentGrader.findMany({
        where: { graderId: id },
        select: { experimentId: true },
      })
      const experimentIds = experimentGraders.map((eg) => eg.experimentId)

      if (experimentIds.length > 0) {
        await tx.experiment.deleteMany({
          where: { id: { in: experimentIds } },
        })
      }

      return tx.grader.delete({ where: { id } })
    })
  },
}
