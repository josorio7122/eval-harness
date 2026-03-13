import { ok, fail, tryCatch, type Result } from '@eval-harness/shared'
import { graderRepository } from './repository.js'

export function createGraderService(repo: typeof graderRepository) {
  return {
    listGraders(): Promise<Result<Awaited<ReturnType<typeof repo.findAll>>>> {
      return tryCatch(async () => {
        const graders = await repo.findAll()
        return ok(graders)
      })
    },

    getGrader(
      id: string,
    ): Promise<Result<NonNullable<Awaited<ReturnType<typeof repo.findById>>>>> {
      return tryCatch(async () => {
        const grader = await repo.findById(id)
        if (!grader) return fail('Grader not found')
        return ok(grader)
      })
    },

    createGrader(input: {
      name: string
      description: string
      rubric: string
    }): Promise<Result<Awaited<ReturnType<typeof repo.create>>>> {
      return tryCatch(async () => {
        const existing = await repo.findByName(input.name)
        if (existing) return fail('Grader name already exists')
        const created = await repo.create(input)
        return ok(created)
      })
    },

    updateGrader(
      id: string,
      input: { name?: string; description?: string; rubric?: string },
    ): Promise<Result<Awaited<ReturnType<typeof repo.update>>>> {
      return tryCatch(async () => {
        const grader = await repo.findById(id)
        if (!grader) return fail('Grader not found')

        if (input.name !== undefined) {
          const existing = await repo.findByName(input.name)
          if (existing && existing.id !== id) return fail('Grader name already exists')
        }

        const updated = await repo.update(id, input)
        return ok(updated)
      })
    },

    deleteGrader(id: string): Promise<Result<{ deleted: true }>> {
      return tryCatch(async () => {
        const grader = await repo.findById(id)
        if (!grader) return fail('Grader not found')
        await repo.removeWithCascade(id)
        return ok({ deleted: true as const })
      })
    },
  }
}
