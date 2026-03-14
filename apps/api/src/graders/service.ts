import { fail, tryCatch } from '@eval-harness/shared'
import { graderRepository } from './repository.js'

export function createGraderService(repo: typeof graderRepository) {
  return {
    listGraders: repo.findAll.bind(repo),

    getGrader: repo.findById.bind(repo),

    createGrader(input: { name: string; description: string; rubric: string }) {
      return tryCatch(async () => {
        const existing = await repo.findByName(input.name)
        if (existing) return fail('Grader name already exists')
        return repo.create(input)
      })
    },

    updateGrader(id: string, input: { name?: string; description?: string; rubric?: string }) {
      return tryCatch(async () => {
        const graderResult = await repo.findById(id)
        if (!graderResult.success) return graderResult

        if (input.name !== undefined) {
          const existing = await repo.findByName(input.name)
          if (existing && existing.id !== id) return fail('Grader name already exists')
        }

        return repo.update(id, input)
      })
    },

    deleteGrader: repo.removeWithCascade.bind(repo),
  }
}
