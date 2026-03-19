import { fail, tryCatch } from '@eval-harness/shared'
import { type createPromptRepository } from './repository.js'

type PromptRepository = ReturnType<typeof createPromptRepository>

type CreatePromptInput = {
  name: string
  systemPrompt: string
  userPrompt: string
  modelId: string
  modelParams?: { temperature?: number; maxTokens?: number; topP?: number }
}

type CreateVersionInput = {
  systemPrompt: string
  userPrompt: string
  modelId: string
  modelParams?: { temperature?: number; maxTokens?: number; topP?: number }
}

export function createPromptService(repo: PromptRepository) {
  return {
    listPrompts: repo.findAll.bind(repo),

    getPrompt: repo.findById.bind(repo),

    createPrompt(input: CreatePromptInput) {
      return tryCatch(async () => {
        const existing = await repo.findByName(input.name)
        if (existing) return fail('Prompt name already exists')
        return repo.create(input)
      })
    },

    updatePromptName(id: string, name: string) {
      return tryCatch(async () => {
        const promptResult = await repo.findById(id)
        if (!promptResult.success) return promptResult

        const existing = await repo.findByName(name)
        if (existing && existing.id !== id) return fail('Prompt name already exists')

        return repo.updateName(id, name)
      })
    },

    createVersion(promptId: string, input: CreateVersionInput) {
      return tryCatch(async () => {
        const promptResult = await repo.findById(promptId)
        if (!promptResult.success) return promptResult
        return repo.createVersion(promptId, input)
      })
    },

    deletePrompt: repo.remove.bind(repo),
  }
}
