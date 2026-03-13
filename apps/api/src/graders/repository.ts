import { prisma } from '../lib/prisma.js'
import { ok, tryCatch } from '@eval-harness/shared'

export const graderRepository = {
  findAll() {
    return tryCatch(async () => {
      const graders = await prisma.grader.findMany({ orderBy: { name: 'asc' } })
      return ok(graders)
    })
  },

  findById(id: string) {
    return tryCatch(async () => {
      const grader = await prisma.grader.findUniqueOrThrow({ where: { id } })
      return ok(grader)
    })
  },

  /** Returns null when no match — used by services to check name availability. */
  findByName(name: string) {
    return prisma.grader.findUnique({ where: { name } })
  },

  create(data: { name: string; description: string; rubric: string }) {
    return tryCatch(async () => {
      const grader = await prisma.grader.create({ data })
      return ok(grader)
    })
  },

  update(id: string, data: { name?: string; description?: string; rubric?: string }) {
    return tryCatch(async () => {
      const grader = await prisma.grader.update({ where: { id }, data })
      return ok(grader)
    })
  },

  async removeWithCascade(id: string) {
    return tryCatch(async () => {
      await prisma.$transaction(async (tx) => {
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

        await tx.grader.delete({ where: { id } })
      })

      return ok({ deleted: true as const })
    })
  },
}
