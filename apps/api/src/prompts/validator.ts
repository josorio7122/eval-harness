import { z } from 'zod'

export const modelParamsSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.int().min(1).optional(),
  topP: z.number().min(0).max(1).optional(),
})

export const createPromptSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  systemPrompt: z.string(),
  userPrompt: z.string(),
  modelId: z.string().trim().min(1, 'Model ID is required'),
  modelParams: modelParamsSchema.optional(),
})

export const updatePromptSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
})

export const createVersionSchema = z.object({
  systemPrompt: z.string(),
  userPrompt: z.string(),
  modelId: z.string().trim().min(1, 'Model ID is required'),
  modelParams: modelParamsSchema.optional(),
})
