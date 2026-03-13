import { ok, fail, type Result } from '@eval-harness/shared'
import { graderRepository } from './repository.js'

export function createGraderService(repo: typeof graderRepository) {
  return {
    async listGraders(): Promise<Result<Awaited<ReturnType<typeof repo.findAll>>>> {
      try {
        const graders = await repo.findAll()
        return ok(graders)
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async getGrader(id: string): Promise<Result<NonNullable<Awaited<ReturnType<typeof repo.findById>>>>> {
      try {
        const grader = await repo.findById(id)
        if (!grader) return fail('Grader not found')
        return ok(grader)
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async createGrader(input: {
      name: string
      description: string
      rubric: string
    }): Promise<Result<Awaited<ReturnType<typeof repo.create>>>> {
      try {
        const existing = await repo.findByName(input.name)
        if (existing) return fail('Grader name already exists')
        const created = await repo.create(input)
        return ok(created)
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async updateGrader(
      id: string,
      input: { name?: string; description?: string; rubric?: string },
    ): Promise<Result<Awaited<ReturnType<typeof repo.update>>>> {
      try {
        const grader = await repo.findById(id)
        if (!grader) return fail('Grader not found')

        if (input.name !== undefined) {
          const existing = await repo.findByName(input.name)
          if (existing && existing.id !== id) return fail('Grader name already exists')
        }

        const updated = await repo.update(id, input)
        return ok(updated)
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async deleteGrader(id: string): Promise<Result<{ deleted: true }>> {
      try {
        const grader = await repo.findById(id)
        if (!grader) return fail('Grader not found')
        await repo.remove(id)
        return ok({ deleted: true as const })
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },
  }
}
