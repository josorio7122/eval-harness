import { prisma } from '../lib/prisma.js'
import { ok, tryCatch } from '@eval-harness/shared'

export const graderRepository = {
  findAll() {
    return tryCatch(async () => {
      const graders = await prisma.grader.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
      })
      return ok(graders)
    })
  },

  findById(id: string) {
    return tryCatch(async () => {
      const grader = await prisma.grader.findFirstOrThrow({ where: { id, deletedAt: null } })
      return ok(grader)
    })
  },

  /** Returns null when no match — used by services to check name availability. */
  findByName(name: string) {
    return prisma.grader.findFirst({ where: { name, deletedAt: null } })
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

  async remove(id: string) {
    return tryCatch(async () => {
      await prisma.grader.update({ where: { id }, data: { deletedAt: new Date() } })
      return ok({ deleted: true as const })
    })
  },
}
