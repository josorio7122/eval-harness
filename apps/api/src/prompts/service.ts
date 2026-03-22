import { fail, ok, tryCatch } from '@eval-harness/shared'
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

type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

type BuildPlaygroundMessagesInput = {
  promptId: string
  versionId: string
  messages: ChatMessage[]
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

    buildPlaygroundMessages(input: BuildPlaygroundMessagesInput) {
      return tryCatch(async () => {
        const versionResult = await repo.findVersionById(input.promptId, input.versionId)
        if (!versionResult.success) return versionResult

        const version = versionResult.data
        const firstUserContent = version.userPrompt.replace(/\{input\}/g, input.messages[0].content)

        const llmMessages: ChatMessage[] = [
          { role: 'system', content: version.systemPrompt },
          { role: 'user', content: firstUserContent },
          ...input.messages.slice(1),
        ]

        return ok({ version, llmMessages })
      })
    },
  }
}
